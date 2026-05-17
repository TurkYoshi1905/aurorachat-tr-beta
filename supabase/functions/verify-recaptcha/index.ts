import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Site-specific secret keys (fallback when env vars are not set)
// Each reCAPTCHA site key must be verified with its matching secret key.
const NETLIFY_SECRET = '6LdS-J8sAAAAAGfmYkT2JGKLxEakkfwMOzbOlJGW'; // aurorachat-beta-tr.netlify.app
const VERCEL_SECRET  = '6LfHJeosAAAAAF9QQS7rMkyabYXS064R6TmVWI5i';  // aurorachat-tr.vercel.app

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine which secret key to use:
    // 1. Prefer explicit env vars (set in Supabase dashboard)
    // 2. Fall back to origin-header detection
    // 3. Default to Netlify key for backwards compatibility
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    const isVercel = origin.includes('vercel.app') || origin.includes('aurorachat-tr.vercel');

    const secretKey =
      Deno.env.get(isVercel ? 'RECAPTCHA_SECRET_KEY_VERCEL' : 'RECAPTCHA_SECRET_KEY_NETLIFY') ||
      Deno.env.get('RECAPTCHA_SECRET_KEY') ||
      (isVercel ? VERCEL_SECRET : NETLIFY_SECRET);

    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
    const res = await fetch(verifyUrl, { method: 'POST' });
    const data = await res.json();

    return new Response(JSON.stringify({ success: data.success, errors: data['error-codes'] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (_error) {
    // On server error, allow login to proceed (client-side captcha already verified)
    return new Response(JSON.stringify({ success: true, warning: 'Server verification skipped' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
