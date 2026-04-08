import { useState, useCallback, useEffect, useRef } from 'react';
import ServerSidebar from '@/components/ServerSidebar';
import ChannelList from '@/components/ChannelList';
import { useVoiceContext } from '@/contexts/VoiceContext';
import VoiceMeetingRoom from '@/components/VoiceMeetingRoom';
import ChatArea from '@/components/ChatArea';
import MemberList from '@/components/MemberList';
import DMDashboard from '@/components/DMDashboard';
import DMChatArea from '@/components/DMChatArea';
import IncomingCallModal from '@/components/IncomingCallModal';
import OutgoingCallOverlay from '@/components/OutgoingCallOverlay';
import MessageSearchPanel from '@/components/MessageSearchPanel';
import SplashScreen from '@/components/SplashScreen';
import ReleaseNotesModal from '@/components/ReleaseNotesModal';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import NotificationHistory from '@/components/NotificationHistory';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { I18nContext, getTranslationFunction, type Language } from '@/i18n';
import { getHighestPermissions } from '@/lib/permissions';
import { Home, Hash, MessageSquare, Users, Settings, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InAppNotificationToast, { showInAppNotification } from '@/components/InAppNotificationToast';

export type { DbMessage, DbReaction, DbMember, DbChannel, DbServer, DbCategory } from '@/types/chat';

type MobileTab = 'servers' | 'channels' | 'chat' | 'members' | 'settings' | 'voice';

const formatTimestamp = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hour}:${minute}`;
};

const Index = () => {
  const { profile, user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const lang = (profile?.language || 'tr') as Language;
  const i18n = getTranslationFunction(lang);
  const voice = useVoiceContext();
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [splashDone, setSplashDone] = useState(() => sessionStorage.getItem('aurorachat_splash_done') === 'true');
  const [loadingSteps, setLoadingSteps] = useState([
    { label: 'Oturum kontrol ediliyor...', done: false },
    { label: 'Sunucular yükleniyor...', done: false },
    { label: 'Profil hazırlanıyor...', done: false },
  ]);

  const [servers, setServers] = useState<DbServer[]>([]);
  const [activeServer, setActiveServer] = useState('');
  const [activeChannel, setActiveChannel] = useState('');
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [showMembers, setShowMembers] = useState(true);
  const [members, setMembers] = useState<DbMember[]>([]);
  const [myStatus, setMyStatus] = useState<DbMember['status']>('online');
  const prevStatusRef = useRef<DbMember['status']>('online');
  const [reactions, setReactions] = useState<Record<string, DbReaction[]>>({});
  const [typingUsers, setTypingUsers] = useState<{ userId: string; displayName: string }[]>([]);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [selectedDMUser, setSelectedDMUser] = useState<{ userId: string; displayName: string; username: string; avatarUrl: string | null } | null>(null);
  const [dmAutoStartVoice, setDmAutoStartVoice] = useState(false);
  const [dmInitiateCall, setDmInitiateCall] = useState(false);
  const [outgoingCallTarget, setOutgoingCallTarget] = useState<{ userId: string; displayName: string; username: string; avatarUrl: string | null } | null>(null);
  const [dmScrollToMessageId, setDmScrollToMessageId] = useState<string | undefined>(undefined);
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callerName: string; callerAvatar: string | null } | null>(null);
  const [presenceStatuses, setPresenceStatuses] = useState<Map<string, string>>(new Map());
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showNotifHistory, setShowNotifHistory] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [serverEmojis, setServerEmojis] = useState<{ id: string; name: string; image_url: string }[]>([]);
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelRef = useRef(activeChannel);
  const serverRef = useRef(activeServer);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceStatusRef = useRef<Map<string, string>>(new Map());
  const userRef = useRef(user?.id);
  const selectedDMUserRef = useRef<string | null>(null);
  const activeServerRef = useRef(activeServer);
  // Deduplication: tracks message IDs that already triggered a notification
  const shownNotifIds = useRef<Set<string>>(new Set());

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  useEffect(() => {
    channelRef.current = activeChannel;
    serverRef.current = activeServer;
    activeServerRef.current = activeServer;
    userRef.current = user?.id;
  }, [activeChannel, activeServer, user?.id]);

  useEffect(() => {
    selectedDMUserRef.current = selectedDMUser?.userId ?? null;
  }, [selectedDMUser]);

  // Incoming DM call listener via Supabase Realtime broadcast
  useEffect(() => {
    if (!user) return;
    const callChannel = supabase
      .channel(`dm-call-${user.id}`)
      .on('broadcast', { event: 'incoming_call' }, (payload: any) => {
        const { callerId, callerName, callerAvatar } = payload.payload || {};
        if (!callerId) return;
        setIncomingCall({ callerId, callerName: callerName || 'Biri', callerAvatar: callerAvatar || null });
      })
      .subscribe();
    return () => { supabase.removeChannel(callChannel); };
  }, [user?.id]);

  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    const { callerId, callerName, callerAvatar } = incomingCall;
    setIncomingCall(null);
    await supabase.channel(`dm-call-response-${callerId}`).send({
      type: 'broadcast',
      event: 'call_accepted',
      payload: { calleeId: user.id },
    });
    setDmAutoStartVoice(true);
    setSelectedDMUser({ userId: callerId, displayName: callerName, username: '', avatarUrl: callerAvatar });
    setActiveServer('home');
  }, [incomingCall, user]);

  const handleStartCallFromDashboard = useCallback((dmUser: { userId: string; displayName: string; username: string; avatarUrl: string | null }) => {
    setOutgoingCallTarget(dmUser);
  }, []);

  const handleOutgoingCallAccepted = useCallback((dmUser: { userId: string; displayName: string; username: string; avatarUrl: string | null }) => {
    setOutgoingCallTarget(null);
    setSelectedDMUser(dmUser);
    setDmAutoStartVoice(true);
    setActiveServer('home');
  }, []);

  const handleRejectCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    const { callerId } = incomingCall;
    setIncomingCall(null);
    await supabase.channel(`dm-call-response-${callerId}`).send({
      type: 'broadcast',
      event: 'call_rejected',
      payload: { calleeId: user.id },
    });
  }, [incomingCall, user]);

  // Global DM notification listener — saves notification to DB and increments unread count
  // UI notifications (in-app toast + OS notification) are handled by the broadcast listener below
  // to avoid duplicates.
  useEffect(() => {
    if (!user) return;
    const dmNotifChannel = supabase
      .channel('global-dm-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;
          // Skip if user is currently viewing this DM conversation
          if (selectedDMUserRef.current === msg.sender_id && activeServerRef.current === 'home') return;
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', msg.sender_id)
            .maybeSingle();
          const senderName = (senderProfile as any)?.display_name || (senderProfile as any)?.username || 'Biri';
          const body: string = msg.content || '';
          const notifTitle = `${senderName} sana mesaj gönderdi`;
          const notifBody = body.length > 100 ? body.slice(0, 100) + '…' : body || '📎 Dosya';
          const { error } = await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'dm',
            title: notifTitle,
            body: notifBody,
            data: { conversation_id: msg.conversation_id, message_id: msg.id, sender_id: msg.sender_id },
            read: false,
          } as any);
          if (!error) {
            setUnreadNotifCount((prev) => prev + 1);
          }
          // Show in-app + OS notification; deduplication prevents double-show if broadcast also fires
          const dedupKey = `dm-${msg.id}`;
          if (shownNotifIds.current.has(dedupKey)) return;
          shownNotifIds.current.add(dedupKey);
          setTimeout(() => shownNotifIds.current.delete(dedupKey), 10000);
          showInAppNotification({ id: dedupKey, type: 'dm', title: notifTitle, body: notifBody, conversationId: msg.conversation_id, messageId: msg.id });
          if ('Notification' in window && Notification.permission === 'granted') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(notifTitle, { body: notifBody, icon: '/favicon.ico', tag: dedupKey, data: { conversation_id: msg.conversation_id, message_id: msg.id } });
              }).catch(() => { new Notification(notifTitle, { body: notifBody, icon: '/favicon.ico', tag: dedupKey }); });
            } else {
              new Notification(notifTitle, { body: notifBody, icon: '/favicon.ico', tag: dedupKey });
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(dmNotifChannel); };
  }, [user?.id]);

  // Broadcast-based DM notification listener — fires even if RLS blocks postgres_changes
  useEffect(() => {
    if (!user) return;
    const broadcastCh = supabase
      .channel(`dm-notify-${user.id}`)
      .on('broadcast', { event: 'new-dm' }, ({ payload }) => {
        const { senderId, senderName, body, conversationId, messageId } = payload || {};
        if (!senderId || senderId === user.id) return;
        // Don't notify if user is already viewing this DM conversation
        if (selectedDMUserRef.current === senderId && activeServerRef.current === 'home') return;
        // Deduplication: if postgres_changes already showed this notification, skip
        const dedupKey = `dm-${messageId}`;
        if (shownNotifIds.current.has(dedupKey)) return;
        shownNotifIds.current.add(dedupKey);
        setTimeout(() => shownNotifIds.current.delete(dedupKey), 10000);
        const notifTitle = `${senderName || 'Biri'} sana mesaj gönderdi`;
        const notifBody = (body || '📎 Dosya').slice(0, 100);
        showInAppNotification({ id: dedupKey, type: 'dm', title: notifTitle, body: notifBody, conversationId, messageId });
        if ('Notification' in window && Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(notifTitle, { body: notifBody, icon: '/favicon.ico', tag: dedupKey, data: { conversation_id: conversationId, message_id: messageId } });
            }).catch(() => { new Notification(notifTitle, { body: notifBody, icon: '/favicon.ico', tag: dedupKey }); });
          } else {
            new Notification(notifTitle, { body: notifBody, icon: '/favicon.ico', tag: dedupKey });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(broadcastCh); };
  }, [user?.id]);

  // Register service worker and request browser notification permission
  useEffect(() => {
    if (!user) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('message', (event) => {
        const d = event.data;
        if (d?.type === 'navigate' && d.channel_id) {
          const target = servers.flatMap(s => s.channels).find(c => c.id === d.channel_id);
          if (target) {
            const srv = servers.find(s => s.channels.some(c => c.id === d.channel_id));
            if (srv) { setActiveServer(srv.id); setActiveChannel(target.id); }
          }
        } else if (d?.type === 'navigate_dm' && d.conversation_id) {
          supabase
            .from('dm_conversations')
            .select('user1_id, user2_id')
            .eq('id', d.conversation_id)
            .single()
            .then(({ data: conv }) => {
              if (!conv) return;
              const otherUserId = (conv as any).user1_id === user.id ? (conv as any).user2_id : (conv as any).user1_id;
              supabase
                .from('profiles')
                .select('id, display_name, username, avatar_url')
                .eq('id', otherUserId)
                .single()
                .then(({ data: prof }) => {
                  if (!prof) return;
                  setActiveServer('home');
                  setSelectedDMUser({
                    userId: otherUserId,
                    displayName: (prof as any).display_name || prof.username,
                    username: prof.username,
                    avatarUrl: (prof as any).avatar_url || null,
                  });
                });
            });
        }
      });
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [user?.id]);

  // Restore status from localStorage on user load
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`aurorachat_status_${user.id}`);
    if (saved && ['online', 'idle', 'dnd', 'offline'].includes(saved)) {
      // 'idle' was auto-set when page was hidden — restore to 'online' if user is actively here
      if (saved === 'idle' && !document.hidden) {
        setMyStatus('online');
        localStorage.setItem(`aurorachat_status_${user.id}`, 'online');
      } else {
        setMyStatus(saved as DbMember['status']);
      }
    }
  }, [user?.id]);

  // Persist status to localStorage whenever it changes
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`aurorachat_status_${user.id}`, myStatus);
  }, [myStatus, user?.id]);

  // Sync user status to profiles table (realtime for other users)
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').update({ status: myStatus as any }).eq('id', user.id).then(() => {});
  }, [myStatus, user?.id]);

  // Save last visited server/channel/DM to localStorage
  useEffect(() => {
    if (!user || !activeServer) return;
    const navKey = `aurorachat_nav_${user.id}`;
    if (activeServer === 'home') {
      localStorage.setItem(navKey, JSON.stringify({ serverId: 'home' }));
    } else {
      localStorage.setItem(navKey, JSON.stringify({ serverId: activeServer, channelId: activeChannel }));
    }
  }, [activeServer, activeChannel, user?.id]);

  // Idle detection — skip if user is actively in a voice channel
  const previousStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const handleVisibility = () => {
      const inVoice = voice.connected;
      if (document.hidden && myStatus === 'online' && !inVoice) {
        previousStatusRef.current = myStatus;
        setMyStatus('idle');
      } else if (!document.hidden && previousStatusRef.current && !inVoice) {
        setMyStatus(previousStatusRef.current as DbMember['status']);
        previousStatusRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [myStatus, voice.connected]);

  // Global open-dm event listener (from UserProfileCard without onSendMessage prop)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { userId, displayName, username, avatarUrl } = e.detail;
      setActiveServer('home');
      setSelectedDMUser({ userId, displayName, username, avatarUrl });
      if (isMobile) setMobileTab('chat');
    };
    window.addEventListener('open-dm', handler as EventListener);
    return () => window.removeEventListener('open-dm', handler as EventListener);
  }, [isMobile]);

  // Auto-switch to voice tab on mobile when joining a voice channel
  useEffect(() => {
    if (isMobile && voice.connected) {
      setMobileTab('voice');
    } else if (isMobile && !voice.connected) {
      setMobileTab((prev) => (prev === 'voice' ? 'chat' : prev));
    }
  }, [isMobile, voice.connected]);

  const fetchServers = useCallback(async () => {
    const { data: memberRows } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', user?.id || '');
    
    if (!memberRows || memberRows.length === 0) {
      setServers([]);
      setActiveServer('home');
      return;
    }

    const serverIds = memberRows.map(m => m.server_id);
    const { data: serversData } = await supabase
      .from('servers')
      .select('*')
      .in('id', serverIds)
      .order('created_at', { ascending: true });

    const { data: channelsData } = await supabase
      .from('channels')
      .select('*')
      .in('server_id', serverIds)
      .order('position', { ascending: true });

    const { data: categoriesData } = await supabase
      .from('channel_categories')
      .select('*')
      .in('server_id', serverIds)
      .order('position', { ascending: true });

    if (serversData && channelsData) {
      const mapped: DbServer[] = serversData.map((s) => ({
        id: s.id,
        name: s.name,
        icon: (s as any).icon || s.name.charAt(0).toUpperCase(),
        owner_id: s.owner_id,
        word_filter: (s as any).word_filter || [],
        channels: channelsData
          .filter((c) => c.server_id === s.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type as 'text' | 'voice',
            position: c.position,
            category_id: (c as any).category_id || null,
            is_locked: (c as any).is_locked || false,
            slow_mode_interval: (c as any).slow_mode_interval || 0,
          })),
        categories: (categoriesData || [])
          .filter((cat: any) => cat.server_id === s.id)
          .map((cat: any) => ({ id: cat.id, name: cat.name, position: cat.position, server_id: cat.server_id })),
      }));
      setServers(mapped);
      if (!activeServer && mapped.length > 0) {
        const navKey = `aurorachat_nav_${user?.id}`;
        const savedNav = localStorage.getItem(navKey);
        if (savedNav) {
          try {
            const nav = JSON.parse(savedNav);
            if (nav.serverId === 'home') {
              setActiveServer('home');
            } else if (nav.serverId) {
              const srv = mapped.find(s => s.id === nav.serverId);
              if (srv) {
                setActiveServer(nav.serverId);
                const ch = nav.channelId ? srv.channels.find(c => c.id === nav.channelId) : null;
                setActiveChannel(ch ? nav.channelId : (srv.channels[0]?.id || ''));
              } else {
                setActiveServer(mapped[0].id);
                setActiveChannel(mapped[0].channels[0]?.id || '');
              }
            } else {
              setActiveServer(mapped[0].id);
              setActiveChannel(mapped[0].channels[0]?.id || '');
            }
          } catch {
            setActiveServer(mapped[0].id);
            setActiveChannel(mapped[0].channels[0]?.id || '');
          }
        } else {
          setActiveServer(mapped[0].id);
          const firstChannel = mapped[0].channels[0];
          if (firstChannel) setActiveChannel(firstChannel.id);
        }
      }
    }
  }, [user?.id]);

  // Fetch initial unread notification count
  useEffect(() => {
    if (!user) return;
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadNotifCount(count || 0));
  }, [user?.id]);

  // Splash + init
  useEffect(() => {
    if (!user) return;
    const initApp = async () => {
      setLoadingSteps(prev => prev.map((s, i) => i === 0 ? { ...s, done: true } : s));
      await fetchServers();
      setLoadingSteps(prev => prev.map((s, i) => i <= 1 ? { ...s, done: true } : s));
      setLoadingSteps(prev => prev.map((s) => ({ ...s, done: true })));
    };
    initApp();
  }, [user]);

  // Fetch members with role info
  const fetchMembers = useCallback(async () => {
    if (!activeServer || activeServer === 'home') return;
    const { data: memberRows } = await supabase
      .from('server_members')
      .select('id, user_id')
      .eq('server_id', activeServer);
    if (!memberRows) return;
    const userIds = memberRows.map((m) => m.user_id);
    if (userIds.length === 0) { setMembers([]); return; }
    const memberIds = memberRows.map((m) => m.id);

    const [profilesRes, memberRolesRes, serverRolesRes] = await Promise.all([
      supabase.from('profiles').select('*').in('id', userIds),
      supabase.from('server_member_roles').select('member_id, role_id').in('member_id', memberIds),
      supabase.from('server_roles').select('id, name, color, position, permissions').eq('server_id', activeServer).order('position', { ascending: false }),
    ]);

    const profiles = profilesRes.data || [];
    const memberRoles = (memberRolesRes.data || []) as { member_id: string; role_id: string }[];
    const serverRoles = (serverRolesRes.data || []) as { id: string; name: string; color: string; position: number; permissions: any }[];

    setMembers(memberRows.map((m) => {
      const p = profiles.find((pr: any) => pr.id === m.user_id);
      const userRoleIds = memberRoles.filter(mr => mr.member_id === m.id).map(mr => mr.role_id);
      const userRoles = serverRoles.filter(r => userRoleIds.includes(r.id));
      const topRole = userRoles.length > 0 ? userRoles[0] : null;

      return {
        id: m.user_id,
        name: (p as any)?.display_name || (p as any)?.username || 'Kullanıcı',
        username: (p as any)?.username || '',
        avatar: ((p as any)?.display_name || (p as any)?.username || '?').charAt(0).toUpperCase(),
        avatarUrl: (p as any)?.avatar_url || null,
        status: (presenceStatusRef.current.get(m.user_id) as DbMember['status']) || 'offline',
        role: topRole?.name,
        roleColor: topRole?.color,
        rolePosition: topRole?.position,
        roleId: topRole?.id,
        roleGradientEnd: topRole?.permissions?.['gradient_end_color'] || undefined,
      };
    }));
  }, [activeServer]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Fetch current user's permissions (useCallback so realtime subscriptions can call it)
  const fetchPerms = useCallback(async () => {
    if (!activeServer || activeServer === 'home' || !user) { setUserPermissions({}); return; }
    const { data: member } = await supabase.from('server_members').select('id').eq('server_id', activeServer).eq('user_id', user.id).single();
    if (!member) { setUserPermissions({}); return; }
    const { data: memberRoles } = await supabase.from('server_member_roles').select('role_id').eq('member_id', member.id);
    if (!memberRoles || memberRoles.length === 0) { setUserPermissions({}); return; }
    const roleIds = memberRoles.map((mr: any) => mr.role_id);
    const { data: roles } = await supabase.from('server_roles').select('permissions').in('id', roleIds);
    if (roles) {
      setUserPermissions(getHighestPermissions(roles.map((r: any) => ({ permissions: r.permissions || {} }))));
    }
  }, [activeServer, user]);

  // Real-time: member list updates for role changes and joins/kicks
  // NOTE: DELETE subscriptions intentionally have NO filter because Supabase Postgres Changes
  // requires REPLICA IDENTITY FULL on the table to evaluate filters on old row data.
  // Without it, a filtered DELETE subscription fires no events at all.
  // fetchMembers() itself only fetches for activeServer, so unfiltered is safe.
  useEffect(() => {
    if (!activeServer || activeServer === 'home') return;
    const ch = supabase
      .channel(`member-list-rt-${activeServer}`)
      // Role assignments/removals — no server_id column so can't filter; fetchMembers scopes to activeServer
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_member_roles' }, () => {
        fetchMembers();
        fetchServers();
        fetchPerms();
      })
      // Role position/name/color changes → update member list ordering & colors
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_roles', filter: `server_id=eq.${activeServer}` }, () => {
        fetchMembers();
        fetchPerms();
      })
      // INSERT: new row data available → filter works fine
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'server_members', filter: `server_id=eq.${activeServer}` }, () => {
        fetchMembers();
      })
      // UPDATE: new row data available → filter works fine
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'server_members', filter: `server_id=eq.${activeServer}` }, () => {
        fetchMembers();
      })
      // DELETE: REPLICA IDENTITY FULL olmadan eski satır verisi yok → filtersiz dinle (fetchMembers zaten activeServer'a göre filtreler)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'server_members' }, () => {
        fetchMembers();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeServer, fetchMembers, fetchPerms]);

  // Fetch server emojis
  useEffect(() => {
    if (!activeServer || activeServer === 'home') { setServerEmojis([]); return; }
    supabase.from('server_emojis').select('id, name, image_url')
      .eq('server_id', activeServer)
      .then(({ data }) => setServerEmojis(data || []));
  }, [activeServer]);

  useEffect(() => { fetchPerms(); }, [fetchPerms]);

  // Fetch messages
  useEffect(() => {
    if (!activeServer || activeServer === 'home' || !activeChannel) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', activeChannel)
        .order('inserted_at', { ascending: true });

      if (data) {
        const userIds = [...new Set(data.map((m) => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, avatar_url, display_name, username')
          .in('id', userIds);
        const avatarMap = new Map(profiles?.map((p) => [p.id, p.avatar_url]) || []);
        const nameMap = new Map(profiles?.map((p) => [p.id, (p as any).display_name || p.username]) || []);

        setMessages(
          data.map((m) => {
            const isBot = (m as any).author_name === 'AuroraChat Bot';
            // Sanitize unreplaced {user} placeholders in bot messages (fallback for old trigger)
            const content = isBot && m.content ? m.content.replace(/\{user\}/g, 'kullanıcı').replace(/\{server\}/g, '') : m.content;
            return {
              id: m.id,
              author: (m as any).author_name || nameMap.get(m.user_id) || 'Kullanıcı',
              avatar: ((m as any).author_name || nameMap.get(m.user_id) || '?').charAt(0).toUpperCase(),
              avatarUrl: isBot ? '/aurora-bot-avatar.jpg' : (avatarMap.get(m.user_id) || null),
              userId: isBot ? 'aurora-bot' : m.user_id,
              isBot,
              content,
              timestamp: formatTimestamp(m.inserted_at),
              edited: !!(m as any).updated_at && (m as any).updated_at !== m.inserted_at,
              attachments: (m as any).attachments || undefined,
              replyTo: (m as any).reply_to || undefined,
              isPinned: (m as any).is_pinned || false,
            };
          })
        );
      }
    };
    fetchMessages();
  }, [activeServer, activeChannel]);

  // Realtime messages
  useEffect(() => {
    const channel = supabase
      .channel('realtime-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const m = payload.new as any;
        const isBot = m.author_name === 'AuroraChat Bot';

        if (m.channel_id === channelRef.current) {
          // Message in the currently active channel
          if (m.user_id === userRef.current) {
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === m.id)) return prev;
              // Bot messages from the current user are added locally via onBotMessage — skip realtime duplicate
              if (isBot) return prev;
              const hasTempMsg = prev.some((msg) => msg.userId === m.user_id && msg.status === 'sending');
              if (hasTempMsg) return prev;
              return [...prev, {
                id: m.id, author: m.author_name || 'Kullanıcı', avatar: (m.author_name || '?').charAt(0).toUpperCase(),
                avatarUrl: null, userId: m.user_id,
                isBot: false, content: m.content, timestamp: formatTimestamp(m.inserted_at),
                attachments: m.attachments || undefined,
              }];
            });
            return;
          }
          const prof = isBot ? null : (await supabase.from('profiles').select('avatar_url, display_name, username').eq('id', m.user_id).maybeSingle()).data;
          const rtContent = isBot && m.content ? m.content.replace(/\{user\}/g, 'kullanıcı').replace(/\{server\}/g, '') : m.content;
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === m.id)) return prev;
            return [...prev, {
              id: m.id, author: m.author_name || (prof as any)?.display_name || (prof as any)?.username || 'Kullanıcı',
              avatar: (m.author_name || '?').charAt(0).toUpperCase(),
              avatarUrl: isBot ? '/aurora-bot-avatar.jpg' : (prof?.avatar_url || null),
              userId: isBot ? 'aurora-bot' : m.user_id,
              isBot, content: rtContent, timestamp: formatTimestamp(m.inserted_at),
              attachments: m.attachments || undefined,
            }];
          });
        } else if (m.channel_id && m.user_id !== userRef.current) {
          // Message in a different channel — mark as unread (includes bot messages)
          setUnreadChannels(prev => { const next = new Set(prev); next.add(m.channel_id); return next; });
        }

        // Mention detection — fires for ALL channels (including when you're on DM page)
        if (!isBot && m.user_id !== userRef.current && userRef.current && profile) {
          const myDisplayName = profile.display_name || '';
          const myUsername = profile.username || '';
          const content: string = m.content || '';
          const isMentioned =
            (myDisplayName && content.toLowerCase().includes(`@${myDisplayName.toLowerCase()}`)) ||
            (myUsername && content.toLowerCase().includes(`@${myUsername.toLowerCase()}`));
          if (isMentioned) {
            const notifTitle = `${m.author_name || 'Birisi'} seni etiketledi`;
            const notifBody = content.length > 100 ? content.slice(0, 100) + '…' : content;
            supabase.from('notifications').insert({
              user_id: userRef.current,
              type: 'mention',
              title: notifTitle,
              body: notifBody,
              data: { channel_id: m.channel_id, message_id: m.id },
              read: false,
            }).then(({ error }) => {
              if (error) console.warn('Mention notification insert failed:', error.message);
              else setUnreadNotifCount((prev) => prev + 1);
            });
            showInAppNotification({
              id: `mention-${m.id}`,
              type: 'mention',
              title: notifTitle,
              body: notifBody,
              channelId: m.channel_id,
              messageId: m.id,
            });
            // Push notification is sent server-side via DB trigger on notifications table
            // Local notification is shown only when the user is active (foreground)
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as any;
        if (m.channel_id === channelRef.current) {
          setMessages((prev) => prev.map((msg) => msg.id === m.id ? { ...msg, content: m.content, edited: true, isPinned: m.is_pinned } : msg));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const old = payload.old as any;
        if (old?.id) setMessages((prev) => prev.filter((m) => m.id !== old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
        const r = payload.new as any;
        setReactions((prev) => {
          const list = [...(prev[r.message_id] || [])];
          const idx = list.findIndex((e) => e.emoji === r.emoji);
          if (idx !== -1) {
            if (!list[idx].userIds.includes(r.user_id)) {
              list[idx] = { ...list[idx], userIds: [...list[idx].userIds, r.user_id], count: list[idx].count + 1 };
            }
          } else {
            list.push({ emoji: r.emoji, userIds: [r.user_id], count: 1 });
          }
          return { ...prev, [r.message_id]: list };
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        const old = payload.old as any;
        if (old?.message_id && old?.emoji && old?.user_id) {
          // REPLICA IDENTITY FULL is set — apply optimistic update immediately
          setReactions((prev) => {
            const list = (prev[old.message_id] || [])
              .map((e) => e.emoji === old.emoji
                ? { ...e, userIds: e.userIds.filter((id) => id !== old.user_id), count: e.count - 1 }
                : e)
              .filter((e) => e.count > 0);
            return { ...prev, [old.message_id]: list };
          });
        } else {
          // REPLICA IDENTITY FULL not set — refetch after a brief delay to ensure DB committed
          setTimeout(() => fetchReactionsRef.current(), 120);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime channels/servers – all table listeners on a SINGLE channel to minimise concurrent subscriptions
  useEffect(() => {
    const globalRealtime = supabase
      .channel('global-app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => { fetchServers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, () => { fetchServers(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'server_members' }, async (payload) => {
        fetchMembers();
        await fetchServers();
        const inserted = (payload.new as any);
        if (inserted?.user_id && user && inserted.user_id === user.id && inserted.server_id) {
          const newServerId = inserted.server_id;
          setActiveServer(newServerId);
          setTimeout(() => {
            setServers(prev => {
              const srv = prev.find(s => s.id === newServerId);
              if (srv && srv.channels.length > 0) {
                const firstTextChannel = srv.channels.find(c => c.type === 'text') || srv.channels[0];
                setActiveChannel(firstTextChannel.id);
              }
              return prev;
            });
          }, 400);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'server_members' }, () => { fetchMembers(); fetchServers(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'server_members' }, (payload) => {
        const deleted = payload.old as any;
        if (deleted?.user_id && user && deleted.user_id === user.id) {
          const kickedFromServer = deleted.server_id;
          toast.error('Sunucudan çıkarıldınız', { description: 'Bir yönetici sizi bu sunucudan çıkardı.' });
          if (kickedFromServer === serverRef.current) {
            setActiveServer('home');
            setActiveChannel('');
          }
          fetchServers();
        } else {
          fetchMembers();
          fetchServers();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new as any;
        setMembers((prev) => prev.map((m) => m.id === updated.id ? { ...m, name: updated.display_name || updated.username, avatar: (updated.display_name || updated.username)?.charAt(0)?.toUpperCase() || '?', avatarUrl: updated.avatar_url || null } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(globalRealtime); };
  }, [fetchServers, fetchMembers]);

  // Presence
  useEffect(() => {
    if (!user) return;
    const presenceChannel = supabase.channel('presence-room', { config: { presence: { key: user.id } } });
    presenceChannelRef.current = presenceChannel;
    const ua = navigator.userAgent;
    const myPlatform: DbMember['platform'] = /Mobi|Android/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';
    const presencePlatformRef = new Map<string, DbMember['platform']>();
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ status: string; platform?: string }>();
        const presenceMap = new Map<string, string>();
        for (const [userId, presences] of Object.entries(state)) {
          const latest = presences[presences.length - 1];
          presenceMap.set(userId, latest?.status || 'online');
          if (latest?.platform) {
            presencePlatformRef.set(userId, latest.platform as DbMember['platform']);
          }
        }
        presenceStatusRef.current = presenceMap;
        setPresenceStatuses(new Map(presenceMap));
        setMembers((prev) => prev.map((m) => ({
          ...m,
          status: (presenceMap.get(m.id) as DbMember['status']) || 'offline',
          platform: presencePlatformRef.get(m.id) || m.platform,
        })));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ status: myStatus, platform: myPlatform });
          presenceStatusRef.current.set(user.id, myStatus);
        }
      });
    return () => { presenceChannelRef.current = null; supabase.removeChannel(presenceChannel); };
  }, [user]);

  useEffect(() => {
    if (!presenceChannelRef.current || !user) return;
    presenceChannelRef.current.track({ status: myStatus });
    presenceStatusRef.current.set(user.id, myStatus);
    setPresenceStatuses(prev => { const next = new Map(prev); next.set(user.id, myStatus); return next; });
    setMembers((prev) => prev.map((m) => (m.id === user.id ? { ...m, status: myStatus } : m)));
  }, [myStatus]);

  // Global: register/refresh current device session in DB (heartbeat every 5 min)
  useEffect(() => {
    if (!user) return;
    const registerSession = async () => {
      let key = localStorage.getItem('aurora_session_key');
      if (!key) { key = crypto.randomUUID(); localStorage.setItem('aurora_session_key', key); }
      if (!localStorage.getItem('aurora_session_created')) {
        localStorage.setItem('aurora_session_created', new Date().toISOString());
      }
      const ua = navigator.userAgent;
      const deviceType = /Mobi|Android/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';
      const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Bilinmeyen';
      const os = /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : /Android/.test(ua) ? 'Android' : /iOS|iPhone|iPad/.test(ua) ? 'iOS' : 'Bilinmeyen';
      await (supabase.from('user_sessions') as any).upsert({
        user_id: user.id, session_key: key, device_type: deviceType, browser, os,
        last_seen: new Date().toISOString(), is_active: true,
      }, { onConflict: 'user_id,session_key' });
    };
    registerSession();
    const interval = setInterval(registerSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Global force-logout via Broadcast — no DB replication lag, works instantly
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`force-logout:${user.id}`)
      .on('broadcast', { event: 'force-logout' }, ({ payload }) => {
        const currentSessionKey = localStorage.getItem('aurora_session_key');
        if (payload?.sessionKey && payload.sessionKey === currentSessionKey) {
          localStorage.removeItem('aurora_session_key');
          localStorage.removeItem('aurora_session_created');
          signOut();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, signOut]);

  // Listen for kick/ban events broadcast by admins
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-actions:${user.id}`)
      .on('broadcast', { event: 'member-kicked' }, ({ payload }) => {
        const kickedFromServer = payload?.server_id;
        toast.error('Sunucudan çıkarıldınız', { description: 'Bir yönetici sizi bu sunucudan çıkardı.' });
        if (kickedFromServer && kickedFromServer === serverRef.current) {
          setActiveServer('home');
          setActiveChannel('');
        }
        fetchServers();
      })
      .on('broadcast', { event: 'member-banned' }, ({ payload }) => {
        const bannedFromServer = payload?.server_id;
        toast.error('Yasaklandınız', { description: 'Bir yönetici sizi bu sunucudan yasakladı.' });
        if (bannedFromServer && bannedFromServer === serverRef.current) {
          setActiveServer('home');
          setActiveChannel('');
        }
        fetchServers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchServers]);

  // Refresh server list when joining via DM embed invite link
  useEffect(() => {
    if (!user) return;
    const handler = (e: Event) => {
      const serverId = (e as CustomEvent).detail?.serverId;
      fetchServers().then(() => {
        if (serverId) {
          setActiveServer(serverId);
        }
      });
    };
    window.addEventListener('aurorachat:server-joined', handler);
    return () => window.removeEventListener('aurorachat:server-joined', handler);
  }, [user, fetchServers]);

  // Typing indicators
  useEffect(() => {
    if (!activeChannel || !user) { setTypingUsers([]); typingChannelRef.current = null; return; }
    const typingChannel = supabase.channel(`typing-${activeChannel}`);
    typingChannelRef.current = typingChannel;
    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, displayName } = payload.payload as { userId: string; displayName: string };
        if (userId === user.id) return;
        setTypingUsers((prev) => prev.some((t) => t.userId === userId) ? prev : [...prev, { userId, displayName }]);
        const existing = typingTimeoutsRef.current.get(userId);
        if (existing) clearTimeout(existing);
        const timeout = setTimeout(() => { setTypingUsers((prev) => prev.filter((t) => t.userId !== userId)); typingTimeoutsRef.current.delete(userId); }, 3000);
        typingTimeoutsRef.current.set(userId, timeout);
      })
      .on('broadcast', { event: 'stop_typing' }, (payload) => {
        const { userId } = payload.payload as { userId: string };
        setTypingUsers((prev) => prev.filter((t) => t.userId !== userId));
        const existing = typingTimeoutsRef.current.get(userId);
        if (existing) { clearTimeout(existing); typingTimeoutsRef.current.delete(userId); }
      })
      .subscribe();
    return () => { setTypingUsers([]); typingTimeoutsRef.current.forEach((t) => clearTimeout(t)); typingTimeoutsRef.current.clear(); typingChannelRef.current = null; supabase.removeChannel(typingChannel); };
  }, [activeChannel, user?.id]);

  const handleTypingStart = useCallback(() => {
    if (!activeChannel || !user || !profile || !typingChannelRef.current) return;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, displayName: profile.display_name } });
  }, [activeChannel, user, profile]);

  const handleTypingStop = useCallback(() => {
    if (!activeChannel || !user || !typingChannelRef.current) return;
    typingChannelRef.current.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: user.id } });
  }, [activeChannel, user]);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const fetchReactionsForCurrentChannel = useCallback(async () => {
    const currentMessages = messagesRef.current;
    if (!currentMessages.length) return;
    const messageIds = currentMessages.map((m) => m.id).filter(id => !id.startsWith('bot-'));
    if (messageIds.length === 0) return;
    const { data } = await supabase.from('message_reactions').select('*').in('message_id', messageIds);
    if (data) {
      const grouped: Record<string, DbReaction[]> = {};
      for (const r of data) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        const existing = grouped[r.message_id].find((e) => e.emoji === r.emoji);
        if (existing) { existing.userIds.push(r.user_id); existing.count++; }
        else { grouped[r.message_id].push({ emoji: r.emoji, userIds: [r.user_id], count: 1 }); }
      }
      setReactions(grouped);
    }
  }, []);

  const fetchReactionsRef = useRef(fetchReactionsForCurrentChannel);
  useEffect(() => { fetchReactionsRef.current = fetchReactionsForCurrentChannel; }, [fetchReactionsForCurrentChannel]);

  // Reactions
  useEffect(() => {
    if (!activeChannel || messages.length === 0) { setReactions({}); return; }
    fetchReactionsForCurrentChannel();
  }, [activeChannel, messages.length, fetchReactionsForCurrentChannel]);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const msgReactions = reactions[messageId] || [];
    const existing = msgReactions.find((r) => r.emoji === emoji);
    const hasReacted = existing?.userIds.includes(user.id);
    const previousReactions = { ...reactions };
    setReactions((prev) => {
      const copy = { ...prev };
      const list = [...(copy[messageId] || [])];
      if (hasReacted) {
        const updated = list.map((e) => e.emoji === emoji ? { ...e, userIds: e.userIds.filter((id) => id !== user.id), count: e.count - 1 } : e).filter((e) => e.count > 0);
        copy[messageId] = updated;
      } else {
        const idx = list.findIndex((e) => e.emoji === emoji);
        if (idx !== -1) { list[idx] = { ...list[idx], userIds: [...list[idx].userIds, user.id], count: list[idx].count + 1 }; }
        else { list.push({ emoji, userIds: [user.id], count: 1 }); }
        copy[messageId] = list;
      }
      return copy;
    });
    const { error } = hasReacted
      ? await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji)
      : await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    if (error) setReactions(previousReactions);
  }, [user, reactions]);

  const server = servers.find((s) => s.id === activeServer) || servers[0];
  const channel = server?.channels.find((c) => c.id === activeChannel) || server?.channels[0];
  const isOwner = server?.owner_id === user?.id;

  const handleServerChange = useCallback((id: string) => {
    if (id === 'home') { setActiveServer('home'); if (isMobile) setMobileTab('chat'); return; }
    const s = servers.find((s) => s.id === id);
    if (s) { setActiveServer(id); const firstChannel = s.channels[0]; if (firstChannel) setActiveChannel(firstChannel.id); if (isMobile) setMobileTab('channels'); }
  }, [servers, isMobile]);

  const handleServerCreated = useCallback(async (newServerId: string) => {
    await fetchServers();
    // Navigate to the newly created/joined server
    if (newServerId) {
      setActiveServer(newServerId);
      // Small delay to let fetchServers populate, then select first channel
      setTimeout(() => {
        setServers(prev => {
          const srv = prev.find(s => s.id === newServerId);
          if (srv && srv.channels.length > 0) {
            setActiveChannel(srv.channels[0].id);
          }
          return prev;
        });
      }, 300);
      if (isMobile) setMobileTab('channels');
    }
  }, [fetchServers, isMobile]);

  const handleChannelChange = useCallback((id: string) => {
    setActiveChannel(id);
    setUnreadChannels(prev => { const next = new Set(prev); next.delete(id); return next; });
    if (isMobile) setMobileTab('chat');
  }, [isMobile]);

  const handleNavigateToMessage = useCallback(async (channelOrConvId: string, messageId?: string) => {
    const srv = servers.find(s => s.channels.some(c => c.id === channelOrConvId));
    if (srv) {
      setActiveServer(srv.id);
      setActiveChannel(channelOrConvId);
      setShowNotifHistory(false);
      if (messageId) setTimeout(() => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('bg-primary/10'); setTimeout(() => el.classList.remove('bg-primary/10'), 2000); }
      }, 300);
      return;
    }
    if (!user) return;
    try {
      const { data: conv } = await supabase
        .from('dm_conversations')
        .select('user1_id, user2_id')
        .eq('id', channelOrConvId)
        .single();
      if (conv) {
        const otherUserId = (conv as any).user1_id === user.id ? (conv as any).user2_id : (conv as any).user1_id;
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .eq('id', otherUserId)
          .single();
        if (prof) {
          setActiveServer('home');
          setSelectedDMUser({
            userId: otherUserId,
            displayName: (prof as any).display_name || prof.username,
            username: prof.username,
            avatarUrl: (prof as any).avatar_url || null,
          });
          setDmScrollToMessageId(messageId);
          setShowNotifHistory(false);
        }
      }
    } catch { }
  }, [servers, user]);

  const handleSendMessage = useCallback(async (content: string, files?: File[], replyTo?: string) => {
    if (!user || !profile) return;
    const tempId = crypto.randomUUID();
    const replyMsg = replyTo ? messages.find(m => m.id === replyTo) : undefined;
    
    // Upload files if present
    let attachmentUrls: string[] | undefined;
    if (files && files.length > 0) {
      try {
        const urls: string[] = [];
        for (const file of files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${user.id}/channels/${activeChannel}/${tempId}/${crypto.randomUUID()}_${safeName}`;
          const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file);
          if (uploadError) {
            console.error('File upload error:', uploadError);
            toast.error(`Dosya yüklenemedi: ${file.name}`);
            continue;
          }
          const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
          urls.push(`${urlData.publicUrl}?originalName=${encodeURIComponent(file.name)}&size=${file.size}`);
        }
        attachmentUrls = urls.length > 0 ? urls : undefined;
        if (!attachmentUrls && !content.trim()) return;
      } catch (err) {
        console.error('Upload failed:', err);
        toast.error('Dosya yükleme hatası');
        if (!content.trim()) return;
      }
    }

    const optimisticMsg: DbMessage = {
      id: tempId, author: profile.display_name || profile.username, avatar: (profile.display_name || profile.username)?.charAt(0)?.toUpperCase() || '?',
      avatarUrl: profile.avatar_url || null, userId: user.id, content, timestamp: formatTimestamp(new Date().toISOString()),
      edited: false, status: 'sending', replyTo: replyTo || undefined, replyAuthor: replyMsg?.author, replyContent: replyMsg?.content,
      attachments: attachmentUrls,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const insertData: any = { channel_id: activeChannel, user_id: user.id, author_name: profile.display_name || profile.username, content: content || '' };
    if (activeServer && activeServer !== 'home') insertData.server_id = activeServer;
    if (replyTo) insertData.reply_to = replyTo;
    if (attachmentUrls && attachmentUrls.length > 0) insertData.attachments = attachmentUrls;

    const { data, error } = await supabase.from('messages').insert(insertData).select().single();
    if (error) { setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: 'failed' as const } : m)); }
    else if (data) { setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: data.id, status: undefined } : m)); }
  }, [user, profile, activeServer, activeChannel, messages]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    await supabase.from('messages').update({ content: newContent, updated_at: new Date().toISOString() } as any).eq('id', messageId);
  }, []);

  const handleRetryMessage = useCallback(async (messageId: string, content: string) => {
    if (!user || !profile) return;
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, status: 'sending' as const } : m));
    const { data, error } = await supabase.from('messages').insert({
      server_id: activeServer !== 'home' ? activeServer : undefined, channel_id: activeChannel,
      user_id: user.id, author_name: profile.display_name || profile.username, content,
    } as any).select().single();
    if (error) { setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, status: 'failed' as const } : m)); }
    else if (data) { setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, id: data.id, status: undefined } : m)); }
  }, [user, profile, activeServer, activeChannel]);

  const handleBotMessage = useCallback((content: string) => {
    const botMsg: DbMessage = {
      id: `local-bot-${crypto.randomUUID()}`,
      author: 'AuroraChat Bot',
      avatar: 'A',
      avatarUrl: '/aurora-bot-avatar.jpg',
      userId: 'aurora-bot',
      isBot: true,
      content,
      timestamp: formatTimestamp(new Date().toISOString()),
      edited: false,
    };
    setMessages(prev => [...prev, botMsg]);
  }, []);

  const handleLeaveServer = useCallback(async () => {
    if (!user) return;
    // Send leave message if configured before removing membership
    try {
      const { data: srv } = await supabase.from('servers').select('leave_enabled, leave_message, leave_channel_id, name').eq('id', activeServer).single();
      if (srv && (srv as any).leave_enabled && (srv as any).leave_message && (srv as any).leave_channel_id) {
        const displayName = profile?.display_name || profile?.username || 'Bir üye';
        const content = ((srv as any).leave_message as string)
          .replace(/\{user\}/g, displayName)
          .replace(/\{server\}/g, (srv as any).name || '');
        await supabase.from('messages').insert({
          channel_id: (srv as any).leave_channel_id,
          user_id: user.id,
          author_name: 'AuroraChat Bot',
          content,
          server_id: activeServer,
        } as any);
      }
    } catch { }
    await supabase.from('server_members').delete().eq('server_id', activeServer).eq('user_id', user.id);
    setActiveServer(''); setActiveChannel(''); fetchServers();
  }, [user, profile, activeServer, fetchServers]);

  const handlePinMessage = useCallback(async (messageId: string) => {
    await supabase.from('messages').update({ is_pinned: true } as any).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned: true } : m));
  }, []);

  const handleUnpinMessage = useCallback(async (messageId: string) => {
    await supabase.from('messages').update({ is_pinned: false } as any).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned: false } : m));
  }, []);

  // Update toast — once per session after splash
  useEffect(() => {
    if (!splashDone || !user) return;
    const key = 'aurorachat_update_toast_074';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'true');
    setTimeout(() => {
      toast.success('🎉 AuroraChat 0.7.4 yayınlandı! DM etiketi bildirimleri, kanal okunmamış noktası ve push bildirim iyileştirmeleri.');
    }, 1500);
  }, [splashDone, user]);

  // Splash screen
  const allStepsDone = loadingSteps.every(s => s.done);
  if (!splashDone) {
    return (
      <I18nContext.Provider value={i18n}>
        <SplashScreen steps={loadingSteps} allDone={allStepsDone} onFinish={() => { sessionStorage.setItem('aurorachat_splash_done', 'true'); setSplashDone(true); }} />
      </I18nContext.Provider>
    );
  }

  // Mobile Bottom Navigation Bar — NOT fixed, takes real flex space so content above is never clipped
  const MobileBottomNav = () => {
    const baseTabs = [
      { tab: 'servers' as MobileTab, icon: Home, label: i18n.t('nav.servers') },
      { tab: 'channels' as MobileTab, icon: Hash, label: i18n.t('nav.channels') },
      { tab: 'chat' as MobileTab, icon: MessageSquare, label: i18n.t('nav.chat') },
      { tab: 'members' as MobileTab, icon: Users, label: i18n.t('nav.members') },
      { tab: 'settings' as MobileTab, icon: Settings, label: i18n.t('nav.settings') },
    ];
    const tabs = voice.connected
      ? [
          ...baseTabs.slice(0, 3),
          { tab: 'voice' as MobileTab, icon: Mic, label: 'Ses' },
          ...baseTabs.slice(3),
        ]
      : baseTabs;
    return (
      <div className="w-full bg-card border-t border-border flex items-center justify-around flex-shrink-0" style={{ height: `calc(56px + env(safe-area-inset-bottom))`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={() => {
              if (tab === 'settings') { navigate('/settings'); return; }
              setMobileTab(tab);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-14 transition-colors relative ${
              mobileTab === tab ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {tab === 'voice' && voice.connected && (
              <span className="absolute top-2 right-1/2 translate-x-3 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
            <Icon className={`w-5 h-5 ${mobileTab === tab ? 'text-primary' : tab === 'voice' && voice.connected ? 'text-green-400' : ''}`} />
            <span className={`text-[10px] font-medium ${tab === 'voice' && voice.connected && mobileTab !== 'voice' ? 'text-green-400' : ''}`}>{label}</span>
          </button>
        ))}
      </div>
    );
  };

  // Home / DM view
  if (activeServer === 'home') {
    if (isMobile) {
      return (
        <I18nContext.Provider value={i18n}>
          <div className="flex flex-col w-full overflow-hidden bg-background" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex-1 min-h-0 overflow-hidden">
              {selectedDMUser ? (
                <DMChatArea dmUser={selectedDMUser} onBack={() => { setSelectedDMUser(null); setDmAutoStartVoice(false); setDmInitiateCall(false); setDmScrollToMessageId(undefined); }} onlineStatus={presenceStatuses.get(selectedDMUser.userId) || 'offline'} autoStartVoice={dmAutoStartVoice} initiateCall={dmInitiateCall} scrollToMessageId={dmScrollToMessageId} />
              ) : mobileTab === 'servers' ? (
                <ServerSidebar activeServer={activeServer} onServerChange={handleServerChange} servers={servers} onServerCreated={handleServerCreated} />
              ) : showNotifHistory ? (
                <NotificationHistory
                  onClose={() => setShowNotifHistory(false)}
                  onUnreadCountChange={setUnreadNotifCount}
                  onNavigateToMessage={handleNavigateToMessage}
                />
              ) : (
                <DMDashboard
                  onOpenDM={(u) => setSelectedDMUser(u)}
                  onStartCall={handleStartCallFromDashboard}
                  currentUserStatus={myStatus}
                  onStatusChange={setMyStatus}
                  presenceStatuses={presenceStatuses}
                  onToggleNotifications={() => setShowNotifHistory(p => !p)}
                  unreadNotifCount={unreadNotifCount}
                />
              )}
            </div>
            {!selectedDMUser && <MobileBottomNav />}
          </div>
          <InAppNotificationToast onNavigate={(channelId, messageId) => {
            const srv = servers.find(s => s.channels.some(c => c.id === channelId));
            if (srv) { setActiveServer(srv.id); setActiveChannel(channelId); setMobileTab('chat'); }
            if (messageId) setTimeout(() => {
              const el = document.getElementById(`msg-${messageId}`);
              if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('bg-primary/10'); setTimeout(() => el.classList.remove('bg-primary/10'), 2000); }
            }, 300);
          }} />
          {incomingCall && <IncomingCallModal callerName={incomingCall.callerName} callerAvatar={incomingCall.callerAvatar} onAccept={handleAcceptCall} onReject={handleRejectCall} />}
          {outgoingCallTarget && user && profile && (
            <OutgoingCallOverlay
              target={outgoingCallTarget}
              callerId={user.id}
              callerName={profile.display_name || profile.username || 'Biri'}
              callerAvatar={profile.avatar_url || null}
              onAccepted={handleOutgoingCallAccepted}
              onClosed={() => setOutgoingCallTarget(null)}
            />
          )}
        </I18nContext.Provider>
      );
    }
    return (
      <I18nContext.Provider value={i18n}>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <ServerSidebar activeServer={activeServer} onServerChange={handleServerChange} servers={servers} onServerCreated={handleServerCreated} />
          {selectedDMUser ? (
            <DMChatArea dmUser={selectedDMUser} onBack={() => { setSelectedDMUser(null); setDmAutoStartVoice(false); setDmInitiateCall(false); setDmScrollToMessageId(undefined); }} onlineStatus={presenceStatuses.get(selectedDMUser.userId) || 'offline'} autoStartVoice={dmAutoStartVoice} initiateCall={dmInitiateCall} scrollToMessageId={dmScrollToMessageId} />
          ) : (
            <>
              <DMDashboard
                onOpenDM={(u) => setSelectedDMUser(u)}
                onStartCall={handleStartCallFromDashboard}
                currentUserStatus={myStatus}
                onStatusChange={setMyStatus}
                presenceStatuses={presenceStatuses}
                onToggleNotifications={() => setShowNotifHistory(p => !p)}
                unreadNotifCount={unreadNotifCount}
              />
              {showNotifHistory && (
                <NotificationHistory
                  onClose={() => setShowNotifHistory(false)}
                  onUnreadCountChange={setUnreadNotifCount}
                  onNavigateToMessage={handleNavigateToMessage}
                />
              )}
            </>
          )}
        </div>
        <InAppNotificationToast onNavigate={(channelId, messageId) => {
          const srv = servers.find(s => s.channels.some(c => c.id === channelId));
          if (srv) { setActiveServer(srv.id); setActiveChannel(channelId); }
          if (messageId) setTimeout(() => {
            const el = document.getElementById(`msg-${messageId}`);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('bg-primary/10'); setTimeout(() => el.classList.remove('bg-primary/10'), 2000); }
          }, 300);
        }} />
        {incomingCall && <IncomingCallModal callerName={incomingCall.callerName} callerAvatar={incomingCall.callerAvatar} onAccept={handleAcceptCall} onReject={handleRejectCall} />}
        {outgoingCallTarget && user && profile && (
          <OutgoingCallOverlay
            target={outgoingCallTarget}
            callerId={user.id}
            callerName={profile.display_name || profile.username || 'Biri'}
            callerAvatar={profile.avatar_url || null}
            onAccepted={handleOutgoingCallAccepted}
            onClosed={() => setOutgoingCallTarget(null)}
          />
        )}
      </I18nContext.Provider>
    );
  }

  // No servers
  if (servers.length === 0) {
    if (isMobile) {
      return (
        <I18nContext.Provider value={i18n}>
          <div className="flex flex-col w-full overflow-hidden bg-background" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex-1 min-h-0 overflow-hidden">
              {mobileTab === 'servers' ? (
                <ServerSidebar activeServer={activeServer} onServerChange={handleServerChange} servers={servers} onServerCreated={handleServerCreated} />
              ) : (
                <div className="flex-1 flex items-center justify-center h-full">
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold text-gradient">{i18n.t('server.noServers')}</h2>
                    <p className="text-sm text-muted-foreground">{i18n.t('server.noServersDesc')}</p>
                  </div>
                </div>
              )}
            </div>
            <MobileBottomNav />
          </div>
        </I18nContext.Provider>
      );
    }
    return (
      <I18nContext.Provider value={i18n}>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <ServerSidebar activeServer={activeServer} onServerChange={handleServerChange} servers={servers} onServerCreated={handleServerCreated} />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-gradient">{i18n.t('server.noServers')}</h2>
              <p className="text-sm text-muted-foreground">{i18n.t('server.noServersDesc')}</p>
            </div>
          </div>
        </div>
      </I18nContext.Provider>
    );
  }

  if (!server || !channel) {
    return (
      <I18nContext.Provider value={i18n}>
        <div className="flex h-screen w-full overflow-hidden bg-background items-center justify-center">
          <p className="text-muted-foreground">{i18n.t('common.loading')}</p>
        </div>
      </I18nContext.Provider>
    );
  }

  // MOBILE LAYOUT
  if (isMobile) {
    return (
      <I18nContext.Provider value={i18n}>
        <div className="relative flex flex-col w-full overflow-hidden bg-background" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 0 }}>
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === 'servers' && (
              <div className="flex h-full w-full overflow-hidden">
                <ServerSidebar activeServer={activeServer} onServerChange={handleServerChange} servers={servers} onServerCreated={handleServerCreated} />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <ChannelList
                    serverName={server.name}
                    serverId={server.id}
                    serverIcon={server.icon}
                    channels={server.channels}
                    categories={server.categories}
                    activeChannel={activeChannel}
                    onChannelChange={(id) => { handleChannelChange(id); setMobileTab('chat'); }}
                    currentUserStatus={myStatus}
                    onStatusChange={setMyStatus}
                    isOwner={isOwner}
                    onChannelCreated={handleServerCreated}
                    onLeaveServer={!isOwner ? handleLeaveServer : undefined}
                    userPermissions={userPermissions}
                    voiceState={voice}
                    unreadChannels={unreadChannels}
                    isMobile
                  />
                </div>
              </div>
            )}
            {mobileTab === 'channels' && (
              <div className="h-full w-full overflow-hidden">
                <ChannelList
                  serverName={server.name}
                  serverId={server.id}
                  serverIcon={server.icon}
                  channels={server.channels}
                  categories={server.categories}
                  activeChannel={activeChannel}
                  onChannelChange={(id) => { handleChannelChange(id); setMobileTab('chat'); }}
                  currentUserStatus={myStatus}
                  onStatusChange={setMyStatus}
                  isOwner={isOwner}
                  onChannelCreated={handleServerCreated}
                  onLeaveServer={!isOwner ? handleLeaveServer : undefined}
                  userPermissions={userPermissions}
                  voiceState={voice}
                  unreadChannels={unreadChannels}
                  isMobile
                />
              </div>
            )}
            {mobileTab === 'chat' && (
              <ChatArea
                channelName={channel.name}
                channelId={channel.id}
                messages={messages}
                onSendMessage={handleSendMessage}
                onDeleteMessage={handleDeleteMessage}
                onEditMessage={handleEditMessage}
                onRetryMessage={handleRetryMessage}
                onToggleMembers={() => setMobileTab('members')}
                showMembers={false}
                isOwner={isOwner}
                isMobile
                reactions={reactions}
                onToggleReaction={handleToggleReaction}
                typingUsers={typingUsers}
                onTypingStart={handleTypingStart}
                onTypingStop={handleTypingStop}
                members={members}
                isLocked={channel.is_locked}
                onPinMessage={handlePinMessage}
                onUnpinMessage={handleUnpinMessage}
                serverId={activeServer}
                userPermissions={userPermissions}
                serverEmojis={serverEmojis}
                slowModeInterval={channel.slow_mode_interval}
                wordFilter={server?.word_filter}
                onToggleSearch={() => setShowSearchPanel(p => !p)}
                onToggleNotifications={() => setShowNotifHistory(p => !p)}
                onBotMessage={handleBotMessage}
              />
            )}
            {mobileTab === 'members' && (
              <div className="h-full w-full overflow-hidden">
                <MemberList members={members} serverId={activeServer} isMobile currentUserId={user?.id} />
              </div>
            )}
            {mobileTab === 'voice' && voice.connected && (
              <div className="h-full w-full overflow-hidden">
                <VoiceMeetingRoom
                  voiceState={voice}
                  isMobile
                  onToggleChat={() => setMobileTab('chat')}
                />
              </div>
            )}
          </div>
          {showSearchPanel && (
            <div className="absolute inset-0 z-40 bg-background">
              <MessageSearchPanel
                serverId={activeServer}
                channelId={channel.id}
                channelName={channel.name}
                onClose={() => setShowSearchPanel(false)}
                onJumpToMessage={(msgId) => {
                  setShowSearchPanel(false);
                  setMobileTab('chat');
                  setTimeout(() => {
                    const el = document.getElementById(`msg-${msgId}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('bg-primary/10');
                      setTimeout(() => el.classList.remove('bg-primary/10'), 2000);
                    }
                  }, 100);
                }}
              />
            </div>
          )}
          <MobileBottomNav />
          <ReleaseNotesModal />
          <NotificationPermissionBanner />
          <InAppNotificationToast onNavigate={(channelId, messageId) => {
            const srv = servers.find(s => s.channels.some(c => c.id === channelId));
            if (srv) { setActiveServer(srv.id); setActiveChannel(channelId); setMobileTab('chat'); }
            if (messageId) setTimeout(() => {
              const el = document.getElementById(`msg-${messageId}`);
              if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('bg-primary/10'); setTimeout(() => el.classList.remove('bg-primary/10'), 2000); }
            }, 300);
          }} />
        </div>
      </I18nContext.Provider>
    );
  }

  // DESKTOP LAYOUT
  return (
    <I18nContext.Provider value={i18n}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <ServerSidebar activeServer={activeServer} onServerChange={handleServerChange} servers={servers} onServerCreated={handleServerCreated} />
         <ChannelList
          serverName={server.name}
          serverId={server.id}
          serverIcon={server.icon}
          channels={server.channels}
          categories={server.categories}
          activeChannel={activeChannel}
          onChannelChange={handleChannelChange}
          currentUserStatus={myStatus}
          onStatusChange={setMyStatus}
          isOwner={isOwner}
          onChannelCreated={handleServerCreated}
          onLeaveServer={!isOwner ? handleLeaveServer : undefined}
          userPermissions={userPermissions}
          voiceState={voice}
          unreadChannels={unreadChannels}
        />
        {voice.connected ? (
          showVoiceChat ? (
            /* Chat view while in voice — full screen, with a small voice bar at top */
            <div className="flex flex-1 min-w-0 overflow-hidden flex-col">
              {/* Voice indicator bar */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border-b border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                <span className="text-xs text-green-400 font-medium truncate">#{voice.voiceChannelName} — ses kanalında</span>
                <button
                  onClick={() => setShowVoiceChat(false)}
                  className="ml-auto text-xs text-green-400 hover:text-green-300 flex items-center gap-1 shrink-0 px-2 py-0.5 rounded hover:bg-green-500/10 transition-colors"
                >
                  ↩ Toplantı Odasına Dön
                </button>
              </div>
              <div className="flex flex-1 min-w-0 overflow-hidden">
                <ChatArea
                  channelName={channel.name}
                  channelId={channel.id}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onEditMessage={handleEditMessage}
                  onRetryMessage={handleRetryMessage}
                  onToggleMembers={() => setShowMembers((p) => !p)}
                  showMembers={showMembers}
                  isOwner={isOwner}
                  reactions={reactions}
                  onToggleReaction={handleToggleReaction}
                  typingUsers={typingUsers}
                  onTypingStart={handleTypingStart}
                  onTypingStop={handleTypingStop}
                  members={members}
                  isLocked={channel.is_locked}
                  onPinMessage={handlePinMessage}
                  onUnpinMessage={handleUnpinMessage}
                  serverId={activeServer}
                  userPermissions={userPermissions}
                  serverEmojis={serverEmojis}
                  slowModeInterval={channel.slow_mode_interval}
                  wordFilter={server?.word_filter}
                  onToggleSearch={() => setShowSearchPanel(p => !p)}
                  onToggleNotifications={() => setShowNotifHistory(p => !p)}
                  onBotMessage={handleBotMessage}
                />
                {showNotifHistory && (
                  <NotificationHistory
                    onClose={() => setShowNotifHistory(false)}
                    onUnreadCountChange={setUnreadNotifCount}
                    onNavigateToMessage={handleNavigateToMessage}
                  />
                )}
                {showMembers && !showSearchPanel && <MemberList members={members} serverId={activeServer} currentUserId={user?.id} ownerId={server?.owner_id} />}
              </div>
            </div>
          ) : (
            /* Full-screen voice meeting room */
            <VoiceMeetingRoom
              voiceState={voice}
              showChat={false}
              onToggleChat={() => setShowVoiceChat(true)}
            />
          )
        ) : (
          <>
            <ChatArea
              channelName={channel.name}
              channelId={channel.id}
              messages={messages}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
              onRetryMessage={handleRetryMessage}
              onToggleMembers={() => setShowMembers((p) => !p)}
              showMembers={showMembers}
              isOwner={isOwner}
              reactions={reactions}
              onToggleReaction={handleToggleReaction}
              typingUsers={typingUsers}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              members={members}
              isLocked={channel.is_locked}
              onPinMessage={handlePinMessage}
              onUnpinMessage={handleUnpinMessage}
              serverId={activeServer}
              userPermissions={userPermissions}
              serverEmojis={serverEmojis}
              slowModeInterval={channel.slow_mode_interval}
              wordFilter={server?.word_filter}
              onToggleSearch={() => setShowSearchPanel(p => !p)}
              onToggleNotifications={() => setShowNotifHistory(p => !p)}
              onBotMessage={handleBotMessage}
            />
            {showNotifHistory && (
              <NotificationHistory
                onClose={() => setShowNotifHistory(false)}
                onUnreadCountChange={setUnreadNotifCount}
                onNavigateToMessage={handleNavigateToMessage}
              />
            )}
            {showSearchPanel && (
              <MessageSearchPanel
                serverId={activeServer}
                channelId={channel.id}
                channelName={channel.name}
                onClose={() => setShowSearchPanel(false)}
                onJumpToMessage={(msgId) => {
                  setShowSearchPanel(false);
                  setTimeout(() => {
                    const el = document.getElementById(`msg-${msgId}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('bg-primary/10');
                      setTimeout(() => el.classList.remove('bg-primary/10'), 2000);
                    }
                  }, 100);
                }}
              />
            )}
            {showMembers && !showSearchPanel && <MemberList members={members} serverId={activeServer} currentUserId={user?.id} ownerId={server?.owner_id} />}
          </>
        )}
        <ReleaseNotesModal />
        <NotificationPermissionBanner />
        <InAppNotificationToast onNavigate={handleNavigateToMessage} />
        {incomingCall && <IncomingCallModal callerName={incomingCall.callerName} callerAvatar={incomingCall.callerAvatar} onAccept={handleAcceptCall} onReject={handleRejectCall} />}
        {outgoingCallTarget && user && profile && (
          <OutgoingCallOverlay
            target={outgoingCallTarget}
            callerId={user.id}
            callerName={profile.display_name || profile.username || 'Biri'}
            callerAvatar={profile.avatar_url || null}
            onAccepted={handleOutgoingCallAccepted}
            onClosed={() => setOutgoingCallTarget(null)}
          />
        )}
      </div>
    </I18nContext.Provider>
  );
};

export default Index;
