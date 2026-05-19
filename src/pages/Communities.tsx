import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, Users, Compass, ArrowLeft, Hash, ChevronRight, Loader2, Globe } from 'lucide-react';

interface CommunityServer {
  id: string;
  name: string;
  community_description: string | null;
  community_category: string | null;
  icon_url: string | null;
  member_count: number;
  created_at: string;
}

const CATEGORIES = [
  { id: null, label: 'Tümü' },
  { id: 'gaming', label: 'Oyun' },
  { id: 'tech', label: 'Teknoloji' },
  { id: 'music', label: 'Müzik' },
  { id: 'art', label: 'Sanat' },
  { id: 'sports', label: 'Spor' },
  { id: 'science', label: 'Bilim' },
  { id: 'education', label: 'Eğitim' },
  { id: 'other', label: 'Diğer' },
];

const Communities = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [servers, setServers] = useState<CommunityServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('get_community_servers', {
        p_search: search || null,
        p_category: category || null,
        p_limit: 30,
        p_offset: 0,
      });
      if (error) {
        // Fallback: direct query if RPC not yet applied
        const q = supabase
          .from('servers')
          .select('id, name, community_description, community_category, icon, created_at')
          .eq('is_community' as any, true)
          .order('created_at', { ascending: false })
          .limit(30);
        if (search) (q as any).ilike('name', `%${search}%`);
        const { data: fallback } = await q;
        setServers((fallback || []).map((s: any) => ({ ...s, icon_url: s.icon, member_count: 0 })));
      } else {
        setServers(data || []);
      }
    } catch {
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const t = setTimeout(fetchCommunities, 300);
    return () => clearTimeout(t);
  }, [fetchCommunities]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setJoinedIds(new Set(data.map((m: any) => m.server_id)));
      });
  }, [user]);

  const handleJoin = async (server: CommunityServer) => {
    if (!user) { navigate('/login'); return; }
    if (joinedIds.has(server.id)) {
      navigate('/');
      return;
    }
    setJoining(server.id);
    try {
      const { error } = await supabase.from('server_members').insert({ server_id: server.id, user_id: user.id } as any);
      if (error) {
        if (error.code === '23505') {
          setJoinedIds(prev => new Set([...prev, server.id]));
          navigate('/');
        } else {
          toast.error('Sunucuya katılınamadı');
        }
      } else {
        setJoinedIds(prev => new Set([...prev, server.id]));
        toast.success(`${server.name} sunucusuna katıldın!`);
        navigate('/');
      }
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Compass className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-lg font-bold text-foreground">Sunucuları Keşfet</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sunucu ara..."
            className="pl-9"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORIES.map(cat => (
            <button
              key={String(cat.id)}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Server grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Compass className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Topluluk bulunamadı</p>
            <p className="text-xs text-muted-foreground/70">
              {search ? 'Farklı bir arama dene' : 'Henüz herkese açık sunucu yok. Sunucu sahipleri ayarlardan topluluklarını açabilir.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {servers.map(server => {
              const isJoined = joinedIds.has(server.id);
              const isJoining = joining === server.id;
              return (
                <div
                  key={server.id}
                  className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors group"
                >
                  {/* Card header */}
                  <div className="relative h-16 bg-secondary/60" />
                  <div className="px-4 pb-4">
                    <div className="flex items-end gap-3 -mt-6 mb-3">
                      <div className="w-12 h-12 rounded-xl border-2 border-background bg-secondary flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
                        {server.icon_url ? (
                          <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-foreground">{server.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <p className="font-semibold text-foreground text-sm truncate">{server.name}</p>
                        {server.community_category && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            <Hash className="w-2.5 h-2.5" />
                            {CATEGORIES.find(c => c.id === server.community_category)?.label || server.community_category}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5rem]">
                      {server.community_description || 'Açıklama yok'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{server.member_count.toLocaleString('tr-TR')} üye</span>
                      </div>
                      <Button
                        size="sm"
                        variant={isJoined ? 'outline' : 'default'}
                        className="h-7 px-3 text-xs gap-1"
                        onClick={() => handleJoin(server)}
                        disabled={isJoining}
                      >
                        {isJoining ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isJoined ? (
                          <>Giriş Yap <ChevronRight className="w-3 h-3" /></>
                        ) : (
                          'Katıl'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Communities;
