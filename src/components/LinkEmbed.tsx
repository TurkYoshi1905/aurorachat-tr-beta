import { useState, useEffect, useRef } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LinkEmbedProps {
  url: string;
}

interface Preview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  favicon: string | null;
  type: string | null;
}

const CACHE_PREFIX = 'aurora_link_preview_v1:';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h client cache

const readCache = (url: string): Preview | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const { ts, preview } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return preview as Preview;
  } catch { return null; }
};

const writeCache = (url: string, preview: Preview) => {
  try {
    localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({ ts: Date.now(), preview }));
  } catch { /* quota exceeded — ignore */ }
};

const ytId = (url: string): string | null => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
    }
  } catch { /* ignore */ }
  return null;
};

const LinkEmbed = ({ url }: LinkEmbedProps) => {
  const [preview, setPreview] = useState<Preview | null>(() => readCache(url));
  const [hidden, setHidden] = useState(false);
  const [playYouTube, setPlayYouTube] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const cached = readCache(url);
    if (cached) { setPreview(cached); return; }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
        if (cancelled) return;
        if (error || !data?.preview) {
          setHidden(true);
          return;
        }
        const p = data.preview as Preview;
        // If no useful data at all, hide
        if (!p.title && !p.description && !p.image) {
          setHidden(true);
          return;
        }
        setPreview(p);
        writeCache(url, p);
      } catch {
        if (!cancelled) setHidden(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  if (hidden) return null;

  const vid = ytId(url);
  const isYouTube = !!vid;

  // ── YouTube: inline player on click ────────────────────────────────────────
  if (isYouTube) {
    const thumb = preview?.image || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
    const title = preview?.title || 'YouTube videosu';
    const author = preview?.description || 'YouTube';

    if (playYouTube) {
      return (
        <div className="mt-1.5 max-w-md w-full rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="px-3 py-2 text-xs text-white/60 flex items-center gap-2 bg-[#0f0f0f]">
            <img src="https://www.youtube.com/favicon.ico" alt="" className="w-3.5 h-3.5" />
            <span className="truncate flex-1">{title}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">YouTube'da aç</a>
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setPlayYouTube(true)}
        className="mt-1.5 max-w-md w-full text-left group block rounded-xl overflow-hidden bg-secondary/50 hover:bg-secondary/80 ring-1 ring-white/10 transition-colors"
        data-testid="link-embed-youtube"
      >
        <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }}>
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/15 transition-colors">
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
              <Play className="w-7 h-7 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        <div className="px-3 py-2 flex items-center gap-2">
          <img src="https://www.youtube.com/favicon.ico" alt="" className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">YouTube</div>
            <div className="text-sm font-semibold text-foreground truncate">{title}</div>
            {author && <div className="text-xs text-muted-foreground truncate">{author}</div>}
          </div>
        </div>
      </button>
    );
  }

  // ── Generic OG preview ────────────────────────────────────────────────────
  if (!preview) {
    // Skeleton while fetching
    return (
      <div className="mt-1.5 max-w-md w-full rounded-lg bg-secondary/40 border-l-4 border-primary/40 px-3 py-2.5 animate-pulse">
        <div className="h-3 w-20 bg-white/10 rounded mb-1.5" />
        <div className="h-3.5 w-3/4 bg-white/15 rounded" />
      </div>
    );
  }

  const hasImage = !!preview.image;
  const fav = preview.favicon || `https://www.google.com/s2/favicons?sz=32&domain=${(() => { try { return new URL(url).hostname; } catch { return ''; } })()}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex flex-col max-w-md w-full bg-secondary/50 hover:bg-secondary/80 border-l-4 border-primary rounded-r-lg overflow-hidden transition-colors group"
      data-testid="link-embed-generic"
    >
      <div className="px-3 py-2.5 flex gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <img
              src={fav}
              alt=""
              className="w-4 h-4 rounded-sm shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
              {preview.site_name || 'Bağlantı'}
            </span>
          </div>
          {preview.title && (
            <p className="text-sm font-semibold text-primary leading-snug line-clamp-2">{preview.title}</p>
          )}
          {preview.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-3">{preview.description}</p>
          )}
        </div>
        {hasImage && (
          <img
            src={preview.image!}
            alt=""
            loading="lazy"
            className="w-16 h-16 rounded-md object-cover shrink-0 ring-1 ring-white/10"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
      </div>
    </a>
  );
};

export default LinkEmbed;
