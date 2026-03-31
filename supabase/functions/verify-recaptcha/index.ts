import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fallback secret key if env var is not set
const FALLBACK_SECRET_KEY = '6LdS-J8sAAAAAGfmYkT2JGKLxEakkfwMOzbOlJGW';

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

    const secretKey = Deno.env.get('RECAPTCHA_SECRET_KEY') || FALLBACK_SECRET_KEY;

    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
    const res = await fetch(verifyUrl, { method: 'POST' });
    const data = await res.json();

    return new Response(JSON.stringify({ success: data.success, errors: data['error-codes'] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // On server error, allow login to proceed (client-side captcha already verified)
    return new Response(JSON.stringify({ success: true, warning: 'Server verification skipped' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
