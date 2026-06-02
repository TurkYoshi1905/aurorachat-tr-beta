import { useState, useCallback } from 'react';
import { Search, X, Filter, Calendar, User, FileText, Pin, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/i18n';

interface SearchResult {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  channel_id: string;
  attachments?: string[];
  is_pinned?: boolean;
}

interface MessageSearchPanelProps {
  serverId: string;
  channelId: string;
  channelName: string;
  members?: { id: string; name: string }[];
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

const MessageSearchPanel = ({ serverId, channelId, channelName, members = [], onClose, onJumpToMessage }: MessageSearchPanelProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [filterSender, setFilterSender] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'files' | 'pinned' | 'links'>('all');
  const [searchAllChannels, setSearchAllChannels] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !filterSender && !filterDateFrom && !filterDateTo && filterType === 'all') return;
    setLoading(true);
    setSearched(true);

    let q = supabase
      .from('messages')
      .select('id, author_name, content, inserted_at, channel_id, attachments, is_pinned')
      .eq('server_id', serverId)
      .order('inserted_at', { ascending: false })
      .limit(50);

    if (!searchAllChannels) {
      q = q.eq('channel_id', channelId);
    }

    if (query.trim()) {
      q = q.ilike('content', `%${query.trim()}%`);
    }

    if (filterSender.trim()) {
      q = q.ilike('author_name', `%${filterSender.trim()}%`);
    }

    if (filterDateFrom) {
      q = q.gte('inserted_at', new Date(filterDateFrom).toISOString());
    }

    if (filterDateTo) {
      const endDate = new Date(filterDateTo);
      endDate.setHours(23, 59, 59, 999);
      q = q.lte('inserted_at', endDate.toISOString());
    }

    if (filterType === 'pinned') {
      q = q.eq('is_pinned', true);
    }

    const { data } = await q;

    let filtered = data || [];

    if (filterType === 'files') {
      filtered = filtered.filter(m => m.attachments && (m.attachments as string[]).length > 0);
    }

    if (filterType === 'links') {
      filtered = filtered.filter(m => /https?:\/\/\S+/.test(m.content));
    }

    setResults(filtered.map(r => ({
      id: r.id,
      author_name: r.author_name || '',
      content: r.content,
      created_at: r.inserted_at,
      channel_id: r.channel_id,
      attachments: r.attachments as string[] | undefined,
      is_pinned: r.is_pinned || false,
    })));
    setLoading(false);
  }, [query, serverId, channelId, filterSender, filterDateFrom, filterDateTo, filterType, searchAllChannels]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const clearFilters = () => {
    setFilterSender('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterType('all');
    setSearchAllChannels(false);
  };

  const hasActiveFilters = filterSender || filterDateFrom || filterDateTo || filterType !== 'all' || searchAllChannels;

  return (
    <div className="w-full border-l border-border bg-background flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Search className="w-4 h-4" />
          Mesaj Ara
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2 border-b border-border">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mesajlarda ara..."
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button size="sm" onClick={handleSearch} className="h-8 px-3" disabled={loading}>
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-1 text-xs transition-colors ${hasActiveFilters ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                <Filter className="w-3 h-3" />
                Filtreler
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-72 p-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                  <User className="w-3 h-3" /> Gönderen
                </label>
                <Input value={filterSender} onChange={(e) => setFilterSender(e.target.value)} placeholder="Kullanıcı adı..." className="h-7 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3" /> Başlangıç
                  </label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3" /> Bitiş
                  </label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-7 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">İçerik Türü</label>
                <div className="flex flex-wrap gap-1">
                  {[
                    { value: 'all' as const, label: 'Tümü', icon: null },
                    { value: 'files' as const, label: 'Dosyalar', icon: FileText },
                    { value: 'pinned' as const, label: 'Sabitlenmiş', icon: Pin },
                    { value: 'links' as const, label: 'Linkler', icon: Link2 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterType(opt.value)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${filterType === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                    >
                      {opt.icon && <opt.icon className="w-3 h-3" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={searchAllChannels} onChange={(e) => setSearchAllChannels(e.target.checked)} className="rounded" />
                Tüm kanallarda ara
              </label>

              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 text-xs w-full">
                  Filtreleri Temizle
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {searched && (
            <span className="text-xs text-muted-foreground">{results.length} sonuç</span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {!searched ? (
          <div className="p-6 text-center text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Mesajlarda arama yapın</p>
            <p className="text-xs mt-1">Filtreler ile sonuçları daraltabilirsiniz</p>
          </div>
        ) : loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Aranıyor...</div>
        ) : results.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-sm">Sonuç bulunamadı</p>
            <p className="text-xs mt-1">Farklı bir arama terimi veya filtre deneyin</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => onJumpToMessage?.(r.id)}
                className="w-full text-left p-2.5 rounded-md hover:bg-secondary/80 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-foreground">{r.author_name}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(r.created_at)}</span>
                  {r.is_pinned && <Pin className="w-2.5 h-2.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">{r.content}</p>
                {r.attachments && (r.attachments as string[]).length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <FileText className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary">{(r.attachments as string[]).length} dosya</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default MessageSearchPanel;
