import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/bot-api/, '').replace(/^\/functions\/v1\/bot-api/, '');

  if (path !== '/me' && path !== '') {
    return new Response(JSON.stringify({ error: 'Not found', hint: 'Available: GET /me' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bot ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized', hint: 'Use Authorization: Bot YOUR_BOT_TOKEN' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(4).trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized', hint: 'Token is empty' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('validate_bot_token', { p_token: token });

  if (error || !data || data.length === 0) {
    return new Response(JSON.stringify({ error: 'Unauthorized', hint: 'Invalid or expired bot token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const bot = data[0];

  const { count: serverCount } = await supabase
    .from('server_bots')
    .select('*', { count: 'exact', head: true })
    .eq('bot_id', bot.bot_id);

  return new Response(JSON.stringify({
    bot_id: bot.bot_id,
    bot_name: bot.bot_name,
    bot_username: bot.bot_username,
    is_public: bot.is_public,
    avatar_url: bot.avatar_url,
    commands: bot.commands ?? [],
    server_count: serverCount ?? 0,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
