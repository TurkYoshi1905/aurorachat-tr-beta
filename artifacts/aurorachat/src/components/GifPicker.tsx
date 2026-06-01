import { useState, useCallback, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Loader2 } from 'lucide-react';

const KLIPY_API_KEY = 'E6RZbcepfozBphq950USF4B22DOgSzFjZfry0uXd7w2GalYSZjkxDW539J538VaN';
const BASE_URL = 'https://api.klipy.com/v2';

interface GifItem {
  id: string;
  title: string;
  preview: string;
  url: string;
}

interface GifPickerProps {
  onGifSelect: (gifUrl: string) => void;
  children?: React.ReactNode;
}

const mapResults = (results: any[]): GifItem[] =>
  (results || [])
    .filter((g) => g?.media_formats)
    .map((g) => ({
      id: String(g.id),
      title: g.title || '',
      preview: g.media_formats?.tinygif?.url || g.media_formats?.mediumgif?.url || g.media_formats?.gif?.url || '',
      url: g.media_formats?.gif?.url || g.media_formats?.mediumgif?.url || g.url || '',
    }))
    .filter((g) => g.preview && g.url);

const GifPicker = ({ onGifSelect, children }: GifPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/featured?key=${KLIPY_API_KEY}&limit=24`);
      const json = await res.json();
      setGifs(mapResults(json.results));
    } catch {
      setGifs([]);
    }
    setLoading(false);
  }, []);

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) { fetchTrending(); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/search?key=${KLIPY_API_KEY}&q=${encodeURIComponent(query.trim())}&limit=24`);
      const json = await res.json();
      setGifs(mapResults(json.results));
    } catch {
      setGifs([]);
    }
    setLoading(false);
  }, [fetchTrending]);

  useEffect(() => {
    if (open) fetchTrending();
  }, [open, fetchTrending]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGifs(value), 400);
  };

  const handleSelect = (gif: GifItem) => {
    onGifSelect(gif.url);
    setOpen(false);
    setSearch('');
    setGifs([]);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSearch(''); setGifs([]); } }}>
      <PopoverTrigger asChild>
        {children || (
          <button className="hover:text-foreground transition-colors text-muted-foreground">
            <span className="text-xs font-bold opacity-70 hover:opacity-100 transition-opacity">GIF</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover border-border" side="top" align="end">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="GIF ara..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="h-64 overflow-y-auto scrollbar-thin p-2">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && gifs.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              GIF bulunamadı
            </div>
          )}
          {!loading && gifs.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleSelect(gif)}
                  className="rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all bg-secondary/30"
                >
                  <img
                    src={gif.preview}
                    alt={gif.title}
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">Powered by KLIPY</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default GifPicker;
