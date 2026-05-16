import { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/i18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr as trLocale, enUS, ru as ruLocale, ja as jaLocale, de as deLocale } from 'date-fns/locale';
import { MessageSquare, Moon, Smile, Bot, Zap, Gem, Star, CalendarDays, Server, ShieldCheck, UserPlus, UserCheck, UserX, Smartphone, Tablet, ExternalLink, SkipBack, Play, Pause, SkipForward, User2, Cake, Crown, Gamepad2, Link2, Plus, Loader2, Check } from 'lucide-react';
import ConnectionsModal from './ConnectionsModal';
// Note: SkipBack, Play, Pause, SkipForward, ExternalLink kept for Spotify controls passed to ConnectionsModal
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import BlockConfirmModal from './BlockConfirmModal';
import { formatDuration } from '@/lib/spotify';
import { useSpotifyStatus } from '@/hooks/useSpotifyStatus';
import BotProfileModal from './BotProfileModal';

export const AURORA_BOT_ID = 'aurora-bot';

interface UserProfileCardProps {
  userId: string;
  serverId?: string;
  children: React.ReactNode;
  onSendMessage?: (userId: string) => void;
  status?: string;
  platform?: string;
  isBot?: boolean;
  botId?: string;
  botName?: string;
  botAvatarUrl?: string;
  side?: 'left' | 'right';
}

interface ProfileData {
  display_name: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  bio: string;
  banner_color: string;
  banner_url: string | null;
  has_premium_badge: boolean;
  has_basic_badge: boolean;
  custom_status: string | null;
  gender: string | null;
  birth_date: string | null;
  gender_visibility: string;
  birth_date_visibility: string;
  steam_id: string | null;
  steam_persona: string | null;
  steam_profile_url: string | null;
  steam_avatar_url: string | null;
  steam_game_name: string | null;
  spotify_display_name: string | null;
}

interface RoleData {
  name: string;
  color: string;
  gradient_end_color?: string | null;
  permissions?: Record<string, any>;
}

const dateLocaleMap: Record<string, any> = { tr: trLocale, en: enUS, az: trLocale, ru: ruLocale, ja: jaLocale, de: deLocale };

const statusLabel: Record<string, string> = {
  online: 'Çevrimiçi',
  idle: 'Boşta',
  dnd: 'Rahatsız Etme',
  offline: 'Çevrimdışı',
};

const statusDotClass: Record<string, string> = {
  online: 'bg-status-online',
  idle: 'bg-status-idle',
  dnd: 'bg-status-dnd',
  offline: 'bg-muted-foreground',
};

const CustomBotWrapper = ({ children, botId, botName, botAvatarUrl }: { children: React.ReactNode; botId: string; botName: string; botAvatarUrl?: string }) => {
  const [open, setOpen] = useState(false);
  const [botData, setBotData] = useState<any>(null);

  const handleClick = async () => {
    try {
      let data: any = null;
      if (botId) {
        const { data: d } = await (supabase as any).from('bots').select('id, name, username, description, avatar_url, owner_id').eq('id', botId).maybeSingle();
        data = d;
      }
      if (!data && botName) {
        const { data: d } = await (supabase as any).from('bots').select('id, name, username, description, avatar_url, owner_id').eq('name', botName).maybeSingle();
        data = d;
      }
      setBotData(data || { id: botId || botName, name: botName, username: botName?.toLowerCase().replace(/\s+/g, '_') || 'bot', description: null, avatar_url: botAvatarUrl || null, owner_id: '' });
    } catch {
      setBotData({ id: botId || botName, name: botName, username: botName?.toLowerCase().replace(/\s+/g, '_') || 'bot', description: null, avatar_url: botAvatarUrl || null, owner_id: '' });
    }
    setOpen(true);
  };

  return (
    <>
      <div onClick={handleClick} className="cursor-pointer">{children}</div>
      <BotProfileModal bot={botData} open={open} onClose={() => setOpen(false)} />
    </>
  );
};

