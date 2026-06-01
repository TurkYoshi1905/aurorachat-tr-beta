import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Base64-URL helpers ────────────────────────────────────────────────────────
function b64UrlDecode(str: string): Uint8Array {
  const padded = str + '==='.slice((str.length + 3) % 4);
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ── DER signature → raw r||s (64 bytes) ──────────────────────────────────────
function derToRawSig(der: Uint8Array): Uint8Array {
  let pos = 2; // skip SEQUENCE tag + len
  const rLen = der[pos + 1]; pos += 2;
  const r = der.slice(pos, pos + rLen); pos += rLen;
  const sLen = der[pos + 1]; pos += 2;
  const s = der.slice(pos, pos + sLen);
  const raw = new Uint8Array(64);
  raw.set(r.slice(-32), 32 - Math.min(r.length, 32));
  raw.set(s.slice(-32), 64 - Math.min(s.length, 32));
  return raw;
}

// ── Import VAPID private key from raw bytes using JWK (reliable in Deno) ─────
// The VAPID public key is an uncompressed P-256 point: 0x04 || x(32) || y(32)
async function importVapidPrivateKey(privB64: string, pubB64: string): Promise<CryptoKey> {
  const pubRaw = b64UrlDecode(pubB64);
  // uncompressed point: first byte is 0x04 (65 bytes total)
  const x = b64UrlEncode(pubRaw.slice(1, 33));
  const y = b64UrlEncode(pubRaw.slice(33, 65));
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privB64, x, y, ext: true, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

// ── VAPID JWT (ES256) ─────────────────────────────────────────────────────────
async function buildVapidJwt(
  audience: string,
  subject: string,
  vapidPrivB64: string,
  vapidPubB64: string,
): Promise<string> {
  const enc = new TextEncoder();
  const header  = b64UrlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now     = Math.floor(Date.now() / 1000);
  const payload = b64UrlEncode(enc.encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const toSign  = `${header}.${payload}`;

  const privKey = await importVapidPrivateKey(vapidPrivB64, vapidPubB64);
  const sigDer  = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, enc.encode(toSign)));
  return `${toSign}.${b64UrlEncode(derToRawSig(sigDer))}`;
}

// ── HMAC-SHA-256 helper ───────────────────────────────────────────────────────
async function hmacKey(keyData: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

// ── Content encryption (RFC 8291, aesgcm) ────────────────────────────────────
function buildInfo(type: string, receiverKey: Uint8Array, senderKey: Uint8Array): Uint8Array {
  const enc      = new TextEncoder();
  const typeBytes = enc.encode(`Content-Encoding: ${type}\0`);
  const label    = enc.encode('P-256\0');
  const out = new Uint8Array(typeBytes.length + label.length + 2 + receiverKey.length + 2 + senderKey.length);
  let off = 0;
  out.set(typeBytes, off); off += typeBytes.length;
  out.set(label,     off); off += label.length;
  new DataView(out.buffer).setUint16(off, receiverKey.length, false); off += 2;
  out.set(receiverKey, off); off += receiverKey.length;
  new DataView(out.buffer).setUint16(off, senderKey.length, false); off += 2;
  out.set(senderKey, off);
  return out;
}

async function encryptPayload(
  p256dh: string,
  auth: string,
  plaintext: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc           = new TextEncoder();
  const authSecret    = b64UrlDecode(auth);
  const receiverPubRaw = b64UrlDecode(p256dh);

  const senderPair    = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPubRaw  = new Uint8Array(await crypto.subtle.exportKey('raw', senderPair.publicKey));
  const receiverPub   = await crypto.subtle.importKey('raw', receiverPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const sharedSecret  = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPub }, senderPair.privateKey, 256));
  const salt          = crypto.getRandomValues(new Uint8Array(16));

  const prkHmacKey = await hmacKey(authSecret);
  const prk        = new Uint8Array(await crypto.subtle.sign('HMAC', prkHmacKey, sharedSecret));

  const prkInfoKey = await hmacKey(prk);
  const authInfo   = enc.encode('Content-Encoding: auth\0');
  const ikm        = new Uint8Array(await crypto.subtle.sign('HMAC', prkInfoKey, concat(authInfo, new Uint8Array([1]))));

  const ikmHmacKey = await hmacKey(ikm);
  const cekInfo    = buildInfo('aesgcm', receiverPubRaw, senderPubRaw);
  const nonceInfo  = buildInfo('nonce',  receiverPubRaw, senderPubRaw);

  const cekOkm   = new Uint8Array(await crypto.subtle.sign('HMAC', ikmHmacKey, concat(cekInfo,   new Uint8Array([1]))));
  const nonceOkm = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(ikm), concat(nonceInfo, new Uint8Array([1]))));

  const cek   = cekOkm.slice(0, 16);
  const nonce = nonceOkm.slice(0, 12);

  const aesKey      = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const paddedBody  = concat(new Uint8Array([0, 0]), enc.encode(plaintext));
  const ciphertext  = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedBody));

  return { body: ciphertext, salt, serverPublicKey: senderPubRaw };
}

// ── Send a single Web Push notification ──────────────────────────────────────
async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<{ status: number }> {
  const url      = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await buildVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey);
  const { body, salt, serverPublicKey } = await encryptPayload(p256dh, auth, JSON.stringify(payload));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Authorization':    `vapid t=${jwt},k=${vapidPublicKey}`,
      'Encryption':       `salt=${b64UrlEncode(salt)}`,
      'Crypto-Key':       `dh=${b64UrlEncode(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      'TTL':              '86400',
      'Urgency':          'high',
    },
    body,
  });
  return { status: res.status };
}

// ── Edge Function entry point ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, title, body, data } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC   = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE  = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const VAPID_SUBJECT  = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@aurorachat.app';

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, auth, p256dh')
      .eq('user_id', user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload    = { title, body: body || '', data: data || {}, tag: `aurorachat-${Date.now()}` };
    let sent         = 0;
    const toRemove: string[] = [];

    for (const sub of subs) {
      try {
        const { status } = await sendPush(
          sub.endpoint, sub.p256dh, sub.auth,
          payload, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT,
        );
        if (status === 200 || status === 201 || status === 202) {
          sent++;
        } else if (status === 410 || status === 404 || status === 400 || status === 401 || status === 403) {
          toRemove.push(sub.endpoint);
        }
      } catch (_) {
        toRemove.push(sub.endpoint);
      }
    }

    if (toRemove.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', toRemove);
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
