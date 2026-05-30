import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Bu Edge Function pg_cron'un alternatifidir.
// Supabase Dashboard → Edge Functions → Schedules sekmesinden
// "*/5 * * * *" cron ile zamanlanabilir.
// Veya harici bir cron servisi (GitHub Actions vb.) şu header ile çağırabilir:
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Sadece service role key ile çağrılabilir (güvenlik)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // reset_stale_online_statuses() — SQL migration ile oluşturuldu
    const { data, error } = await supabase.rpc('reset_stale_online_statuses');

    if (error) {
      console.error('reset_stale_online_statuses error:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updatedCount = data as number ?? 0;
    console.log(`Stale status reset: ${updatedCount} kullanıcı offline yapıldı.`);

    return new Response(
      JSON.stringify({ success: true, updated: updatedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
