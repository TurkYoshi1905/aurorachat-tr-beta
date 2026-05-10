import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID') || 'baf63b79285f4d6db3ed80c49ad8f302';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await admin.auth.getUser(token);
  return data?.user?.id ?? null;
}

async function storeTokens(body: any): Promise<Response> {
  const {
    user_id,
    access_token,
    refresh_token,
    expires_in,
    display_name,
    email,
    spotify_id,
    avatar_url,
  } = body;

  if (!user_id || !access_token || !refresh_token) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Display name için en iyi değeri belirle: display_name > spotify_id
  const resolvedDisplayName = (display_name && display_name.trim()) ? display_name.trim() : (spotify_id || '');

  // 1) spotify_connections tablosunu güncelle
  const { error: upsertError } = await admin.from('spotify_connections').upsert({
    user_id,
    spotify_user_id: spotify_id || '',
    spotify_display_name: resolvedDisplayName,
    spotify_email: email || '',
    access_token,
    refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (upsertError) {
    console.error('[spotify-token] DB upsert error:', upsertError);
    return json({ error: 'DB_UPSERT_FAILED' }, 500);
  }

  // 2) profiles tablosunu da Spotify display name ve avatar ile güncelle
  //    (Mevcut kullanıcı adını ezmemek için yalnızca spotify_ önekli kolonları yaz)
  const profileUpdate: Record<string, string> = {};
  if (resolvedDisplayName) profileUpdate.spotify_display_name = resolvedDisplayName;
  if (avatar_url) profileUpdate.spotify_avatar_url = avatar_url;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await admin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user_id);

    if (profileError) {
      // Kritik hata değil, yalnızca loglama yeterli
      console.warn('[spotify-token] profiles update warning:', profileError.message);
    }
  }

  return json({
    success: true,
    spotify_display_name: resolvedDisplayName,
    spotify_email: email || '',
  });
}

async function refreshToken(user_id: string): Promise<Response> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: conn } = await admin
    .from('spotify_connections')
    .select('refresh_token')
    .eq('user_id', user_id)
    .maybeSingle();

  if (!conn?.refresh_token) return json({ error: 'No refresh token found' }, 404);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: conn.refresh_token,
  });

  const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (spotifyRes.status === 400 || spotifyRes.status === 401) {
    await admin.from('spotify_connections').delete().eq('user_id', user_id);
    await admin.from('spotify_now_playing').delete().eq('user_id', user_id);
    return json({ error: 'TOKEN_REFRESH_REVOKED' }, 401);
  }

  if (!spotifyRes.ok) {
    return json({ error: 'TOKEN_REFRESH_FAILED' }, 500);
  }

  const refreshed = await spotifyRes.json();
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const updateData: any = {
    access_token: refreshed.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  if (refreshed.refresh_token) updateData.refresh_token = refreshed.refresh_token;

  await admin.from('spotify_connections').update(updateData).eq('user_id', user_id);

  return json({ success: true, expires_at: expiresAt });
}