const GenericBotProfileCard = ({ children, isMobile, botName, botAvatarUrl, botId }: { children: React.ReactNode; isMobile: boolean; botName: string; botAvatarUrl?: string; botId?: string }) => {
  const [open, setOpen] = useState(false);
  const [showAddToServer, setShowAddToServer] = useState(false);
  const [eligibleServers, setEligibleServers] = useState<{ id: string; name: string; icon_url: string | null; already_added: boolean }[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [addingServerId, setAddingServerId] = useState<string | null>(null);
  const { user } = useAuth();

  const initials = botName.charAt(0).toUpperCase();

  const loadEligibleServers = async () => {
    if (!user || !botId) return;
    setLoadingServers(true);
    try {
      const { data: memberships } = await supabase
        .from('server_members')
        .select('server_id, servers!inner(id, name, icon_url, owner_id), server_member_roles!left(server_roles!inner(permissions))')
        .eq('user_id', user.id);

      const { data: existingBots } = await (supabase as any)
        .from('server_bots')
        .select('server_id')
        .eq('bot_id', botId);
      const alreadyAdded = new Set((existingBots || []).map((r: any) => r.server_id));

      const list = (memberships || [])
        .map((m: any) => {
          const srv = m.servers;
          if (!srv) return null;
          const isOwner = srv.owner_id === user.id;
          const hasManageBots = (m.server_member_roles || []).some((smr: any) => {
            const perms = smr.server_roles?.permissions;
            return perms && ((perms as any).administrator || (perms as any).manage_bots);
          });
          if (!isOwner && !hasManageBots) return null;
          return { id: srv.id, name: srv.name, icon_url: srv.icon_url, already_added: alreadyAdded.has(srv.id) };
        })
        .filter(Boolean) as { id: string; name: string; icon_url: string | null; already_added: boolean }[];

      setEligibleServers(list);
    } finally {
      setLoadingServers(false);
    }
  };

  const handleAddToServer = async (serverId: string) => {
    if (!user || !botId) return;
    setAddingServerId(serverId);
    try {
      const { error } = await (supabase as any)
        .from('server_bots')
        .insert({ server_id: serverId, bot_id: botId, added_by: user.id });
      if (error) {
        if (error.code === '23505') {
          setEligibleServers(prev => prev.map(s => s.id === serverId ? { ...s, already_added: true } : s));
        } else {
          throw error;
        }
      } else {
        setEligibleServers(prev => prev.map(s => s.id === serverId ? { ...s, already_added: true } : s));
      }
    } catch {
      // silent
    } finally {
      setAddingServerId(null);
    }
  };

  const content = (
    <>
      <div className="h-[60px] w-full rounded-t-lg overflow-hidden relative shrink-0" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.6) 0%, hsl(262 83% 45% / 0.4) 100%)' }}>
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
      </div>
      <div className="px-4 relative">
        <div className="relative -mt-8 mb-3 inline-block">
          <div className="w-[72px] h-[72px] rounded-full border-[4px] border-sidebar bg-primary/20 flex items-center justify-center overflow-hidden shadow-lg">
            {botAvatarUrl ? (
              <img src={botAvatarUrl} alt={botName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white font-bold text-2xl">{initials}</div>
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-[3px] border-sidebar bg-status-online" />
        </div>
        <div className="absolute top-3 right-4">
          <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
            <Bot className="w-2.5 h-2.5" /> Bot
          </span>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div>
          <h3 className="text-[18px] font-bold text-foreground leading-tight">{botName}</h3>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Zap className="w-3 h-3 text-primary shrink-0" />
            <p className="text-xs text-primary/80 italic">Her zaman aktif</p>
          </div>
        </div>
        <div className="h-px bg-border/60" />
        <div className="bg-secondary/40 rounded-lg p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Durum</p>
          <p className="text-[13px] text-foreground/90">Bu sunucuya eklenmiş bir bot uygulamasıdır.</p>
        </div>
        {botId && (
          <>
            <div className="h-px bg-border/60" />
            {!showAddToServer ? (
              <button
                onClick={() => { setShowAddToServer(true); loadEligibleServers(); }}
                className="w-full text-[13px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Sunucuya Ekle
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sunucu Seç</p>
                  <button onClick={() => setShowAddToServer(false)} className="text-[10px] text-muted-foreground hover:text-foreground">✕ Kapat</button>
                </div>
                {loadingServers ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : eligibleServers.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-2">Eklenebilecek sunucu bulunamadı.</p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {eligibleServers.map(srv => (
                      <div key={srv.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                          {srv.icon_url ? <img src={srv.icon_url} alt="" className="w-full h-full object-cover" /> : srv.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="flex-1 text-xs text-foreground truncate">{srv.name}</p>
                        <button
                          onClick={() => !srv.already_added && handleAddToServer(srv.id)}
                          disabled={srv.already_added || addingServerId === srv.id}
                          className={`shrink-0 text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                            srv.already_added
                              ? 'bg-emerald-500/15 text-emerald-400 cursor-default'
                              : 'bg-primary/15 text-primary hover:bg-primary/25'
                          }`}
                        >
                          {addingServerId === srv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : srv.already_added ? <Check className="w-3 h-3" /> : 'Ekle'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="bottom" className="p-0 bg-sidebar border-border overflow-y-auto max-h-[85vh] rounded-t-2xl">
          {content}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-[300px] p-0 bg-sidebar border-border overflow-hidden shadow-2xl rounded-xl">
        {content}
      </PopoverContent>
    </Popover>
  );
};

const BotProfileCard = ({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) => {
  const [open, setOpen] = useState(false);
  const botContent = (
    <>
      {/* Banner */}
      <div className="h-[60px] w-full rounded-t-lg overflow-hidden relative shrink-0" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.8) 0%, hsl(var(--primary) / 0.3) 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Avatar row */}
      <div className="px-4 relative">
        <div className="relative -mt-8 mb-3 inline-block">
          <div className="w-[72px] h-[72px] rounded-full border-[4px] border-sidebar bg-primary/20 aurora-glow flex items-center justify-center overflow-hidden shadow-lg">
            <img src="/aurora-bot-avatar.jpg" alt="AuroraChat Bot" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-[3px] border-sidebar bg-status-online" />
        </div>
        <div className="absolute top-3 right-4">
          <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
            <Bot className="w-2.5 h-2.5" /> Bot
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pb-4 space-y-3">
        <div>
          <h3 className="text-[18px] font-bold text-foreground leading-tight">AuroraChat Bot</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">@aurorachat_bot</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Zap className="w-3 h-3 text-primary shrink-0" />
            <p className="text-xs text-primary/80 italic">Her zaman aktif sunucu asistanı</p>
          </div>
        </div>

        <div className="h-px bg-border/60" />

        <div className="bg-secondary/40 rounded-lg p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Hakkında</p>
          <p className="text-[13px] text-foreground/90 leading-relaxed">AuroraChat'in resmi bot asistanı. Sunucu komutlarını yönetir, bilgi sağlar ve üyelere yardım eder.</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Özellikler</p>
          <div className="flex flex-wrap gap-1.5">
            {['Komutlar', 'Moderasyon', 'Sunucu Bilgisi', 'AFK Takibi'].map(tag => (
              <span key={tag} className="text-[12px] px-2.5 py-1 rounded-full font-medium border border-primary/30 text-primary bg-primary/10">{tag}</span>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/60" />
        <p className="text-xs text-center text-muted-foreground">Komut listesi için <span className="text-primary font-semibold">/help</span> yazın</p>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="bottom" className="p-0 bg-sidebar border-border overflow-y-auto max-h-[85vh] rounded-t-2xl">
          {botContent}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-[300px] p-0 bg-sidebar border-border overflow-hidden shadow-2xl rounded-xl">
        {botContent}
      </PopoverContent>
    </Popover>
  );
};

const UserProfileCard = ({ userId, serverId, children, onSendMessage, status: externalStatus, platform: externalPlatform, isBot, botId, botName, botAvatarUrl, side = 'right' }: UserProfileCardProps) => {
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [isServerOwner, setIsServerOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [friendStatus, setFriendStatus] = useState<'none' | 'sent' | 'accepted' | 'received'>('none');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [hasBlockedUser, setHasBlockedUser] = useState(false);
  const [isBlockedByTarget, setIsBlockedByTarget] = useState(false);
  const [blockRecordId, setBlockRecordId] = useState<string | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [dbPlatform, setDbPlatform] = useState<string | null>(null);
  const [isControlling, setIsControlling] = useState(false);
  const [internalStatus, setInternalStatus] = useState<string | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // externalStatus comes from the live presence channel (always current).
  // internalStatus is fetched from DB and may be stale — presence wins.
  const userStatus = externalStatus ?? internalStatus ?? 'offline';

  // Spotify gerçek zamanlı durum — useSpotifyStatus hook'u
  const { nowPlaying: spotifyPlaying, localProgressMs } = useSpotifyStatus(
    userId === AURORA_BOT_ID ? null : userId,
    open,
  );
  const isSelf = user?.id === userId;
  const effectivePlatform = externalPlatform || dbPlatform || 'desktop';

  useEffect(() => {
    if (!open || !userId || userId === AURORA_BOT_ID || !user) return;
    const savedNote = localStorage.getItem(`user_note_${userId}`);
    if (savedNote) setNote(savedNote);

    // Fetch friend status
    const fetchFriendStatus = async () => {
      const { data } = await supabase.from('friends')
        .select('status, user_id, friend_id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
        .maybeSingle();
      if (!data) { setFriendStatus('none'); return; }
      if (data.status === 'accepted') { setFriendStatus('accepted'); return; }
      if (data.status === 'pending') {
        if (data.user_id === user.id) setFriendStatus('sent');
        else setFriendStatus('received');
        return;
      }
      setFriendStatus('none');
    };
    fetchFriendStatus();

    const fetchData = async () => {
      // Check if current user has blocked this user
      if (user) {
        const { data: myBlock } = await (supabase.from('blocked_users') as any)
          .select('id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', userId)
          .maybeSingle();
        if (myBlock) {
          setHasBlockedUser(true);
          setBlockRecordId(myBlock.id);
        } else {
          setHasBlockedUser(false);
          setBlockRecordId(null);
        }
        // Check if target has blocked current user (use RPC to bypass RLS)
        const { data: blockedByTarget } = await supabase.rpc('is_blocked_by', { p_blocker_id: userId });
        setIsBlockedByTarget(!!blockedByTarget);
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url, updated_at, bio, banner_color, banner_url, has_premium_badge, has_basic_badge, custom_status, premium_expires_at, basic_expires_at, platform, gender, birth_date, gender_visibility, birth_date_visibility, steam_id, steam_persona, steam_profile_url, steam_avatar_url, steam_game_name, spotify_display_name, status')
        .eq('id', userId)
        .maybeSingle();
      if (prof) {
        const now = new Date();
        const premExp = (prof as any).premium_expires_at ? new Date((prof as any).premium_expires_at) : null;
        const basExp = (prof as any).basic_expires_at ? new Date((prof as any).basic_expires_at) : null;
        const premActive = !!(prof as any).has_premium_badge && (premExp ? premExp > now : true);
        const basActive = !!(prof as any).has_basic_badge && (basExp ? basExp > now : true);
        setProfile({
          display_name: (prof as any).display_name || prof.username,
          username: prof.username,
          avatar_url: prof.avatar_url,
          created_at: (prof as any).updated_at || '',
          bio: (prof as any).bio || '',
          banner_color: (prof as any).banner_color || '',
          banner_url: (prof as any).banner_url || null,
          has_premium_badge: premActive,
          has_basic_badge: basActive && !premActive,
          custom_status: (prof as any).custom_status || null,
          gender: (prof as any).gender || null,
          birth_date: (prof as any).birth_date || null,
          gender_visibility: (prof as any).gender_visibility || 'everyone',
          birth_date_visibility: (prof as any).birth_date_visibility || 'everyone',
          steam_id: (prof as any).steam_id || null,
          steam_persona: (prof as any).steam_persona || null,
          steam_profile_url: (prof as any).steam_profile_url || null,
          steam_avatar_url: (prof as any).steam_avatar_url || null,
          steam_game_name: (prof as any).steam_game_name || null,
          spotify_display_name: (prof as any).spotify_display_name || null,
        });
        if ((prof as any).platform) setDbPlatform((prof as any).platform);
        if ((prof as any).status) setInternalStatus((prof as any).status);
      }

      if (serverId) {
        const { data: serverData } = await supabase
          .from('servers')
          .select('owner_id')
          .eq('id', serverId)
          .maybeSingle();
        setIsServerOwner(!!serverData && (serverData as any).owner_id === userId);

        const { data: member } = await supabase
          .from('server_members')
          .select('id, joined_at')
          .eq('server_id', serverId)
          .eq('user_id', userId)
          .maybeSingle();
        if (member) {
          setJoinedAt(member.joined_at);
          const { data: memberRoles } = await supabase
            .from('server_member_roles')
            .select('role_id')
            .eq('member_id', member.id);

          if (memberRoles && memberRoles.length > 0) {
            const roleIds = memberRoles.map(r => r.role_id);
            const { data: serverRoles } = await supabase
              .from('server_roles')
              .select('name, color, permissions')
              .in('id', roleIds)
              .order('position', { ascending: false });
            if (serverRoles) setRoles(serverRoles.map((r: any) => ({
              name: r.name,
              color: r.color,
              permissions: r.permissions || {},
              gradient_end_color: (r.permissions as any)?.gradient_end_color || null,
            })));
          } else {
            setRoles([]);
          }
        }
      }
    };
    fetchData();

    const channel = supabase
      .channel(`profile-card-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.status) setInternalStatus(updated.status);
        else if (updated.status === null) setInternalStatus('offline');
        setProfile(prev => prev ? {
          ...prev,
          display_name: updated.display_name || updated.username || prev.display_name,
          username: updated.username || prev.username,
          avatar_url: updated.avatar_url ?? prev.avatar_url,
          bio: updated.bio ?? prev.bio,
          banner_color: updated.banner_color || prev.banner_color,
          banner_url: updated.banner_url !== undefined ? (updated.banner_url || null) : prev.banner_url,
          has_premium_badge: updated.has_premium_badge ?? prev.has_premium_badge,
          has_basic_badge: updated.has_basic_badge ?? prev.has_basic_badge,
          custom_status: updated.custom_status ?? null,
          gender: updated.gender ?? prev.gender,
          birth_date: updated.birth_date ?? prev.birth_date,
          gender_visibility: updated.gender_visibility ?? prev.gender_visibility,
          birth_date_visibility: updated.birth_date_visibility ?? prev.birth_date_visibility,
        } : prev);
      })
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
    };
  }, [open, userId, serverId]);

  const handleSpotifyControl = async (command: 'play' | 'pause' | 'next' | 'prev') => {
    if (!isSelf || isControlling) return;
    setIsControlling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;
      const { data, error } = await supabase.functions.invoke('spotify-token', {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: 'control', command },
      });
      if (error || data?.error === 'premium_required') {
        toast.error('Bu özellik için Spotify Premium gerekli');
      } else if (data?.error === 'no_active_device') {
        toast.error('Spotify aktif cihaz bulunamadı');
      }
    } catch {
      toast.error('Kontrol sağlanamadı');
    } finally {
      setTimeout(() => setIsControlling(false), 1000);
    }
  };

  if (isBot && botName && botName !== 'AuroraChat Bot') {
    const resolvedBotId = botId || (userId !== AURORA_BOT_ID ? userId : undefined) || '';
    return <CustomBotWrapper botId={resolvedBotId} botName={botName} botAvatarUrl={botAvatarUrl}>{children}</CustomBotWrapper>;
  }
  if (isBot) {
    return <BotProfileCard isMobile={isMobile}>{children}</BotProfileCard>;
  }

  const handleNoteChange = (val: string) => {
    setNote(val);
    localStorage.setItem(`user_note_${userId}`, val);
  };

  const handleSendFriendRequest = async () => {
    if (!user || sendingRequest) return;
    setSendingRequest(true);
    if (hasBlockedUser) {
      toast.error('Engellediğiniz bir kullanıcıya arkadaşlık isteği gönderemezsiniz');
      setSendingRequest(false);
      return;
    }
    const { data: blockedByTargetRpc } = await supabase.rpc('is_blocked_by', { p_blocker_id: userId });
    if (blockedByTargetRpc) {
      toast.error('Bu kullanıcıya arkadaşlık isteği gönderemezsiniz');
      setSendingRequest(false);
      return;
    }
    const { error } = await supabase.from('friends').insert({ user_id: user.id, friend_id: userId });
    if (error) {
      toast.error(error.code === '23505' ? 'Zaten arkadaşlık isteği gönderildi' : 'İstek gönderilemedi');
    } else {
      toast.success('Arkadaşlık isteği gönderildi!');
      setFriendStatus('sent');
    }
    setSendingRequest(false);
  };

  const handleOpenDM = () => {
    setOpen(false);
    if (onSendMessage) {
      onSendMessage(userId);
    } else {
      window.dispatchEvent(new CustomEvent('open-dm', {
        detail: {
          userId,
          displayName: profile?.display_name || profile?.username || userId,
          username: profile?.username || userId,
          avatarUrl: profile?.avatar_url || null,
        }
      }));
    }
  };

  const handleBlockConfirm = async () => {
    if (!user || blockLoading) return;
    setBlockLoading(true);
    try {
      const { error } = await (supabase.from('blocked_users') as any).insert({
        blocker_id: user.id,
        blocked_id: userId,
      });
      if (error && error.code !== '23505') throw error;
      setHasBlockedUser(true);
      toast.warning(`${profile?.display_name || 'Kullanıcı'} engellendi`, {
        description: 'Bu kullanıcı artık sana mesaj veya arkadaşlık isteği gönderemez.',
        duration: 5000,
      });
    } catch {
      toast.error('Engelleme başarısız oldu');
    } finally {
      setBlockLoading(false);
      setShowBlockModal(false);
    }
  };

  const handleUnblock = async () => {
    if (!blockRecordId) return;
    await (supabase.from('blocked_users') as any).delete().eq('id', blockRecordId);
    setHasBlockedUser(false);
    setBlockRecordId(null);
    toast.success(`${profile?.display_name || 'Kullanıcı'} engeli kaldırıldı`);
  };

  const canSeeField = (visibility: string) => {
    if (visibility === 'everyone') return true;
    if (visibility === 'nobody') return false;
    if (visibility === 'friends') return isSelf || friendStatus === 'accepted';
    return false;
  };

  const genderLabel: Record<string, string> = {
    male: 'Erkek',
    female: 'Kadın',
    other: 'Diğer',
    prefer_not_to_say: 'Belirtmek İstemedi',
  };

  const formatBirthDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    const formatted = format(d, 'dd MMM yyyy', { locale: dateLocaleMap[language] || enUS });
    return `${formatted} (${age} yaşında)`;
  };

  const bannerBg = profile?.banner_color
    ? `linear-gradient(135deg, ${profile.banner_color} 0%, ${profile.banner_color}99 100%)`
    : 'linear-gradient(135deg, hsl(var(--primary) / 0.55) 0%, hsl(var(--accent) / 0.35) 100%)';

  const profileContent = (
    <div className="flex flex-col">
      {/* Banner */}
      <div className="w-full rounded-t-xl overflow-hidden shrink-0 relative" style={{ height: profile?.banner_url ? '150px' : '60px' }}>
        {profile?.banner_url ? (
          <img
            src={profile.banner_url}
            alt=""
            className="w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center center' }}
          />
        ) : (
          <div className="w-full h-full" style={{ background: bannerBg }} />
        )}
      </div>

      {/* Avatar + premium badge */}
      <div className="px-4 relative flex items-end justify-between">
        <div className="relative -mt-9">
          <div className="w-[72px] h-[72px] rounded-full border-[4px] border-sidebar bg-secondary flex items-center justify-center text-2xl font-bold overflow-hidden shadow-lg">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-foreground text-2xl">{profile?.display_name?.charAt(0)?.toUpperCase() || '?'}</span>}
          </div>
          {/* Status dot / platform icon */}
          {effectivePlatform === 'mobile' && userStatus !== 'offline' ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-sidebar rounded-full border border-border/30">
              <Smartphone className="w-3 h-3 text-green-500" />
            </div>
          ) : effectivePlatform === 'tablet' && userStatus !== 'offline' ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-sidebar rounded-full border border-border/30">
              <Tablet className="w-3 h-3 text-green-500" />
            </div>
          ) : userStatus === 'idle' ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-sidebar rounded-full">
              <Moon className="w-3.5 h-3.5 text-status-idle fill-status-idle" />
            </div>
          ) : (
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-[3.5px] border-sidebar ${statusDotClass[userStatus]}`} />
          )}
        </div>
        <div className="mb-2 flex items-center gap-1.5">
          {isServerOwner && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-7 h-7 rounded-full bg-yellow-400/15 border border-yellow-400/40 flex items-center justify-center cursor-default">
                    <Crown className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.65)]" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-semibold">
                  Sahip
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {profile?.has_premium_badge && (
            <Gem className="w-5 h-5 rgb-text drop-shadow-[0_0_8px_currentColor]" />
          )}
          {profile?.has_basic_badge && !profile?.has_premium_badge && (
            <Star className="w-4.5 h-4.5 text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.6)]" />
          )}
        </div>
      </div>

      {/* Name block */}
      <div className="px-4 mt-2 pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-[18px] font-bold text-foreground leading-tight">
            {profile?.display_name || '...'}
          </h3>
          {profile?.has_premium_badge && (
            <span className="text-[10px] rgb-badge border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider leading-none">Premium</span>
          )}
          {profile?.has_basic_badge && !profile?.has_premium_badge && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider leading-none">Basic</span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground mt-0.5">{profile?.username || '...'}</p>

        {/* Status label */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {effectivePlatform === 'mobile' && userStatus !== 'offline' ? (
            <Smartphone className="w-3 h-3 text-green-500 shrink-0" />
          ) : effectivePlatform === 'tablet' && userStatus !== 'offline' ? (
            <Tablet className="w-3 h-3 text-green-500 shrink-0" />
          ) : userStatus === 'idle' ? (
            <Moon className="w-3 h-3 text-status-idle fill-status-idle shrink-0" />
          ) : (
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotClass[userStatus]}`} />
          )}
          <span className="text-xs text-muted-foreground">
            {userStatus !== 'offline' && effectivePlatform === 'mobile' ? 'Mobil İstemci' :
             userStatus !== 'offline' && effectivePlatform === 'tablet' ? 'Tablet İstemci' :
             statusLabel[userStatus] || 'Çevrimdışı'}
          </span>
        </div>

        {/* Custom status */}
        {profile?.custom_status && (
          <div className="flex items-center gap-1.5 mt-1">
            <Smile className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground/80 italic truncate">{profile.custom_status}</p>
          </div>
        )}
      </div>

      {/* Steam game activity — shown inline when actively playing */}
      {profile?.steam_game_name && (
        <div className="mx-4 mt-3 rounded-xl border border-[#66c0f4]/25 bg-[#1b2838]/30 px-3 py-2 flex items-center gap-2.5">
          <Gamepad2 className="w-4 h-4 text-[#66c0f4] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#66c0f4] leading-none mb-0.5">Oyun Oynuyor</p>
            <p className="text-[13px] font-semibold text-foreground truncate">{profile.steam_game_name}</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#66c0f4] animate-pulse shrink-0" />
        </div>
      )}

      {/* Spotify now playing — compact inline indicator */}
      {spotifyPlaying?.is_playing && spotifyPlaying.track_name && (
        <div className="mx-4 mt-2 rounded-xl border border-[#1DB954]/25 bg-[#1DB954]/5 px-3 py-2 flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1DB954] leading-none mb-0.5">Şu an çalıyor</p>
            <p className="text-[13px] font-semibold text-foreground truncate">{spotifyPlaying.track_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{spotifyPlaying.artist_name}</p>
          </div>
          <div className="flex gap-0.5 items-end h-4 shrink-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-0.5 bg-[#1DB954] rounded-full animate-pulse" style={{ height: `${40 + i * 20}%`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Bağlantılar button */}
      {(profile?.steam_id || profile?.spotify_display_name || spotifyPlaying?.track_name) && (
        <div className="mx-4 mt-2">
          <button
            onClick={() => setShowConnectionsModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 text-foreground text-[12px] font-semibold hover:bg-secondary/80 transition-colors border border-border/50"
          >
            <Link2 className="w-3.5 h-3.5 text-primary" />
            Bağlantılar
          </button>
        </div>
      )}

      <ConnectionsModal
        open={showConnectionsModal}
        onClose={() => setShowConnectionsModal(false)}
        profile={profile ? {
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          spotify_display_name: profile.spotify_display_name,
          steam_id: profile.steam_id,
          steam_persona: profile.steam_persona,
          steam_profile_url: profile.steam_profile_url,
          steam_avatar_url: profile.steam_avatar_url,
          steam_game_name: profile.steam_game_name,
        } : null}
        spotifyPlaying={spotifyPlaying}
        localProgressMs={localProgressMs}
        isSelf={isSelf}
        isControlling={isControlling}
        onSpotifyControl={handleSpotifyControl}
      />

      <div className="mx-4 mt-3 h-px bg-border/60" />

      <div className="px-4 py-3 space-y-3">
        {/* Bio */}
        {profile?.bio && (
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{t('profileCard.aboutMe')}</p>
            <p className="text-[13px] text-foreground/90 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Roles — only shown in server context */}
        {serverId && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3 h-3 text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t('profileCard.roles')}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {roles.length === 0 ? (
              <span className="text-[12px] px-2.5 py-0.5 rounded font-semibold border text-muted-foreground border-border/50 bg-secondary/30">
                @everyone
              </span>
            ) : (
              <>
                {roles.slice(0, 3).map((role) => {
                  const gradEnd = role.gradient_end_color;
                  const hasGradient = !!(gradEnd && role.color);
                  return (
                    <span
                      key={role.name}
                      className="text-[12px] px-2.5 py-0.5 rounded font-semibold border"
                      style={hasGradient ? {
                        background: `linear-gradient(270deg, ${role.color}, ${gradEnd})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        borderColor: role.color + '50',
                        backgroundColor: role.color + '18',
                      } : { color: role.color, borderColor: role.color + '50', backgroundColor: role.color + '18' }}
                    >
                      {role.name}
                    </span>
                  );
                })}
                {roles.length > 3 && (
                  <span className="text-[12px] px-2.5 py-0.5 rounded font-semibold border text-muted-foreground border-border/50 bg-secondary/30">
                    +{roles.length - 3}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        )}

        {/* Gender and Birth Date */}
        {((profile?.gender && canSeeField(profile.gender_visibility)) || (profile?.birth_date && canSeeField(profile.birth_date_visibility))) && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Kişisel Bilgiler</p>
            <div className="space-y-1.5">
              {profile?.gender && canSeeField(profile.gender_visibility) && (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <User2 className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block leading-none mb-0.5">Cinsiyet</span>
                    <span>{genderLabel[profile.gender] || profile.gender}</span>
                  </div>
                </div>
              )}
              {profile?.birth_date && canSeeField(profile.birth_date_visibility) && (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Cake className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block leading-none mb-0.5">Doğum Tarihi</span>
                    <span>{formatBirthDate(profile.birth_date)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dates */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{t('profileCard.memberSince')}</p>
          <div className="space-y-1.5">
            {profile?.created_at && (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block leading-none mb-0.5">AuroraChat</span>
                  <span>{format(new Date(profile.created_at), 'dd MMM yyyy', { locale: dateLocaleMap[language] || enUS })}</span>
                </div>
              </div>
            )}
            {joinedAt && (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Server className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block leading-none mb-0.5">Sunucu</span>
                  <span>{format(new Date(joinedAt), 'dd MMM yyyy', { locale: dateLocaleMap[language] || enUS })}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-border/60" />

        {/* Note */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{t('profileCard.note')}</p>
          <input
            type="text"
            value={note}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder={t('profileCard.notePlaceholder')}
            className="w-full bg-secondary/50 rounded-md px-3 py-2 text-[13px] outline-none text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        {/* Action buttons */}
        {!isSelf && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleOpenDM}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Mesaj
              </button>
              {!hasBlockedUser && !isBlockedByTarget && friendStatus === 'none' && (
                <button
                  onClick={handleSendFriendRequest}
                  disabled={sendingRequest}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-secondary text-foreground text-[13px] font-semibold hover:bg-secondary/80 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  {sendingRequest ? '...' : 'Arkadaş Ekle'}
                </button>
              )}
              {friendStatus === 'sent' && (
                <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/60 text-muted-foreground text-[13px] font-medium">
                  <UserCheck className="w-4 h-4" />
                  İstek Gönderildi
                </div>
              )}
              {friendStatus === 'accepted' && (
                <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-status-online/15 text-status-online text-[13px] font-medium border border-status-online/30">
                  <UserCheck className="w-4 h-4" />
                  Arkadaş
                </div>
              )}
              {friendStatus === 'received' && (
                <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 text-primary text-[13px] font-medium border border-primary/30">
                  <UserPlus className="w-4 h-4" />
                  İstek Bekleniyor
                </div>
              )}
            </div>
            {/* Block / Unblock */}
            {hasBlockedUser ? (
              <button
                onClick={handleUnblock}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-[12px] font-semibold hover:bg-destructive/20 transition-all border border-destructive/20"
              >
                <UserX className="w-3.5 h-3.5" />
                Engeli Kaldır
              </button>
            ) : (
              <button
                onClick={() => setShowBlockModal(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 text-muted-foreground text-[12px] font-medium hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <UserX className="w-3.5 h-3.5" />
                Engelle
              </button>
            )}
          </div>
        )}
        <BlockConfirmModal
          open={showBlockModal}
          displayName={profile?.display_name || profile?.username || 'Kullanıcı'}
          onConfirm={handleBlockConfirm}
          onCancel={() => setShowBlockModal(false)}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="bottom" className="p-0 bg-sidebar border-border overflow-y-auto max-h-[90vh] rounded-t-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
          {profileContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align="start" sideOffset={8} className="w-[300px] p-0 bg-sidebar border-border overflow-hidden shadow-2xl rounded-xl">
        {profileContent}
      </PopoverContent>
    </Popover>
  );
};

export default UserProfileCard;
