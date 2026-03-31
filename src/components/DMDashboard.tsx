import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  UserPlus, MessageCircle, Check, X, Users, Sparkles, Clock,
  Search, Trash2, Ban, MoreVertical, Circle, Moon, MinusCircle,
  PhoneCall, Video, ShieldOff, AlertTriangle, ChevronLeft, Bell
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import UserInfoPanel from '@/components/UserInfoPanel';
import BlockConfirmModal from '@/components/BlockConfirmModal';
import { DbMember } from '@/pages/Index';
import {
  saveDMHistory,
  loadDMHistory,
  hideDMFromHistory,
  getHiddenDMs,
  type DMHistoryEntry,
} from '@/lib/dmHistory';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FriendProfile { userId: string; displayName: string; username: string; avatarUrl: string | null; status?: string; }
interface FriendRequest { id: string; senderId: string; receiverId: string; status: string; profile: FriendProfile; }
interface DMDashboardProps {
  onOpenDM: (user: FriendProfile) => void;
  onStartCall?: (user: FriendProfile) => void;
  currentUserStatus?: DbMember['status'];
  onStatusChange?: (status: DbMember['status']) => void;
  presenceStatuses?: Map<string, string>;
  onToggleNotifications?: () => void;
  unreadNotifCount?: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  online: { color: 'bg-[#3ba55d]', label: 'Çevrimiçi', icon: <Circle className="w-2.5 h-2.5" /> },
  idle: { color: 'bg-[#faa61a]', label: 'Boşta', icon: <Moon className="w-2.5 h-2.5" /> },
  dnd: { color: 'bg-[#ed4245]', label: 'Rahatsız Etme', icon: <MinusCircle className="w-2.5 h-2.5" /> },
  offline: { color: 'bg-[#80848e]', label: 'Çevrimdışı', icon: <Circle className="w-2.5 h-2.5" /> },
};

const formatRelativeTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins}dk`;
  if (hours < 24) return `${hours}sa`;
  if (days < 7) return `${days}g`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

const StatusDot = ({ status }: { status?: string }) => {
  const cfg = STATUS_CONFIG[status || 'offline'];
  return (
    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${cfg.color} border-2 border-[#2b2d31]`} />
  );
};

