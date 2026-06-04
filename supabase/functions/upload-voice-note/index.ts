import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'voice-notes';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Kullanıcıyı doğrula (anon key ile)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Kullanıcı JWT'sini anon client ile doğrula
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Service role client — RLS bypass
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Bucket yoksa oluştur
  const { data: buckets } = await adminClient.storage.listBuckets();
  const bucketExists = buckets?.some((b: { id: string }) => b.id === BUCKET);
  if (!bucketExists) {
    await adminClient.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac'],
    });
  }

  // Form verisini oku
  let audioBlob: Blob;
  let uploadPath: string;
  let contentType = 'audio/webm';

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const pathField = formData.get('path') as string | null;
    const mimeField = formData.get('mime') as string | null;

    if (!audioFile || !(audioFile instanceof File || audioFile instanceof Blob)) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    audioBlob = audioFile as Blob;
    contentType = mimeField ?? audioBlob.type ?? 'audio/webm';
    const ext = contentType.includes('ogg') ? 'ogg' : 'webm';
    uploadPath = pathField ?? `${user.id}/voice_${Date.now()}.${ext}`;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Service role ile yükle — RLS bypass
  const arrayBuffer = await audioBlob.arrayBuffer();
  const { data, error: uploadErr } = await adminClient.storage
    .from(BUCKET)
    .upload(uploadPath, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadErr) {
    return new Response(JSON.stringify({ error: uploadErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(data.path);

  return new Response(JSON.stringify({ url: publicUrl, path: data.path }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
