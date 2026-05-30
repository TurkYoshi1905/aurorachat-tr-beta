import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FUNC_URL = `${SUPABASE_URL}/functions/v1/steam-auth`;
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function redirect(url: string) {
  return Response.redirect(url, 302);
}

function parseProfileXml(xml: string): { steamId: string; persona: string; avatarUrl: string; profileUrl: string } | null {
  const get = (tag: string) => {
    const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : '';
  };
  const steamId = get('steamID64');
  const persona = get('steamID');
  const avatarUrl = get('avatarFull') || get('avatarMedium') || get('avatarIcon');
  if (!steamId) return null;
  return {
    steamId,
    persona: persona || steamId,
    avatarUrl,
    profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const userId = url.searchParams.get('userId') || '';
  const rawReturnTo = url.searchParams.get('returnTo') || '';

  // ==============================
  // CONNECT: redirect user to Steam OpenID
  // ==============================
  if (action === 'connect') {
    if (!userId) {
      return new Response('Missing userId', { status: 400 });
    }

    const callbackUrl = `${FUNC_URL}?action=callback&userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent(rawReturnTo)}`;
    const realm = FUNC_URL.replace(/\/[^/]*$/, '/');

    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': callbackUrl,
      'openid.realm': realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    return redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
  }

  // ==============================
  // CALLBACK: receive OpenID response from Steam
  // ==============================
  if (action === 'callback') {
    const mode = url.searchParams.get('openid.mode');
    const claimedId = url.searchParams.get('openid.claimed_id') || '';
    const errorReturnTo = rawReturnTo ? `${rawReturnTo}?steam=error` : `${SUPABASE_URL}?steam=error`;
    const successReturnTo = rawReturnTo ? `${rawReturnTo}?steam=success` : `${SUPABASE_URL}?steam=success`;

    if (mode !== 'id_res' || !claimedId) {
      return redirect(errorReturnTo);
    }

    // Extract SteamID64 from claimed_id
    // claimed_id looks like: https://steamcommunity.com/openid/id/76561198XXXXXXXXX
    const steamIdMatch = claimedId.match(/\/openid\/id\/(\d{17})$/);
    if (!steamIdMatch) {
      return redirect(errorReturnTo);
    }
    const steamId = steamIdMatch[1];

    // Fetch Steam profile via public XML API
    let profile: { steamId: string; persona: string; avatarUrl: string; profileUrl: string } | null = null;
    try {
      const xmlRes = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
        headers: { 'User-Agent': 'AuroraChatBot/1.0' },
      });
      const xml = await xmlRes.text();
      profile = parseProfileXml(xml);
    } catch (_e) {
      // Profile fetch failed — we still have the steamId, set basic info
    }

    if (!userId) {
      return redirect(errorReturnTo);
    }

    // Update the user's profile in the database using service role
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin
      .from('profiles')
      .update({
        steam_id: steamId,
        steam_persona: profile?.persona || steamId,
        steam_profile_url: profile?.profileUrl || `https://steamcommunity.com/profiles/${steamId}`,
        steam_avatar_url: profile?.avatarUrl || null,
      })
      .eq('id', userId);

    if (error) {
      console.error('DB update error:', error);
      return redirect(errorReturnTo);
    }

    return redirect(successReturnTo);
  }

  return new Response('Not found', { status: 404 });
});
