import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Unicode-safe base64url encoder (handles Turkish and other non-ASCII characters)
function base64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateToken(
  roomName: string,
  identity: string,
  name: string,
  metadata: string,
): Promise<string> {
  const apiKey = Deno.env.get('LIVEKIT_API_KEY') ?? '';
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET') ?? '';

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit credentials not configured on server');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: apiKey,
    sub: identity,
    nbf: now,
    exp: now + 7200,
    name,
    metadata,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(signature)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { roomName, participantIdentity, participantName, metadata } = body;

    if (!roomName || !participantIdentity) {
      return new Response(
        JSON.stringify({ error: 'roomName and participantIdentity are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = await generateToken(
      roomName,
      participantIdentity,
      participantName || participantIdentity,
      metadata || '{}',
    );

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