const DMDashboard = ({ onOpenDM, onStartCall, currentUserStatus = 'online', onStatusChange, presenceStatuses, onToggleNotifications, unreadNotifCount = 0 }: DMDashboardProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [mobilePanelView, setMobilePanelView] = useState<'dms' | 'friends'>('dms');
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [dmHistory, setDmHistory] = useState<DMHistoryEntry[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [dmSearch, setDmSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDM, setActiveDM] = useState<string | null>(null);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('all');
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; profile: FriendProfile }[]>([]);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [pendingBlockTarget, setPendingBlockTarget] = useState<{ userId: string; displayName: string; friendId?: string } | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('friends').select('*').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    if (!data) return;
    const otherUserIds = data.map((f: any) => f.user_id === user.id ? f.friend_id : f.user_id);
    let profilesMap = new Map<string, any>();
    if (otherUserIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherUserIds);
      if (profiles) profiles.forEach((p: any) => profilesMap.set(p.id, p));
    }
    const accepted: FriendRequest[] = [], pending: FriendRequest[] = [], sent: FriendRequest[] = [];
    for (const f of data as any[]) {
      const otherUserId = f.user_id === user.id ? f.friend_id : f.user_id;
      const prof = profilesMap.get(otherUserId);
      const friendReq: FriendRequest = {
        id: f.id, senderId: f.user_id, receiverId: f.friend_id, status: f.status,
        profile: {
          userId: otherUserId,
          displayName: prof?.display_name || t('common.user'),
          username: prof?.username || '',
          avatarUrl: prof?.avatar_url || null,
          status: prof?.status || 'offline',
        },
      };
      if (f.status === 'accepted') accepted.push(friendReq);
      else if (f.status === 'pending') { if (f.friend_id === user.id) pending.push(friendReq); else sent.push(friendReq); }
    }
    setFriends(accepted);
    setPendingRequests(pending);
    setSentRequests(sent);

    // Build status map
    const statusMap: Record<string, string> = {};
    accepted.forEach(f => { statusMap[f.profile.userId] = f.profile.status || 'offline'; });
    setOnlineStatuses(prev => ({ ...prev, ...statusMap }));
  }, [user, t]);

  const fetchDMHistory = useCallback(async () => {
    if (!user) return;
    try {
      const cached = await loadDMHistory();
      if (cached.length > 0) setDmHistory(cached);
    } catch { }

    try {
      const { data: conversations, error: convError } = await supabase
        .from('dm_conversations')
        .select('id, user1_id, user2_id, created_at')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (convError || !conversations || conversations.length === 0) { setDmHistory([]); return; }

      const convIds = conversations.map((c: any) => c.id);
      const { data: messages } = await supabase
        .from('direct_messages')
        .select('conversation_id, content, inserted_at, sender_id')
        .in('conversation_id', convIds)
        .order('inserted_at', { ascending: false });

      const latestMsgByConv = new Map<string, any>();
      for (const msg of (messages || []) as any[]) {
        if (!latestMsgByConv.has(msg.conversation_id)) {
          latestMsgByConv.set(msg.conversation_id, msg);
        }
      }

      const seen = new Set<string>();
      const dmUsers: { userId: string; lastMessage: string; lastAt: string }[] = [];
      for (const conv of conversations as any[]) {
        const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
        if (seen.has(otherId)) continue;
        seen.add(otherId);
        const latestMsg = latestMsgByConv.get(conv.id);
        dmUsers.push({
          userId: otherId,
          lastMessage: latestMsg?.content || '',
          lastAt: latestMsg?.inserted_at || conv.created_at,
        });
      }

      if (dmUsers.length === 0) { setDmHistory([]); return; }

      const hidden = await getHiddenDMs().catch(() => new Set<string>());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, status')
        .in('id', dmUsers.map(d => d.userId));

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Update statuses
      const statusMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { statusMap[p.id] = p.status || 'offline'; });
      setOnlineStatuses(prev => ({ ...prev, ...statusMap }));

      const entries: DMHistoryEntry[] = dmUsers
        .filter(d => !hidden.has(d.userId))
        .map(d => {
          const p = profileMap.get(d.userId);
          return {
            userId: d.userId,
            displayName: p?.display_name || t('common.user'),
            username: p?.username || '',
            avatarUrl: p?.avatar_url || null,
            lastMessage: d.lastMessage,
            lastAt: d.lastAt,
          };
        });

      setDmHistory(entries);
      await saveDMHistory(entries).catch(() => { });
    } catch { }
  }, [user, t]);

  useEffect(() => {
    fetchFriends();
    fetchDMHistory();
  }, [fetchFriends, fetchDMHistory]);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase.from('blocked_users') as any)
      .select('id, blocked_id')
      .eq('blocker_id', user.id);
    if (error || !data) return;
    if (data.length === 0) { setBlockedUsers([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', data.map((b: any) => b.blocked_id));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    setBlockedUsers(data.map((b: any) => ({
      id: b.id,
      blocked_id: b.blocked_id,
      profile: {
        userId: b.blocked_id,
        displayName: profileMap.get(b.blocked_id)?.display_name || 'Kullanıcı',
        username: profileMap.get(b.blocked_id)?.username || '',
        avatarUrl: profileMap.get(b.blocked_id)?.avatar_url || null,
      },
    })));
  }, [user]);

  // Real-time: friends table changes → refresh list
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('dm-friends-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => {
        fetchFriends();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchFriends]);

  // Real-time: blocked_users changes
  useEffect(() => {
    if (!user) return;
    fetchBlockedUsers();
    const ch = supabase
      .channel('dm-blocked-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users' }, () => {
        fetchBlockedUsers();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchBlockedUsers]);

  // Helper: get real-time status for a user — presence channel is the ground truth
  const getStatus = useCallback((userId: string): string => {
    if (presenceStatuses?.has(userId)) return presenceStatuses.get(userId)!;
    return onlineStatuses[userId] || 'offline';
  }, [presenceStatuses, onlineStatuses]);

  const handleDeleteDMHistory = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await hideDMFromHistory(userId);
      setDmHistory(prev => prev.filter(d => d.userId !== userId));
      toast.success('Konuşma kaldırıldı');
    } catch {
      toast.error('Kaldırılamadı');
    }
  };

  const handleSendRequest = async () => {
    if (!user || !searchUsername.trim()) return;
    setLoading(true);
    const { data: targetProfile } = await (supabase.from('profiles') as any)
      .select('id, friend_request_setting')
      .eq('username', searchUsername.trim())
      .maybeSingle();
    if (!targetProfile) { toast.error(t('friends.userNotFound')); setLoading(false); return; }
    if (targetProfile.id === user.id) { toast.error(t('friends.cantAddSelf')); setLoading(false); return; }

    // Check if sender has blocked target OR target has blocked sender
    const { data: blockRecord } = await (supabase.from('blocked_users') as any)
      .select('id, blocker_id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetProfile.id}),and(blocker_id.eq.${targetProfile.id},blocked_id.eq.${user.id})`)
      .maybeSingle();
    if (blockRecord) {
      if (blockRecord.blocker_id === user.id) {
        toast.error('Bu kullanıcıyı engellediğiniz için arkadaşlık isteği gönderemezsiniz.');
      } else {
        toast.error('Bu kullanıcıya arkadaşlık isteği gönderemezsiniz.');
      }
      setLoading(false);
      return;
    }

    const friendReqSetting = targetProfile.friend_request_setting || 'everyone';

    if (friendReqSetting === 'none') {
      toast.error('Bu Kullanıcı Arkadaşlık İsteklerini Kabul Etmiyor. (üzgünüz 😢)');
      setLoading(false);
      return;
    }

    if (friendReqSetting === 'friends') {
      // Check for mutual friend: a user who is friends with both the current user and the target
      const { data: myFriends } = await supabase.from('friends').select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');
      const myFriendIds = (myFriends || []).map((f: any) => f.user_id === user.id ? f.friend_id : f.user_id);

      const { data: targetFriends } = await supabase.from('friends').select('user_id, friend_id')
        .or(`user_id.eq.${targetProfile.id},friend_id.eq.${targetProfile.id}`)
        .eq('status', 'accepted');
      const targetFriendIds = (targetFriends || []).map((f: any) => f.user_id === targetProfile.id ? f.friend_id : f.user_id);

      const hasMutual = myFriendIds.some((id: string) => targetFriendIds.includes(id));
      if (!hasMutual) {
        toast.error('Bu Kullanıcı Arkadaşlık İsteklerini Kabul Etmiyor. (üzgünüz 😢)');
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.from('friends').insert({ user_id: user.id, friend_id: targetProfile.id });
    if (error) { toast.error(error.code === '23505' ? t('friends.alreadyExists') : t('friends.sendFailed')); }
    else { toast.success(t('friends.requestSent')); setSearchUsername(''); fetchFriends(); }
    setLoading(false);
  };

  const handleAccept = async (friendId: string) => {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendId);
    toast.success(t('friends.accepted'));
    fetchFriends();
  };
  const handleReject = async (friendId: string) => {
    await supabase.from('friends').delete().eq('id', friendId);
    toast.success(t('friends.rejected'));
    fetchFriends();
  };
  const handleRemoveFriend = async (friendId: string) => {
    await supabase.from('friends').delete().eq('id', friendId);
    toast.success(t('friends.removed'));
    fetchFriends();
  };

  const handleBlockUser = async (userId: string, displayName: string, friendId?: string) => {
    setBlockLoading(true);
    try {
      const { error } = await (supabase.from('blocked_users') as any).insert({
        blocker_id: user!.id,
        blocked_id: userId,
      });
      if (error && error.code !== '23505') throw error;
      // Also remove friendship if exists
      if (friendId) {
        await supabase.from('friends').delete().eq('id', friendId);
      }
      toast.warning(
        `${displayName} engellendi`,
        {
          description: 'Bu kullanıcı sana artık mesaj gönderemez veya arkadaşlık isteği yollayamaz.',
          duration: 5000,
          icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        }
      );
      fetchFriends();
      fetchBlockedUsers();
    } catch {
      toast.error('Engelleme başarısız oldu');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblockUser = async (blockId: string, displayName: string) => {
    try {
      await (supabase.from('blocked_users') as any).delete().eq('id', blockId);
      toast.success(`${displayName} engeli kaldırıldı`);
      fetchBlockedUsers();
    } catch {
      toast.error('Engel kaldırılamadı');
    }
  };

  const filteredFriends = friends.filter(f =>
    !friendSearch.trim() ||
    f.profile.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.profile.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  const onlineFriends = filteredFriends.filter(f => {
    const s = getStatus(f.profile.userId);
    return s && s !== 'offline';
  });

  const filteredDMHistory = dmHistory.filter(dm =>
    !dmSearch.trim() ||
    dm.displayName.toLowerCase().includes(dmSearch.toLowerCase()) ||
    dm.username.toLowerCase().includes(dmSearch.toLowerCase())
  );

  const EmptyState = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 flex items-center justify-center mb-5">
        <Icon className="w-9 h-9 text-primary/60" />
      </div>
      <p className="text-lg font-bold text-foreground mb-2">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{desc}</p>
    </div>
  );

  const FriendRow = ({ friend }: { friend: FriendRequest }) => {
    const status = getStatus(friend.profile.userId);
    const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 mx-2 hover:bg-[#393c43] rounded-lg transition-all group cursor-pointer border-b border-[#3f4147]/50 last:border-0">
        <div className="relative flex-shrink-0">
          <Avatar className="h-9 w-9">
            {friend.profile.avatarUrl && <AvatarImage src={friend.profile.avatarUrl} />}
            <AvatarFallback className="bg-[#5865f2] text-white font-semibold text-sm">{friend.profile.displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <StatusDot status={status} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#f2f3f5] truncate">{friend.profile.displayName}</p>
          <p className="text-xs truncate" style={{ color: statusCfg.color.replace('bg-', '') }}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusCfg.color} mr-1`} />
            {statusCfg.label}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost" size="icon"
            onClick={() => onOpenDM(friend.profile)}
            className="h-8 w-8 rounded-full bg-[#2b2d31] hover:bg-[#5865f2] text-[#b5bac1] hover:text-white transition-colors"
            title={t('friends.sendMessage')}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 rounded-full bg-[#2b2d31] hover:bg-[#393c43] text-[#b5bac1] hover:text-white transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#18191c] border-[#3f4147] text-[#dbdee1]">
              <DropdownMenuItem onClick={() => onOpenDM(friend.profile)} className="gap-2 cursor-pointer hover:bg-[#393c43]">
                <MessageCircle className="w-4 h-4" />
                Mesaj Gönder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStartCall?.(friend.profile)}
                className="gap-2 cursor-pointer hover:bg-[#393c43]"
              >
                <PhoneCall className="w-4 h-4" />
                Sesli Arama
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-[#393c43] opacity-50" disabled>
                <Video className="w-4 h-4" />
                Görüntülü Arama
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3f4147]" />
              <DropdownMenuItem
                onClick={() => handleRemoveFriend(friend.id)}
                className="gap-2 cursor-pointer text-[#ed4245] hover:bg-[#ed4245]/10 hover:text-[#ed4245]"
              >
                <X className="w-4 h-4" />
                Arkadaşlıktan Çıkar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setPendingBlockTarget({ userId: friend.profile.userId, displayName: friend.profile.displayName, friendId: friend.id }); setShowBlockModal(true); }}
                disabled={blockLoading}
                className="gap-2 cursor-pointer text-[#ed4245] hover:bg-[#ed4245]/10 hover:text-[#ed4245]"
              >
                <Ban className="w-4 h-4" />
                Engelle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="flex-1 flex min-w-0 min-h-0 h-full overflow-hidden">
      {/* Left: DM History Panel */}
      <div className={`${isMobile ? (mobilePanelView === 'dms' ? 'flex' : 'hidden') : 'flex'} w-full sm:w-60 flex-shrink-0 bg-[#2b2d31] border-r border-[#1e1f22] flex-col overflow-hidden`} style={{ background: 'hsl(var(--sidebar))' }}>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6d6f78]" />
            <input
              type="text"
              placeholder="Konuşma ara..."
              value={dmSearch}
              onChange={e => setDmSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-[#1e1f22] text-[#dbdee1] placeholder-[#6d6f78] rounded-md border-none outline-none focus:ring-1 focus:ring-[#5865f2]/50"
            />
          </div>
        </div>
        <nav className="px-2 mb-1 space-y-0.5">
          <button
            onClick={() => { setActiveDM(null); if (isMobile) setMobilePanelView('friends'); }}
            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors ${activeDM === null ? 'bg-[#393c43] text-[#dbdee1]' : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'}`}
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Arkadaşlar</span>
            {pendingRequests.length > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center text-[10px] bg-[#ed4245] text-white rounded-full px-1 font-bold">{pendingRequests.length}</span>
            )}
          </button>
          {onToggleNotifications && (
            <button
              onClick={onToggleNotifications}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]"
            >
              <Bell className="w-4 h-4" />
              <span className="text-sm font-medium">Bildirimler</span>
              {unreadNotifCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center text-[10px] bg-[#ed4245] text-white rounded-full px-1 font-bold">{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>
              )}
            </button>
          )}
        </nav>

        {/* DM History list */}
        <div className="flex-1 overflow-y-auto px-2">
          {filteredDMHistory.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6d6f78] px-2 py-2">Doğrudan Mesajlar</p>
              {filteredDMHistory.map((dm) => {
                const status = getStatus(dm.userId);
                const isActive = activeDM === dm.userId;
                return (
                  <div key={dm.userId} className="group relative">
                    <button
                      onClick={() => { setActiveDM(dm.userId); onOpenDM({ userId: dm.userId, displayName: dm.displayName, username: dm.username, avatarUrl: dm.avatarUrl }); }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 pr-8 rounded-md transition-colors ${isActive ? 'bg-[#393c43]' : 'hover:bg-[#35373c]'}`}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-8 w-8">
                          {dm.avatarUrl && <AvatarImage src={dm.avatarUrl} />}
                          <AvatarFallback className="bg-[#5865f2] text-white text-xs font-semibold">{dm.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <StatusDot status={status} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-[#dbdee1] truncate leading-tight">{dm.displayName}</p>
                          {dm.lastAt && (
                            <span className="text-[10px] text-[#6d6f78] flex-shrink-0 ml-1">{formatRelativeTime(dm.lastAt)}</span>
                          )}
                        </div>
                        {dm.lastMessage && (
                          <p className="text-[11px] text-[#6d6f78] truncate leading-tight">{dm.lastMessage}</p>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleDeleteDMHistory(dm.userId, e)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[#ed4245]/20 text-[#6d6f78] hover:text-[#ed4245] transition-all"
                      title="Konuşmayı kaldır"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="w-8 h-8 text-[#6d6f78] mb-2" />
              <p className="text-xs text-[#6d6f78]">Henüz DM geçmişin yok</p>
            </div>
          )}
        </div>
        <UserInfoPanel currentUserStatus={currentUserStatus} onStatusChange={onStatusChange} />
      </div>

      {/* Right: Friends Panel */}
      <div className={`${isMobile ? (mobilePanelView === 'friends' ? 'flex' : 'hidden') : 'flex'} flex-1 flex-col min-w-0 overflow-hidden bg-[#313338]`}>
        <div className="h-12 flex items-center px-4 border-b border-[#1e1f22] shadow-sm gap-3 flex-shrink-0">
          {isMobile && (
            <button
              onClick={() => setMobilePanelView('dms')}
              className="p-1 rounded hover:bg-[#393c43] text-[#b5bac1] transition-colors flex-shrink-0"
              title="Mesajlar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <Users className="w-5 h-5 text-[#b5bac1]" />
          <span className="font-semibold text-[#f2f3f5] text-sm">{t('friends.title')}</span>
          <div className="h-5 w-px bg-[#3f4147] mx-1" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3ba55d]" />
            <span className="text-xs text-[#b5bac1] font-medium">{onlineFriends.length} çevrimiçi</span>
          </div>
          <span className="text-xs text-[#6d6f78]">•</span>
          <span className="text-xs text-[#b5bac1] font-medium">{friends.length} arkadaş</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-4 pt-4 pb-2">
              <TabsList className="bg-transparent gap-0 p-0 h-auto border-b border-[#3f4147] w-full justify-start rounded-none">
                <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#dbdee1] data-[state=active]:text-[#dbdee1] text-[#b5bac1] hover:text-[#dbdee1] bg-transparent text-sm font-medium px-3 pb-2 transition-colors">
                  {t('friends.all')}
                </TabsTrigger>
                <TabsTrigger value="online" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#dbdee1] data-[state=active]:text-[#dbdee1] text-[#b5bac1] hover:text-[#dbdee1] bg-transparent text-sm font-medium px-3 pb-2 transition-colors">
                  Çevrimiçi
                  {onlineFriends.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-[#3ba55d] text-white rounded-full font-bold">{onlineFriends.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="pending" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#dbdee1] data-[state=active]:text-[#dbdee1] text-[#b5bac1] hover:text-[#dbdee1] bg-transparent text-sm font-medium px-3 pb-2 transition-colors">
                  {t('friends.pending')}
                  {pendingRequests.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-[#ed4245] text-white rounded-full font-bold">{pendingRequests.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="add" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5865f2] data-[state=active]:text-[#5865f2] text-[#b5bac1] hover:text-[#dbdee1] bg-transparent text-sm font-medium px-3 pb-2 transition-colors">
                  {t('friends.addFriend')}
                </TabsTrigger>
                <TabsTrigger value="blocked" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#ed4245] data-[state=active]:text-[#ed4245] text-[#b5bac1] hover:text-[#dbdee1] bg-transparent text-sm font-medium px-3 pb-2 transition-colors">
                  Engellenmiş
                  {blockedUsers.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-[#ed4245] text-white rounded-full font-bold">{blockedUsers.length}</span>}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="px-0 py-0 mt-0">
              {friends.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6d6f78]" />
                    <input
                      type="text"
                      placeholder="Arkadaşları ara..."
                      value={friendSearch}
                      onChange={e => setFriendSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm bg-[#1e1f22] text-[#dbdee1] placeholder-[#6d6f78] rounded-md border-none outline-none focus:ring-1 focus:ring-[#5865f2]/50"
                    />
                  </div>
                </div>
              )}
              {filteredFriends.length === 0 ? (
                <EmptyState icon={Sparkles} title={t('friends.noFriendsTitle')} desc={t('friends.noFriendsDesc')} />
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase text-[#b5bac1] px-5 py-2 tracking-wider">{t('friends.allFriends')} — {filteredFriends.length}</p>
                  {filteredFriends.map((f) => <FriendRow key={f.id} friend={f} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="online" className="px-0 py-0 mt-0">
              {onlineFriends.length === 0 ? (
                <EmptyState icon={Circle} title="Çevrimiçi arkadaş yok" desc="Arkadaşların şu an çevrimdışı görünüyor." />
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase text-[#b5bac1] px-5 py-2 tracking-wider">Çevrimiçi — {onlineFriends.length}</p>
                  {onlineFriends.map((f) => <FriendRow key={f.id} friend={f} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="px-0 py-0 mt-0">
              {pendingRequests.length === 0 && sentRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#2b2d31] flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-[#6d6f78]" />
                  </div>
                  <p className="text-sm text-[#b5bac1]">{t('friends.noPending')}</p>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  {pendingRequests.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#b5bac1] px-5 py-2 tracking-wider">{t('friends.incomingRequests')} — {pendingRequests.length}</p>
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 mx-2 hover:bg-[#393c43] rounded-lg transition-all border-b border-[#3f4147]/50 last:border-0">
                          <div className="relative flex-shrink-0">
                            <Avatar className="h-9 w-9">{req.profile.avatarUrl && <AvatarImage src={req.profile.avatarUrl} />}<AvatarFallback className="bg-[#5865f2] text-white font-semibold text-sm">{req.profile.displayName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                            <StatusDot status={req.profile.status} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#f2f3f5] truncate">{req.profile.displayName}</p>
                            <p className="text-xs text-[#b5bac1]">@{req.profile.username} • {t('friends.incomingRequest')}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="icon" onClick={() => handleAccept(req.id)} className="h-8 w-8 rounded-full bg-[#2b2d31] text-[#3ba55d] hover:bg-[#3ba55d] hover:text-white transition-colors" title="Kabul et">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleReject(req.id)} className="h-8 w-8 rounded-full bg-[#2b2d31] text-[#ed4245] hover:bg-[#ed4245] hover:text-white transition-colors" title="Reddet">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {sentRequests.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#b5bac1] px-5 py-2 tracking-wider">{t('friends.sentRequests')} — {sentRequests.length}</p>
                      {sentRequests.map((req) => (
                        <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 mx-2 hover:bg-[#393c43] rounded-lg transition-all border-b border-[#3f4147]/50 last:border-0">
                          <Avatar className="h-9 w-9 flex-shrink-0">{req.profile.avatarUrl && <AvatarImage src={req.profile.avatarUrl} />}<AvatarFallback className="bg-[#5865f2] text-white font-semibold text-sm">{req.profile.displayName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#f2f3f5] truncate">{req.profile.displayName}</p>
                            <p className="text-xs text-[#b5bac1]">{t('friends.sentRequest')}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleReject(req.id)} className="h-8 w-8 rounded-full bg-[#2b2d31] text-[#b5bac1] hover:bg-[#ed4245] hover:text-white transition-colors"><X className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="add" className="px-4 py-6 mt-0">
              <div className="max-w-lg">
                <h3 className="text-base font-semibold text-[#f2f3f5] mb-1">{t('friends.addFriendTitle')}</h3>
                <p className="text-sm text-[#b5bac1] mb-4">{t('friends.addFriendDesc')}</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6d6f78]" />
                    <Input
                      placeholder={t('friends.usernamePlaceholder')}
                      value={searchUsername}
                      onChange={(e) => setSearchUsername(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                      className="bg-[#1e1f22] border-[#1e1f22] text-[#dbdee1] placeholder-[#6d6f78] focus-visible:ring-[#5865f2]/50 h-10 pl-9"
                    />
                  </div>
                  <Button onClick={handleSendRequest} disabled={loading || !searchUsername.trim()} className="bg-[#5865f2] hover:bg-[#4752c4] text-white h-10 px-4 font-medium">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('friends.send')}
                  </Button>
                </div>

                {/* Tips */}
                <div className="mt-6 rounded-xl bg-[#2b2d31] border border-[#3f4147] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#b5bac1] uppercase tracking-wider">İpuçları</p>
                  <div className="space-y-2 text-xs text-[#6d6f78]">
                    <p>• Kullanıcı adını tam olarak gir (küçük harf, sayı, alt çizgi)</p>
                    <p>• Arkadaşın kabul etmesi gerekiyor</p>
                    <p>• Bekleyen istekleri Bekleyen sekmesinden takip et</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="blocked" className="px-0 py-0 mt-0">
              {blockedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-[#2b2d31] flex items-center justify-center mb-4">
                    <ShieldOff className="w-8 h-8 text-[#6d6f78]" />
                  </div>
                  <p className="text-[#dbdee1] font-semibold mb-1">Engellenmiş kullanıcı yok</p>
                  <p className="text-[#6d6f78] text-sm">Engellediğin kullanıcılar burada görünür.</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase text-[#b5bac1] px-5 py-2 tracking-wider">Engellenmiş — {blockedUsers.length}</p>
                  {blockedUsers.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#35373c] group/blocked rounded-md mx-1 transition-colors">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        {b.profile.avatarUrl ? <AvatarImage src={b.profile.avatarUrl} /> : null}
                        <AvatarFallback className="bg-[#36393f] text-[#dbdee1] text-sm font-medium">
                          {b.profile.displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#dbdee1] text-sm font-medium truncate">{b.profile.displayName}</p>
                        {b.profile.username && (
                          <p className="text-[#6d6f78] text-xs truncate">@{b.profile.username}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblockUser(b.id, b.profile.displayName)}
                        className="opacity-0 group-hover/blocked:opacity-100 transition-opacity h-8 px-3 text-xs border-[#5865f2] text-[#5865f2] hover:bg-[#5865f2]/10 hover:text-[#5865f2] bg-transparent"
                      >
                        <ShieldOff className="w-3.5 h-3.5 mr-1.5" />
                        Engeli Kaldır
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>

    <BlockConfirmModal
      open={showBlockModal}
      displayName={pendingBlockTarget?.displayName ?? ''}
      onConfirm={async () => {
        if (!pendingBlockTarget) return;
        await handleBlockUser(pendingBlockTarget.userId, pendingBlockTarget.displayName, pendingBlockTarget.friendId);
        setShowBlockModal(false);
        setPendingBlockTarget(null);
      }}
      onCancel={() => { setShowBlockModal(false); setPendingBlockTarget(null); }}
    />
    </>
  );
};

export default DMDashboard;
