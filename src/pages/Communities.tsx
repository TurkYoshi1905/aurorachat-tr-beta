import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Search, Users, Compass, ArrowLeft, CheckCircle2, Loader2,
  Gamepad2, Cpu, Music, Palette, Dumbbell, FlaskConical, BookOpen, Globe, Sparkles,
} from 'lucide-react';

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
  { id: null,        key: 'all',       label: 'Tümü',       emoji: '🌐', Icon: Globe },
  { id: 'gaming',   key: 'games',     label: 'Oyun',        emoji: '🎮', Icon: Gamepad2 },
  { id: 'tech',     key: 'tech',      label: 'Teknoloji',   emoji: '💻', Icon: Cpu },
  { id: 'music',    key: 'music',     label: 'Müzik',       emoji: '🎵', Icon: Music },
  { id: 'art',      key: 'art',       label: 'Sanat',       emoji: '🎨', Icon: Palette },
  { id: 'sports',   key: 'sports',    label: 'Spor',        emoji: '⚽', Icon: Dumbbell },
  { id: 'science',  key: 'science',   label: 'Bilim',       emoji: '🔬', Icon: FlaskConical },
  { id: 'education',key: 'education', label: 'Eğitim',      emoji: '📚', Icon: BookOpen },
  { id: 'other',    key: 'other',     label: 'Diğer',       emoji: '✨', Icon: Sparkles },
];

const CATEGORY_GRADIENTS: Record<string, string> = {
  gaming:    'from-violet-600/20 to-indigo-600/10',
  tech:      'from-cyan-600/20 to-blue-600/10',
  music:     'from-pink-600/20 to-rose-600/10',
  art:       'from-orange-600/20 to-yellow-600/10',
  sports:    'from-emerald-600/20 to-teal-600/10',
  science:   'from-blue-600/20 to-cyan-600/10',
  education: 'from-amber-600/20 to-orange-600/10',
  other:     'from-primary/20 to-violet-600/10',
};

const Communities = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
          toast.error(t('communities.joinError'));
        }
      } else {
        setJoinedIds(prev => new Set([...prev, server.id]));
        toast.success(t('communities.joinedServer', { name: server.name }));
        navigate('/');
      }
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full bg-violet-500/6 blur-3xl animate-pulse" style={{ animationDuration: '9s' }} />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-cyan-500/5 blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/15 flex items-center justify-center border border-primary/20 shrink-0">
              <Compass className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground leading-tight">{t('communities.title')}</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">{servers.length > 0 ? t('communities.listingCount', { n: servers.length }) : t('communities.browse')}</p>
            </div>
          </div>
          {/* Search inline */}
          <div className="relative max-w-xs w-full hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('communities.searchPlaceholder')}
              className="w-full h-8 text-sm bg-secondary/50 border border-border/50 rounded-xl px-3 pl-8 outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Mobile search */}
        <div className="relative sm:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('communities.searchPlaceholder')}
            className="w-full h-10 text-sm bg-secondary/50 border border-border/50 rounded-xl px-3 pl-9 outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORIES.map(cat => {
            const isActive = category === cat.id;
            return (
              <button
                key={String(cat.id)}
                onClick={() => setCategory(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-[1.03]'
                    : 'bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary/70 hover:text-foreground hover:border-border'
                }`}
              >
                <span className="text-sm leading-none">{cat.emoji}</span>
                <span>{t(`communities.${cat.key}`) || cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Server grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">{t('communities.loading')}</p>
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border/50">
              <Compass className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">{t('communities.notFound')}</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">
                {search ? t('communities.tryDifferent') : t('communities.noPublicServers')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {servers.map(server => {
              const isJoined = joinedIds.has(server.id);
              const isJoining = joining === server.id;
              const catGradient = server.community_category
                ? (CATEGORY_GRADIENTS[server.community_category] || 'from-primary/20 to-violet-600/10')
                : 'from-primary/15 to-secondary/30';
              const catInfo = CATEGORIES.find(c => c.id === server.community_category);

              return (
                <div
                  key={server.id}
                  className="group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  {/* Gradient banner */}
                  <div className={`h-16 bg-gradient-to-br ${catGradient} relative overflow-hidden shrink-0`}>
                    {server.icon_url && (
                      <img
                        src={server.icon_url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-15 scale-110 blur-sm"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/60" />
                    {catInfo && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-background/30 backdrop-blur-sm text-foreground/70 border border-border/30 flex items-center gap-1">
                          <span className="text-xs">{catInfo.emoji}</span>
                          {t(`communities.${catInfo.key}`) || catInfo.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="px-4 pb-4 -mt-6 flex-1 flex flex-col gap-3">
                    {/* Server icon */}
                    <div className="w-12 h-12 rounded-xl border-2 border-card bg-secondary flex items-center justify-center overflow-hidden shadow-lg shrink-0 ring-1 ring-border/30 group-hover:ring-primary/30 transition-all">
                      {server.icon_url ? (
                        <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-black text-foreground">
                          {server.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-bold text-sm text-foreground leading-tight truncate">{server.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {server.community_description || t('communities.noDescription')}
                      </p>
                    </div>

                    {/* Footer: members + action */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span className="font-medium text-foreground">{server.member_count.toLocaleString('tr-TR')}</span>
                          <span>{t('communities.members')}</span>
                        </span>
                      </div>

                      {isJoined ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="w-3 h-3" /> {t('communities.joined')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJoin(server)}
                          disabled={isJoining}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60 shadow-sm shadow-primary/25"
                        >
                          {isJoining ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            t('communities.join')
                          )}
                        </button>
                      )}
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
