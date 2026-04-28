import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CACHE_TTL_DAYS = 7;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

const sha1 = async (s: string): Promise<string> => {
  const bytes = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

const META_RE = /<meta\s+([^>]+?)\/?>/gi;
const ATTR_RE = /([a-z\-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const LINK_ICON_RE = /<link\s+([^>]*?)\/?>/gi;

interface MetaTag { name?: string; property?: string; content?: string; itemprop?: string; }

const parseMeta = (html: string): MetaTag[] => {
  const tags: MetaTag[] = [];
  let m: RegExpExecArray | null;
  META_RE.lastIndex = 0;
  while ((m = META_RE.exec(html))) {
    const attrText = m[1];
    const attrs: Record<string, string> = {};
    let am: RegExpExecArray | null;
    ATTR_RE.lastIndex = 0;
    while ((am = ATTR_RE.exec(attrText))) {
      const key = am[1].toLowerCase();
      const val = am[3] ?? am[4] ?? am[5] ?? '';
      attrs[key] = val;
    }
    tags.push(attrs);
  }
  return tags;
};

const findMeta = (tags: MetaTag[], keys: string[]): string | undefined => {
  for (const t of tags) {
    const cand = (t.property || t.name || t.itemprop || '').toLowerCase();
    if (keys.includes(cand) && t.content) return decodeEntities(t.content);
  }
  return undefined;
};

const findFavicon = (html: string, baseUrl: URL): string | undefined => {
  let m: RegExpExecArray | null;
  LINK_ICON_RE.lastIndex = 0;
  while ((m = LINK_ICON_RE.exec(html))) {
    const attrText = m[1];
    const attrs: Record<string, string> = {};
    let am: RegExpExecArray | null;
    ATTR_RE.lastIndex = 0;
    while ((am = ATTR_RE.exec(attrText))) {
      const key = am[1].toLowerCase();
      const val = am[3] ?? am[4] ?? am[5] ?? '';
      attrs[key] = val;
    }
    const rel = (attrs['rel'] || '').toLowerCase();
    if ((rel.includes('icon') || rel.includes('shortcut')) && attrs['href']) {
      try { return new URL(attrs['href'], baseUrl).toString(); } catch { /* ignore */ }
    }
  }
  return undefined;
};

const absUrl = (raw: string | undefined, base: URL): string | undefined => {
  if (!raw) return undefined;
  try { return new URL(raw, base).toString(); } catch { return raw; }
};

interface PreviewResult {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  favicon: string | null;
  type: string | null;
}

// YouTube special handling — extract video ID
const ytId = (url: URL): string | null => {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
  if (host.endsWith('youtube.com')) {
    if (url.pathname === '/watch') return url.searchParams.get('v');
    if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
  }
  return null;
};

const fetchHtml = async (url: string): Promise<{ html: string; finalUrl: string }> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Modern desktop UA gets richer OG tags; some sites cloak old UAs.
        'User-Agent': 'Mozilla/5.0 (compatible; AuroraChatBot/1.0; +https://aurorachat.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new Error('Non-HTML content');
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    try { reader.cancel(); } catch { /* ignore */ }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    return { html: new TextDecoder('utf-8', { fatal: false }).decode(buf), finalUrl: res.url };
  } finally { clearTimeout(timer); }
};

const buildPreview = async (rawUrl: string): Promise<PreviewResult> => {
  const u = new URL(rawUrl);
  // YouTube short-circuit — use noembed/oEmbed style data
  const vid = ytId(u);
  if (vid) {
    return {
      url: rawUrl,
      title: null, // filled in below from oembed
      description: null,
      image: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      site_name: 'YouTube',
      favicon: 'https://www.youtube.com/favicon.ico',
      type: `youtube:${vid}`,
    };
  }
  const { html, finalUrl } = await fetchHtml(rawUrl);
  const base = new URL(finalUrl);
  const tags = parseMeta(html);
  const title =
    findMeta(tags, ['og:title', 'twitter:title']) ??
    (TITLE_RE.exec(html)?.[1] ? decodeEntities(TITLE_RE.exec(html)![1].trim()) : null);
  const description =
    findMeta(tags, ['og:description', 'twitter:description', 'description']) ?? null;
  const image =
    absUrl(findMeta(tags, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']), base) ?? null;
  const siteName = findMeta(tags, ['og:site_name', 'application-name']) ?? base.hostname.replace(/^www\./, '');
  const favicon =
    findFavicon(html, base) ?? `https://www.google.com/s2/favicons?sz=64&domain=${base.hostname}`;
  const type = findMeta(tags, ['og:type']) ?? null;
  return {
    url: rawUrl,
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 600) : null,
    image,
    site_name: siteName,
    favicon,
    type,
  };
};

// YouTube oEmbed — title without scraping youtube.com (avoids cloaking)
const enrichYouTube = async (preview: PreviewResult): Promise<PreviewResult> => {
  if (!preview.type?.startsWith('youtube:')) return preview;
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(preview.url)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      preview.title = data.title || preview.title;
      preview.description = (data.author_name ? `${data.author_name}` : preview.description) || preview.description;
      if (data.thumbnail_url) preview.image = data.thumbnail_url;
    }
  } catch { /* ignore */ }
  return preview;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || url.length > 2048) {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return new Response(JSON.stringify({ error: 'Malformed url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return new Response(JSON.stringify({ error: 'Unsupported protocol' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const hash = await sha1(url);

    // 1) Try cache
    const { data: cached } = await supa
      .from('link_previews')
      .select('*')
      .eq('url_hash', hash)
      .maybeSingle();

    if (cached) {
      const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / 86400000;
      if (ageDays < CACHE_TTL_DAYS) {
        return new Response(JSON.stringify({ source: 'cache', preview: cached }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2) Build fresh preview
    let preview = await buildPreview(url);
    preview = await enrichYouTube(preview);

    // 3) Persist
    await supa.from('link_previews').upsert({
      url_hash: hash,
      url: preview.url,
      title: preview.title,
      description: preview.description,
      image: preview.image,
      site_name: preview.site_name,
      favicon: preview.favicon,
      type: preview.type,
      fetched_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ source: 'fresh', preview }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 200, // 200 with error so client doesn't show toast — just hides preview
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