async function getValidAccessToken(admin: any, user_id: string): Promise<string | null> {
  const { data: conn } = await admin
    .from('spotify_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user_id)
    .maybeSingle();

  if (!conn) return null;

  let accessToken = conn.access_token;
  const expiresAt = new Date(conn.expires_at).getTime();

  // Token 60 saniye içinde sona erecekse yenile
  if (expiresAt - Date.now() < 60000) {
    const refreshRes = await refreshToken(user_id);
    if (!refreshRes.ok) return null;
    const refreshedConn = await admin
      .from('spotify_connections')
      .select('access_token')
      .eq('user_id', user_id)
      .maybeSingle();
    if (!refreshedConn.data) return null;
    accessToken = refreshedConn.data.access_token;
  }

  return accessToken;
}

async function pollNowPlaying(user_id: string): Promise<Response> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const accessToken = await getValidAccessToken(admin, user_id);

  if (!accessToken) return json({ playing: false, reason: 'no_connection' });

  const nowPlayingRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (nowPlayingRes.status === 204 || nowPlayingRes.status === 404) {
    await admin.from('spotify_now_playing').upsert({
      user_id,
      is_playing: false,
      track_name: null,
      artist_name: null,
      album_name: null,
      album_art_url: null,
      track_url: null,
      progress_ms: 0,
      duration_ms: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return json({ playing: false });
  }

  if (nowPlayingRes.status === 401) {
    // Token geçersiz — bağlantıyı temizle
    await admin.from('spotify_connections').delete().eq('user_id', user_id);
    await admin.from('spotify_now_playing').delete().eq('user_id', user_id);
    return json({ playing: false, reason: 'token_invalid' });
  }

  if (nowPlayingRes.status === 403) {
    // Spotify uygulaması development modunda VEYA scope eksik.
    // Bağlantıyı silmeden sadece bildir (token geçerli, kısıtlama var).
    const body = await nowPlayingRes.text().catch(() => '');
    console.warn('[spotify-token] currently-playing 403:', body);
    return json({ playing: false, reason: 'forbidden', status: 403 });
  }

  if (nowPlayingRes.status === 429) {
    // Rate limit — Retry-After başlığını oku
    const retryAfter = nowPlayingRes.headers.get('Retry-After');
    console.warn('[spotify-token] Rate limited. Retry-After:', retryAfter);
    return json({ playing: false, reason: 'rate_limited', retry_after: retryAfter ? parseInt(retryAfter, 10) : 30 });
  }

  if (!nowPlayingRes.ok) {
    const body = await nowPlayingRes.text().catch(() => '');
    console.error(`[spotify-token] currently-playing unexpected ${nowPlayingRes.status}:`, body);
    return json({ playing: false, reason: 'api_error', status: nowPlayingRes.status });
  }

  const text = await nowPlayingRes.text();
  if (!text) return json({ playing: false });

  const data = JSON.parse(text);
  if (!data.item || data.item.type !== 'track') {
    await admin.from('spotify_now_playing').upsert({
      user_id,
      is_playing: false,
      track_name: null,
      artist_name: null,
      album_name: null,
      album_art_url: null,
      track_url: null,
      progress_ms: 0,
      duration_ms: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return json({ playing: false });
  }

  const track = data.item;
  const nowPlayingData = {
    user_id,
    is_playing: data.is_playing,
    track_name: track.name,
    artist_name: track.artists?.map((a: any) => a.name).join(', ') || '',
    album_name: track.album?.name || '',
    album_art_url: track.album?.images?.[0]?.url || null,
    track_url: track.external_urls?.spotify || null,
    progress_ms: data.progress_ms || 0,
    duration_ms: track.duration_ms || 0,
    updated_at: new Date().toISOString(),
  };

  await admin.from('spotify_now_playing').upsert(nowPlayingData, { onConflict: 'user_id' });

  return json({ playing: data.is_playing, track_name: track.name });
}

async function controlPlayback(user_id: string, command: string): Promise<Response> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const accessToken = await getValidAccessToken(admin, user_id);

  if (!accessToken) return json({ error: 'no_connection' }, 404);

  let url = '';
  let method = 'PUT';

  if (command === 'play') {
    url = 'https://api.spotify.com/v1/me/player/play';
  } else if (command === 'pause') {
    url = 'https://api.spotify.com/v1/me/player/pause';
  } else if (command === 'next') {
    url = 'https://api.spotify.com/v1/me/player/next';
    method = 'POST';
  } else if (command === 'prev') {
    url = 'https://api.spotify.com/v1/me/player/previous';
    method = 'POST';
  } else {
    return json({ error: 'Unknown command' }, 400);
  }

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Length': '0' },
  });

  if (res.status === 204 || res.ok) {
    return json({ success: true });
  }
  if (res.status === 403) {
    return json({ error: 'premium_required' }, 403);
  }
  if (res.status === 404) {
    return json({ error: 'no_active_device' }, 404);
  }
  return json({ error: 'control_failed', status: res.status }, 500);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { action } = body;

  if (action === 'store') {
    return storeTokens(body);
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  if (action === 'refresh') {
    return refreshToken(userId);
  }

  if (action === 'poll') {
    return pollNowPlaying(userId);
  }

  if (action === 'control') {
    return controlPlayback(userId, body.command);
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
