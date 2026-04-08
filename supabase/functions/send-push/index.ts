import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Base64 URL helpers ─────────────────────────────────────────────────────────
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

// ── VAPID JWT ──────────────────────────────────────────────────────────────────
async function buildVapidJwt(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const enc = new TextEncoder();
  const header = b64UrlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64UrlEncode(enc.encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const toSign = `${header}.${payload}`;

  // Import raw 32-byte private key as ECDSA key via JWK
  const rawPriv = b64UrlDecode(privateKeyB64);
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256',
    d: b64UrlEncode(rawPriv),
    // Dummy x/y — will be replaced from actual key
    x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    y: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  };

  // Generate a key pair to get proper x/y, then override d
  const genPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const genPrivJwk = await crypto.subtle.exportKey('jwk', genPair.privateKey) as JsonWebKey;
  jwk.x = genPrivJwk.x!;
  jwk.y = genPrivJwk.y!;

  // Actually we need to import from raw key using pkcs8 wrapper
  const privKey = await importEcPrivateKey(rawPriv);

  const sigDer = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, enc.encode(toSign))
  );
  const sig = b64UrlEncode(derToRawSig(sigDer));
  return `${toSign}.${sig}`;
}

/** Import a 32-byte raw EC private key for ECDSA P-256 */
async function importEcPrivateKey(rawKey: Uint8Array): Promise<CryptoKey> {
  // PKCS#8 structure for EC P-256 private key
  // SEQ { INT 0, SEQ { OID ecPublicKey, OID prime256v1 }, OCTET { SEQ { INT 1, OCTET <key> } } }
  const ecPrivSeq = concat(
    new Uint8Array([0x30, 0x23, 0x02, 0x01, 0x01, 0x04, 0x20]),
    rawKey
  );
  const oidEcPublicKey = new Uint8Array([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
  const oidP256 = new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
  const algId = concat(new Uint8Array([0x30, oidEcPublicKey.length + oidP256.length]), oidEcPublicKey, oidP256);
  const privKeyOctet = concat(new Uint8Array([0x04, ecPrivSeq.length]), ecPrivSeq);
  const pkcs8Inner = concat(
    new Uint8Array([0x30, 0x02, 0x01, 0x00]),
    algId,
    new Uint8Array([0x04]), encLen(privKeyOctet.length), privKeyOctet
  );
  const pkcs8 = concat(new Uint8Array([0x30]), encLen(pkcs8Inner.length), pkcs8Inner);

  return crypto.subtle.importKey('pkcs8', pkcs8.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

function encLen(n: number): Uint8Array {
  if (n < 128) return new Uint8Array([n]);
  const bytes: number[] = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

/** Convert DER-encoded ECDSA signature to raw R||S (64 bytes) */
function derToRawSig(der: Uint8Array): Uint8Array {
  let i = 2;
  const rLen = der[i + 1]; const r = der.slice(i + 2, i + 2 + rLen); i += 2 + rLen;
  const sLen = der[i + 1]; const s = der.slice(i + 2, i + 2 + sLen);
  const raw = new Uint8Array(64);
  raw.set(r.slice(-32), 32 - Math.min(r.length, 32));
  raw.set(s.slice(-32), 64 - Math.min(s.length, 32));
  return raw;
}

// ── Content encryption (RFC 8291, aesgcm) ─────────────────────────────────────
async function encryptPayload(
  p256dh: string,
  auth: string,
  plaintext: string
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  const authSecret = b64UrlDecode(auth);
  const receiverPubRaw = b64UrlDecode(p256dh);

  const senderPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderPair.publicKey));
  const receiverPub = await crypto.subtle.importKey('raw', receiverPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPub }, senderPair.privateKey, 256)
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK via HMAC-SHA256(authSecret, sharedSecret)
  const prkHmacKey = await hmacKey(authSecret);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkHmacKey, sharedSecret));

  // Build info string: "Content-Encoding: auth\0"
  const prkInfoKey = await hmacKey(prk);
  const authInfo = enc.encode('Content-Encoding: auth\0');
  const ikm = new Uint8Array(await crypto.subtle.sign('HMAC', prkInfoKey, concat(authInfo, new Uint8Array([1]))));

  // Derive content encryption key and nonce
  const saltHmacKey = await hmacKey(salt);
  const ikmHmacKey = await hmacKey(ikm);

  const cekInfo = buildInfo('aesgcm', receiverPubRaw, senderPubRaw);
  const nonceInfo = buildInfo('nonce', receiverPubRaw, senderPubRaw);

  const cekOkm = new Uint8Array(await crypto.subtle.sign('HMAC', ikmHmacKey, concat(cekInfo, new Uint8Array([1]))));
  const nonceOkm = new Uint8Array(await crypto.subtle.sign('HMAC', (await hmacKey(ikm)), concat(nonceInfo, new Uint8Array([1]))));

  const cek = cekOkm.slice(0, 16);
  const nonce = nonceOkm.slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const paddedBody = concat(new Uint8Array([0, 0]), enc.encode(plaintext));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedBody));

  return { body: ciphertext, salt, serverPublicKey: senderPubRaw };
}

async function hmacKey(keyData: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

function buildInfo(type: string, receiverKey: Uint8Array, senderKey: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(`Content-Encoding: ${type}\0`);
  const label = enc.encode('P-256\0');
  const out = new Uint8Array(typeBytes.length + label.length + 2 + receiverKey.length + 2 + senderKey.length);
  let off = 0;
  out.set(typeBytes, off); off += typeBytes.length;
  out.set(label, off); off += label.length;
  new DataView(out.buffer).setUint16(off, receiverKey.length, false); off += 2;
  out.set(receiverKey, off); off += receiverKey.length;
  new DataView(out.buffer).setUint16(off, senderKey.length, false); off += 2;
  out.set(senderKey, off);
  return out;
}

// ── Send a single push notification ───────────────────────────────────────────
async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ status: number }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience, vapidSubject, vapidPrivateKey);
  const { body, salt, serverPublicKey } = await encryptPayload(p256dh, auth, JSON.stringify(payload));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'Encryption': `salt=${b64UrlEncode(salt)}`,
      'Crypto-Key': `dh=${b64UrlEncode(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      'TTL': '86400',
      'Urgency': 'high',
    },
    body,
  });
  return { status: res.status };
}

// ── Edge Function entry point ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, title, body, data } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@aurorachat.app';

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

    const payload = { title, body: body || '', data: data || {}, tag: `aurorachat-${Date.now()}` };
    let sent = 0;
    const toRemove: string[] = [];

    for (const sub of subs) {
      try {
        const { status } = await sendPush(
          sub.endpoint, sub.p256dh, sub.auth,
          payload, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
        );
        if (status === 201 || status === 200 || status === 202) {
          sent++;
        } else if (status === 410 || status === 404 || status === 400 || status === 401 || status === 403) {
          // Expired, unauthorized, or invalid subscription — remove it
          toRemove.push(sub.endpoint);
        }
      } catch (_) {
        // Network error — remove this subscription to prevent repeated failures
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
