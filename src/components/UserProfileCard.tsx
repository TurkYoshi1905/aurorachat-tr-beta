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
import { MessageSquare, Moon, Smile, Bot, Zap, Gem, CalendarDays, Server, ShieldCheck, UserPlus, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import BlockConfirmModal from './BlockConfirmModal';

export const AURORA_BOT_ID = 'aurora-bot';

interface UserProfileCardProps {
  userId: string;
  serverId?: string;
  children: React.ReactNode;
  onSendMessage?: (userId: string) => void;
  status?: string;
}

interface ProfileData {
  display_name: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  bio: string;
  banner_color: string;
  has_premium_badge: boolean;
  custom_status: string | null;
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

const UserProfileCard = ({ userId, serverId, children, onSendMessage, status: externalStatus }: UserProfileCardProps) => {
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [friendStatus, setFriendStatus] = useState<'none' | 'sent' | 'accepted' | 'received'>('none');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [hasBlockedUser, setHasBlockedUser] = useState(false);
  const [blockRecordId, setBlockRecordId] = useState<string | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userStatus = externalStatus || 'offline';
  const isSelf = user?.id === userId;

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
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url, updated_at, bio, banner_color, has_premium_badge, custom_status')
        .eq('id', userId)
        .maybeSingle();
      if (prof) setProfile({
        display_name: (prof as any).display_name || prof.username,
        username: prof.username,
        avatar_url: prof.avatar_url,
        created_at: (prof as any).updated_at || '',
        bio: (prof as any).bio || '',
        banner_color: (prof as any).banner_color || '',
        has_premium_badge: (prof as any).has_premium_badge || false,
        custom_status: (prof as any).custom_status || null,
      });

      if (serverId) {
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
        setProfile(prev => prev ? {
          ...prev,
          display_name: updated.display_name || updated.username || prev.display_name,
          username: updated.username || prev.username,
          avatar_url: updated.avatar_url ?? prev.avatar_url,
          bio: updated.bio ?? prev.bio,
          banner_color: updated.banner_color || prev.banner_color,
          has_premium_badge: updated.has_premium_badge ?? prev.has_premium_badge,
          custom_status: updated.custom_status ?? null,
        } : prev);
      })
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
    };
  }, [open, userId, serverId]);

  if (userId === AURORA_BOT_ID) {
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
    const { data: blockedByTarget } = await (supabase.from('blocked_users') as any)
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', user.id)
      .maybeSingle();
    if (blockedByTarget) {
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

  const bannerBg = profile?.banner_color
    ? `linear-gradient(135deg, ${profile.banner_color} 0%, ${profile.banner_color}99 100%)`
    : 'linear-gradient(135deg, hsl(var(--primary) / 0.55) 0%, hsl(var(--accent) / 0.35) 100%)';

  const profileContent = (
    <div className="flex flex-col">
      {/* Banner */}
      <div className="h-[60px] w-full rounded-t-xl overflow-hidden shrink-0" style={{ background: bannerBg }} />

      {/* Avatar + premium badge */}
      <div className="px-4 relative flex items-end justify-between">
        <div className="relative -mt-9">
          <div className="w-[72px] h-[72px] rounded-full border-[4px] border-sidebar bg-secondary flex items-center justify-center text-2xl font-bold overflow-hidden shadow-lg">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-foreground text-2xl">{profile?.display_name?.charAt(0)?.toUpperCase() || '?'}</span>}
          </div>
          {/* Status dot */}
          {userStatus === 'idle' ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-sidebar rounded-full">
              <Moon className="w-3.5 h-3.5 text-status-idle fill-status-idle" />
            </div>
          ) : (
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-[3.5px] border-sidebar ${statusDotClass[userStatus]}`} />
          )}
        </div>
        {profile?.has_premium_badge && (
          <div className="mb-2">
            <Gem className="w-5 h-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
          </div>
        )}
      </div>

      {/* Name block */}
      <div className="px-4 mt-2 pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-[18px] font-bold text-foreground leading-tight">
            {profile?.display_name || '...'}
          </h3>
          {profile?.has_premium_badge && (
            <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider leading-none">Premium</span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground mt-0.5">{profile?.username || '...'}</p>

        {/* Status label */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {userStatus === 'idle' ? (
            <Moon className="w-3 h-3 text-status-idle fill-status-idle shrink-0" />
          ) : (
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotClass[userStatus]}`} />
          )}
          <span className="text-xs text-muted-foreground">{statusLabel[userStatus] || 'Çevrimdışı'}</span>
        </div>

        {/* Custom status */}
        {profile?.custom_status && (
          <div className="flex items-center gap-1.5 mt-1">
            <Smile className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground/80 italic truncate">{profile.custom_status}</p>
          </div>
        )}
      </div>

      <div className="mx-4 mt-3 h-px bg-border/60" />

      <div className="px-4 py-3 space-y-3">
        {/* Bio */}
        {profile?.bio && (
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{t('profileCard.aboutMe')}</p>
            <p className="text-[13px] text-foreground/90 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Roles */}
        {roles.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-3 h-3 text-muted-foreground" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t('profileCard.roles')}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((role) => {
                const gradEnd = role.gradient_end_color;
                const hasGradient = !!(gradEnd && role.color);
                return (
                  <span
                    key={role.name}
                    className="text-[12px] px-2.5 py-0.5 rounded font-semibold border"
                    style={hasGradient ? {
                      background: `linear-gradient(90deg, ${role.color}, ${gradEnd})`,
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
              {!hasBlockedUser && friendStatus === 'none' && (
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
        <SheetContent side="bottom" className="p-0 bg-sidebar border-border overflow-y-auto max-h-[90vh] rounded-t-2xl">
          {profileContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-[300px] p-0 bg-sidebar border-border overflow-hidden shadow-2xl rounded-xl">
        {profileContent}
      </PopoverContent>
    </Popover>
  );
};

export default UserProfileCard;
