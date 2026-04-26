import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: ownedServers } = await adminClient
      .from('servers')
      .select('id')
      .eq('owner_id', user.id);

    if (ownedServers && ownedServers.length > 0) {
      const serverIds = ownedServers.map((s: { id: string }) => s.id);
      await adminClient.from('servers').delete().in('id', serverIds);
    }

    const deletedLabel = `Deleted User (${user.id.slice(0, 8)})`;

    const { error: messagesError } = await adminClient
      .from('messages')
      .update({ user_id: null, deleted_user_id: user.id, author_name: deletedLabel })
      .eq('user_id', user.id);

    if (messagesError) {
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: directMessagesError } = await adminClient
      .from('direct_messages')
      .update({ sender_id: null, sender_deleted_user_id: user.id })
      .eq('sender_id', user.id);

    if (directMessagesError) {
      return new Response(JSON.stringify({ error: directMessagesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient
      .from('profiles')
      .update({
        username: `deleted_${user.id.slice(0, 8)}`,
        display_name: deletedLabel,
        avatar_url: null,
        bio: null,
        status: 'offline',
      })
      .eq('id', user.id);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
