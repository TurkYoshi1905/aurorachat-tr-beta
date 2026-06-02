import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserProfileCard from './UserProfileCard';
import {
  ArrowLeft, Send, Users, Pencil, Trash2, Check, X, Loader2, LogOut,
  UserPlus, Search, AlertTriangle, Circle, Moon, MinusCircle, Phone, PhoneOff, PhoneCall, Mic,
} from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayerCard, { parseVoiceNote } from './VoicePlayerCard';
import { MessageSkeletonList } from './MessageSkeleton';
import { toast } from 'sonner';
import { renderMessageContent } from '@/utils/messageRenderer';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import MentionPopup from './MentionPopup';
import { DbMember } from '@/types/chat';
import { useVoiceContext } from '@/contexts/VoiceContext';
import VoiceMeetingRoom from './VoiceMeetingRoom';

interface GroupMember {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isOwner: boolean;
  status?: string;
}

const STATUS_DOT: Record<string, React.ReactNode> = {
  online: <Circle className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />,
  idle: <Moon className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />,
  dnd: <MinusCircle className="w-2.5 h-2.5 text-red-400" />,
  offline: <Circle className="w-2.5 h-2.5 text-[#6d6f78] fill-[#6d6f78]" />,
};

const STATUS_LABEL: Record<string, string> = {
  online: 'Çevrimiçi',
  idle: 'Boşta',
  dnd: 'Rahatsız Etme',
  offline: 'Çevrimdışı',
};

interface GroupMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  insertedAt: string;
  updatedAt: string | null;
  status?: 'sending' | 'failed';
}

interface GroupInfo {
  id: string;
  name: string | null;
  iconUrl: string | null;
  ownerId: string;
}

interface FriendOption {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

interface Props {
  groupId: string;
  groupName: string;
  onBack: () => void;
}

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const isSameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

const FIVE_MIN = 5 * 60 * 1000;

const GroupDMChatArea = ({ groupId, groupName, onBack }: Props) => {
  const { user } = useAuth();
  const voice = useVoiceContext();
  const groupVoiceRoomId = `group-dm-voice-${groupId}`;
  const isInVoiceCall = voice.connected && voice.voiceChannelId === groupVoiceRoomId;

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [joiningVoice, setJoiningVoice] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callerName: string } | null>(null);
  const [voiceHeight, setVoiceHeight] = useState(220);
  const voiceResizeDrag = useRef<{ startY: number; startH: number } | null>(null);

  // Owner controls state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const profileMap = useRef<Map<string, GroupMember>>(new Map());

  const isOwner = !!(group && user && group.ownerId === user.id);

  const insertMention = useCallback((name: string) => {
    const formatted = name.includes(' ') ? `@[${name}] ` : `@${name} `;
    setInput(prev => prev ? `${prev} ${formatted}` : formatted);
    textareaRef.current?.focus();
  }, []);

  const handleMentionSelect = useCallback((name: string) => {
    const el = textareaRef.current;
    const cursorPos = el?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);
    if (mentionMatch) {
      const before = textBeforeCursor.slice(0, mentionMatch.index);
      const after = input.slice(cursorPos);
      const formatted = name.includes(' ') ? `@[${name}]` : `@${name}`;
      setInput(`${before}${formatted} ${after}`);
    }
    setShowMentionPopup(false);
    setMentionQuery('');
    textareaRef.current?.focus();
  }, [input]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    resizeTextarea();
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);
    if (mentionMatch) {
      setShowMentionPopup(true);
      setMentionQuery(mentionMatch[1]);
    } else {
      setShowMentionPopup(false);
      setMentionQuery('');
    }
  }, []);

  const mentionMembers: DbMember[] = members.map(m => ({
    id: m.userId,
    name: m.displayName,
    username: m.username,
    avatar: m.displayName.charAt(0).toUpperCase(),
    avatarUrl: m.avatarUrl,
    status: (m.status || 'offline') as DbMember['status'],
  }));

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const scrollToBottom = (behavior: 'smooth' | 'instant' = 'instant') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  const hydrateMessage = useCallback((raw: any): GroupMessage => {
    const member = profileMap.current.get(raw.sender_id);
    return {
      id: raw.id,
      senderId: raw.sender_id,
      senderName: member?.displayName || 'Kullanıcı',
      senderAvatar: member?.avatarUrl || null,
      content: raw.content || '',
      insertedAt: raw.inserted_at,
      updatedAt: raw.updated_at,
    };
  }, []);

  const loadMembers = useCallback(async (ownerId: string) => {
    const { data: mems } = await (supabase.from('group_dm_members' as any)
      .select('user_id')
      .eq('group_id', groupId) as any);
    const memberIds: string[] = (mems as any[] || []).map((m: any) => m.user_id);
    const { data: profiles } = memberIds.length > 0
      ? await supabase.from('profiles').select('id, display_name, username, avatar_url, status').in('id', memberIds)
      : { data: [] as any[] };
    const memberList: GroupMember[] = (profiles as any[] || []).map((p: any) => ({
      userId: p.id,
      displayName: p.display_name || p.username || 'Kullanıcı',
      username: p.username || '',
      avatarUrl: p.avatar_url || null,
      isOwner: p.id === ownerId,
      status: p.status || 'offline',
    }));
    const sorted = [...memberList].sort((a, b) => {
      const order = { online: 0, idle: 1, dnd: 2, offline: 3 };
      return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
    });
    setMembers(sorted);
    profileMap.current = new Map(sorted.map(m => [m.userId, m]));
    return sorted;
  }, [groupId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const { data: g } = await (supabase.from('group_dms' as any)
        .select('id, name, icon_url, owner_id')
        .eq('id', groupId)
        .maybeSingle() as any);
      if (g && mounted) setGroup({ id: g.id, name: g.name, iconUrl: g.icon_url, ownerId: g.owner_id });
      if (g && mounted) await loadMembers(g.owner_id);

      const { data: msgs } = await (supabase.from('group_dm_messages' as any)
        .select('id, sender_id, content, inserted_at, updated_at')
        .eq('group_id', groupId)
        .order('inserted_at', { ascending: true })
        .limit(100) as any);
      if (mounted) {
        setMessages((msgs as any[] || []).map(hydrateMessage));
        setLoading(false);
        setTimeout(() => scrollToBottom(), 80);
      }
    };
    load();
    return () => { mounted = false; };
  }, [groupId, hydrateMessage, loadMembers]);

  useEffect(() => {
    const channel = supabase
      .channel(`group-dm-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_dm_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        const msg = hydrateMessage(payload.new);
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => scrollToBottom('smooth'), 60);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_dm_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        setMessages(prev => prev.map(m =>
          m.id === payload.new.id ? { ...m, content: payload.new.content, updatedAt: payload.new.updated_at } : m
        ));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_dm_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_dm_members', filter: `group_id=eq.${groupId}` }, () => {
        if (group) loadMembers(group.ownerId);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_dm_members', filter: `group_id=eq.${groupId}` }, () => {
        if (group) loadMembers(group.ownerId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
        const uid = payload.new?.id;
        const newStatus = payload.new?.status;
        if (uid) {
          setMembers(prev => prev.map(m =>
            m.userId === uid ? { ...m, status: newStatus || 'offline' } : m
          ));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, hydrateMessage, loadMembers, group]);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const { data: friendRows } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const friendIds = (friendRows || [])
        .map(r => r.user_id === user.id ? r.friend_id : r.user_id)
        .filter(id => !members.some(m => m.userId === id));

      if (friendIds.length === 0) { setFriends([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', friendIds);

      setFriends((profiles || []).map((p: any) => ({
        userId: p.id,
        displayName: p.display_name || p.username || 'Kullanıcı',
        username: p.username || '',
        avatarUrl: p.avatar_url || null,
      })));
    } finally {
      setLoadingFriends(false);
    }
  }, [user, members]);

  useEffect(() => {
    if (showAddPanel) loadFriends();
  }, [showAddPanel, loadFriends]);

  // 30-second polling removed — Supabase Presence (group-dm-presence-{groupId}) handles
  // real-time online/offline status and the postgres_changes subscription covers member changes.
  // Polling was generating ~2 extra DB queries/minute per active GroupDM view.

  // Supabase Presence: real-time online/offline status for GroupDM members
  useEffect(() => {
    if (!user || !groupId) return;
    const presenceCh = supabase.channel(`group-dm-presence-${groupId}`, {
      config: { presence: { key: user.id } },
    });
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        const state = presenceCh.presenceState();
        setMembers(prev => prev.map(m => {
          const entries = state[m.userId] as any[] | undefined;
          if (!entries || entries.length === 0) return { ...m, status: 'offline' };
          return { ...m, status: (entries[0] as any).onlineStatus || 'online' };
        }));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        const p = newPresences?.[0] as any;
        setMembers(prev => prev.map(m => m.userId === key ? { ...m, status: p?.onlineStatus || 'online' } : m));
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        setMembers(prev => prev.map(m => m.userId === key ? { ...m, status: 'offline' } : m));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceCh.track({ onlineStatus: 'online', userId: user.id });
        }
      });
    return () => { supabase.removeChannel(presenceCh); };
  }, [user, groupId]);

  const sendVoiceNote = async (url: string, dur: number) => {
    if (!user) return;
    const content = JSON.stringify({ __vn: 1, url, dur });
    const optimisticId = `opt-vn-${Date.now()}`;
    const me = profileMap.current.get(user.id);
    setMessages(prev => [...prev, {
      id: optimisticId,
      senderId: user.id,
      senderName: me?.displayName || 'Sen',
      senderAvatar: me?.avatarUrl || null,
      content,
      insertedAt: new Date().toISOString(),
      updatedAt: null,
      status: 'sending' as const,
    }]);
    const { error } = await (supabase.from('group_dm_messages' as any).insert({ group_id: groupId, sender_id: user.id, content }) as any);
    if (error) {
      setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, status: 'failed' as const } : m));
    } else {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
  };

  const sendMessage = async () => {
    if (!user || !input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const me = profileMap.current.get(user.id);
    const optimistic: GroupMessage = {
      id: optimisticId,
      senderId: user.id,
      senderName: me?.displayName || 'Sen',
      senderAvatar: me?.avatarUrl || null,
      content,
      insertedAt: new Date().toISOString(),
      updatedAt: null,
      status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom('smooth');
    const { error } = await (supabase.from('group_dm_messages' as any).insert({
      group_id: groupId, sender_id: user.id, content,
    }) as any);
    if (error) {
      setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, status: 'failed' } : m));
      toast.error('Mesaj gönderilemedi');
    } else {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentionPopup) { e.preventDefault(); sendMessage(); }
    if (e.key === 'Escape') { setShowMentionPopup(false); }
  };

  const startEdit = (msg: GroupMessage) => { setEditingId(msg.id); setEditValue(msg.content); };

  const saveEdit = async () => {
    if (!editingId || !editValue.trim()) return;
    const { error } = await (supabase.from('group_dm_messages' as any)
      .update({ content: editValue.trim(), updated_at: new Date().toISOString() })
      .eq('id', editingId) as any);
    if (error) { toast.error('Düzenlenemedi'); return; }
    setEditingId(null);
    setEditValue('');
  };

  const deleteMessage = async (id: string) => {
    await (supabase.from('group_dm_messages' as any).delete().eq('id', id) as any);
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    const { error } = await (supabase.from('group_dm_members' as any)
      .delete().eq('group_id', groupId).eq('user_id', user.id) as any);
    if (error) { toast.error('Gruptan ayrılamadı'); return; }
    toast.success('Gruptan ayrıldınız');
    onBack();
  };

  const handleDeleteGroup = async () => {
    if (!user || !isOwner) return;
    setDeletingGroup(true);
    try {
      await (supabase.from('group_dm_messages' as any).delete().eq('group_id', groupId) as any);
      await (supabase.from('group_dm_members' as any).delete().eq('group_id', groupId) as any);
      const { error } = await (supabase.from('group_dms' as any).delete().eq('id', groupId) as any);
      if (error) throw error;
      toast.success('Grup silindi');
      onBack();
    } catch {
      toast.error('Grup silinemedi');
      setDeletingGroup(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user || !isOwner || memberId === user.id) return;
    setRemovingMemberId(memberId);
    try {
      const { error } = await (supabase.from('group_dm_members' as any)
        .delete().eq('group_id', groupId).eq('user_id', memberId) as any);
      if (error) throw error;
      toast.success('Üye gruptan çıkarıldı');
    } catch {
      toast.error('Üye çıkarılamadı');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleAddMember = async (friendId: string) => {
    if (!user || !isOwner) return;
    setAddingUserId(friendId);
    try {
      const { error } = await (supabase.from('group_dm_members' as any).insert({
        group_id: groupId, user_id: friendId,
      }) as any);
      if (error) throw error;
      toast.success('Üye gruba eklendi');
      setFriends(prev => prev.filter(f => f.userId !== friendId));
    } catch {
      toast.error('Üye eklenemedi');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleStartVoiceCall = async () => {
    if (!user) return;
    if (isInVoiceCall) { setShowVoice(v => !v); return; }
    setJoiningVoice(true);
    try {
      await voice.joinVoice(groupVoiceRoomId, `Grup: ${displayName ?? groupName}`, null);
      setShowVoice(true);
      const channel = supabase.channel(`group-voice-signal-${groupId}`);
      const me = profileMap.current.get(user.id);
      await channel.send({
        type: 'broadcast',
        event: 'group-call-started',
        payload: { callerName: me?.displayName || 'Kullanıcı', groupId },
      });
      supabase.removeChannel(channel);
    } catch {
      toast.error('Sesli aramaya katılınamadı');
    } finally {
      setJoiningVoice(false);
    }
  };

  const handleLeaveVoiceCall = async () => {
    await voice.disconnect();
    setShowVoice(false);
  };

  const handleRecall = async () => {
    if (!user) return;
    const me = profileMap.current.get(user.id);
    const channel = supabase.channel(`group-voice-signal-${groupId}-recall-${Date.now()}`);
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'group-call-started',
          payload: { callerName: me?.displayName || 'Kullanıcı', groupId },
        });
        setTimeout(() => supabase.removeChannel(channel), 1000);
      }
    });
    toast.success('Tüm üyeler tekrar arandı');
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`group-voice-signal-${groupId}`)
      .on('broadcast', { event: 'group-call-started' }, (data: any) => {
        const payload = data.payload as { callerName: string; groupId: string };
        if (payload.groupId === groupId && !isInVoiceCall) {
          setIncomingCall({ callerName: payload.callerName });
          setTimeout(() => setIncomingCall(null), 20000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, user, isInVoiceCall]);

  const displayName = group?.name || groupName;

  const shouldShowHeader = (msg: GroupMessage, prev: GroupMessage | null) => {
    if (!prev) return true;
    if (msg.senderId !== prev.senderId) return true;
    return new Date(msg.insertedAt).getTime() - new Date(prev.insertedAt).getTime() > FIVE_MIN;
  };

  const filteredFriends = friends.filter(f => {
    const q = friendSearch.toLowerCase();
    return !q || f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#313338] overflow-hidden">
        <div className="flex-1 overflow-y-auto px-2 pt-6">
          <MessageSkeletonList count={10} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-[#313338] overflow-hidden">
      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#232428] rounded-2xl p-6 max-w-sm w-full mx-4 border border-[#ed4245]/30 shadow-[0_8px_40px_rgba(237,66,69,0.25)]">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-[#ed4245]/15 border border-[#ed4245]/30 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-[#ed4245]" />
              </div>
              <p className="text-base font-bold text-white mb-1">Grubu Sil</p>
              <p className="text-[12px] text-[#b5bac1] leading-relaxed">
                <span className="font-semibold text-white">"{displayName}"</span> grubunu silmek üzeresin.
                <br />Tüm mesajlar <span className="text-[#ed4245] font-semibold">kalıcı olarak</span> silinecek.
              </p>
            </div>
            <div className="bg-[#ed4245]/8 border border-[#ed4245]/20 rounded-xl px-4 py-3 mb-5 text-[12px] text-[#b5bac1] text-center">
              Bu işlem <strong className="text-white">geri alınamaz</strong>. Grubun tüm üyeleri için bu konuşma kaybolacak.
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingGroup}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#dbdee1] bg-[#3f4147] hover:bg-[#46494f] transition-colors disabled:opacity-60"
              >
                İptal
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={deletingGroup}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#ed4245] hover:bg-[#c93b3e] active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {deletingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Grubu Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-12 flex items-center px-3 border-b border-[#1e1f22] shadow-sm gap-2 shrink-0 bg-[#313338]">
        <button onClick={onBack} className="p-1.5 rounded-md text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#5865f2] to-[#a855f7] shrink-0">
          {group?.iconUrl
            ? <img src={group.iconUrl} className="w-8 h-8 rounded-full object-cover" />
            : <Users className="w-4 h-4 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{displayName}</p>
          <p className="text-[11px] text-[#b5bac1] leading-none">{members.length} üye</p>
        </div>

        {/* Owner: delete group */}
        {isOwner && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-md text-[#b5bac1] hover:text-[#ed4245] hover:bg-[#ed4245]/10 transition-colors"
            title="Grubu Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Voice call button */}
        <button
          onClick={handleStartVoiceCall}
          disabled={joiningVoice}
          className={`p-1.5 rounded-md transition-colors ${
            isInVoiceCall
              ? 'text-emerald-400 bg-emerald-400/15 hover:bg-emerald-400/25'
              : 'text-[#b5bac1] hover:text-emerald-400 hover:bg-emerald-400/10'
          }`}
          title={isInVoiceCall ? 'Sesli Arama Aktif' : 'Sesli Arama Başlat'}
        >
          {joiningVoice ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isInVoiceCall ? (
            <PhoneCall className="w-4 h-4" />
          ) : (
            <Phone className="w-4 h-4" />
          )}
        </button>

        {/* Members panel toggle */}
        <button
          onClick={() => { setShowMembers(v => !v); setShowAddPanel(false); }}
          className={`p-1.5 rounded-md transition-colors ${showMembers ? 'text-white bg-[#393c43]' : 'text-[#b5bac1] hover:text-white hover:bg-[#35373c]'}`}
          title="Üye listesi"
        >
          <Users className="w-4 h-4" />
        </button>

        {/* Non-owner: leave */}
        {user && members.find(m => m.userId === user.id) && !isOwner && (
          <button
            onClick={handleLeaveGroup}
            className="p-1.5 rounded-md text-[#b5bac1] hover:text-[#ed4245] hover:bg-[#ed4245]/10 transition-colors"
            title="Gruptan ayrıl"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Incoming call notification */}
      {incomingCall && !isInVoiceCall && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/15 border-b border-emerald-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-sm text-emerald-300 font-medium">{incomingCall.callerName} sesli arama başlattı</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIncomingCall(null); handleStartVoiceCall(); }}
              className="text-xs px-3 py-1 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors"
            >
              Katıl
            </button>
            <button
              onClick={() => setIncomingCall(null)}
              className="text-xs px-3 py-1 rounded-full bg-[#3f4147] text-[#b5bac1] font-semibold hover:bg-[#46494f] transition-colors"
            >
              Reddet
            </button>
          </div>
        </div>
      )}

      {/* Voice Meeting Room — resizable */}
      {isInVoiceCall && showVoice && (
        <div className="shrink-0 border-b border-[#1e1f22] flex flex-col" style={{ height: voiceHeight }}>
          <div className="flex-1 min-h-0 overflow-hidden">
            <VoiceMeetingRoom
              voiceState={voice}
              isMobile={false}
              onToggleChat={() => setShowVoice(false)}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#232428] border-t border-[#1e1f22] shrink-0">
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5" /> Aktif Sesli Arama
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRecall}
                className="text-[11px] px-2.5 py-1 rounded bg-[#3f4147] text-[#b5bac1] hover:text-white hover:bg-[#46494f] transition-colors"
              >
                Tekrar Ara
              </button>
              <button
                onClick={handleLeaveVoiceCall}
                className="text-[11px] px-2.5 py-1 rounded bg-[#ed4245]/15 text-[#ed4245] hover:bg-[#ed4245]/25 transition-colors flex items-center gap-1"
              >
                <PhoneOff className="w-3 h-3" /> Kapat
              </button>
            </div>
          </div>
          {/* Resize handle */}
          <div
            className="h-1.5 bg-[#1e1f22] hover:bg-primary/40 cursor-row-resize shrink-0 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              voiceResizeDrag.current = { startY: e.clientY, startH: voiceHeight };
              const onMove = (ev: MouseEvent) => {
                if (!voiceResizeDrag.current) return;
                const delta = ev.clientY - voiceResizeDrag.current.startY;
                setVoiceHeight(Math.max(140, Math.min(520, voiceResizeDrag.current.startH + delta)));
              };
              const onUp = () => {
                voiceResizeDrag.current = null;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              voiceResizeDrag.current = { startY: touch.clientY, startH: voiceHeight };
              const onMove = (ev: TouchEvent) => {
                if (!voiceResizeDrag.current) return;
                const delta = ev.touches[0].clientY - voiceResizeDrag.current.startY;
                setVoiceHeight(Math.max(140, Math.min(520, voiceResizeDrag.current.startH + delta)));
              };
              const onEnd = () => {
                voiceResizeDrag.current = null;
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
              };
              window.addEventListener('touchmove', onMove);
              window.addEventListener('touchend', onEnd);
            }}
            title="Boyutu değiştirmek için sürükle"
          />
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#5865f2] to-[#a855f7] flex items-center justify-center">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <p className="text-base font-bold text-white">{displayName}</p>
                <p className="text-sm text-[#b5bac1] max-w-xs">Bu grubun başlangıcı burası! İlk mesajı sen gönder.</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const showHeader = shouldShowHeader(msg, prev);
              const isOwn = msg.senderId === user?.id;
              const showDateSep = !prev || !isSameDay(msg.insertedAt, prev.insertedAt);
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-[#3f4147]" />
                      <span className="text-[11px] font-semibold text-[#6d6f78] whitespace-nowrap">{formatDate(msg.insertedAt)}</span>
                      <div className="flex-1 h-px bg-[#3f4147]" />
                    </div>
                  )}
                  <div className={`group flex gap-3 px-1 py-0.5 rounded-md hover:bg-[#2e3035] transition-colors ${showHeader ? 'mt-3' : ''} ${msg.status === 'sending' ? 'opacity-60' : ''}`}>
                    <div className="w-10 shrink-0 flex justify-center">
                      {showHeader ? (
                        <UserProfileCard userId={msg.senderId || ''} status={members.find(m => m.userId === msg.senderId)?.status} side="right">
                          <Avatar className="h-9 w-9 mt-0.5 cursor-pointer">
                            {msg.senderAvatar && <AvatarImage src={msg.senderAvatar} />}
                            <AvatarFallback className="bg-[#5865f2] text-white text-xs">
                              {msg.senderName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </UserProfileCard>
                      ) : (
                        <span className="text-[10px] text-[#6d6f78] mt-1 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                          {formatTime(msg.insertedAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {showHeader && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span
                            className={`text-sm font-semibold leading-none cursor-pointer hover:underline ${isOwn ? 'text-[#c9cdfb]' : 'text-white'}`}
                            onClick={() => insertMention(msg.senderName)}
                          >{msg.senderName}</span>
                          <span className="text-[11px] text-[#6d6f78]">{formatTime(msg.insertedAt)}</span>
                          {msg.updatedAt && <span className="text-[10px] text-[#6d6f78]">(düzenlendi)</span>}
                        </div>
                      )}
                      {editingId === msg.id ? (
                        <div className="flex gap-2 items-end mt-1">
                          <textarea
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="flex-1 bg-[#1e1f22] text-[#dbdee1] text-sm rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-[#5865f2]/50 min-h-[36px]"
                            rows={2}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button onClick={saveEdit} className="p-1.5 rounded text-emerald-400 hover:bg-emerald-400/10"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded text-[#6d6f78] hover:bg-[#35373c]"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className={`text-sm text-[#dbdee1] leading-relaxed break-words ${msg.status === 'failed' ? 'text-[#ed4245]' : ''}`}>
                          {(() => {
                            const vn = parseVoiceNote(msg.content);
                            if (vn) return <VoicePlayerCard key={vn.url} url={vn.url} duration={vn.dur} isOwn={msg.senderId === user?.id} />;
                            return renderMessageContent(msg.content);
                          })()}
                          {!showHeader && msg.updatedAt && <span className="text-[10px] text-[#6d6f78] ml-1">(düzenlendi)</span>}
                        </div>
                      )}
                    </div>
                    {isOwn && editingId !== msg.id && (
                      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(msg)} className="p-1.5 rounded text-[#6d6f78] hover:text-white hover:bg-[#35373c] transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteMessage(msg.id)} className="p-1.5 rounded text-[#6d6f78] hover:text-[#ed4245] hover:bg-[#ed4245]/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 shrink-0">
            {showMentionPopup && mentionMembers.length > 0 && (
              <MentionPopup
                query={mentionQuery}
                members={mentionMembers}
                onSelect={handleMentionSelect}
                onClose={() => setShowMentionPopup(false)}
                position={{ bottom: 56, left: 16 }}
              />
            )}
            <div className="relative">
            <div className="bg-[#383a40] rounded-xl px-3 py-2 flex items-end gap-2">
              <EmojiPicker onEmojiSelect={(e: string) => { setInput(p => p + e); textareaRef.current?.focus(); }} />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`#${displayName} grubuna mesaj gönder`}
                rows={1}
                className="flex-1 bg-transparent text-[#dbdee1] text-sm placeholder-[#6d6f78] resize-none outline-none min-h-[24px] max-h-[160px] overflow-y-auto leading-6"
              />
              <GifPicker onGifSelect={(url: string) => { setInput(p => (p + ' ' + url).trim()); }} />
              {!input.trim() && <VoiceRecorder onVoiceNoteSend={sendVoiceNote} />}
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="p-1.5 rounded-lg text-[#b5bac1] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            </div>
          </div>
        </div>

        {/* Member sidebar */}
        {showMembers && (
          <div className="w-52 shrink-0 bg-[#2b2d31] border-l border-[#1e1f22] flex flex-col overflow-hidden">
            {isOwner && showAddPanel ? (
              /* Add member panel */
              <div className="flex flex-col h-full">
                <div className="p-3 border-b border-[#1e1f22] flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setShowAddPanel(false); setFriendSearch(''); }}
                    className="p-1 rounded text-[#6d6f78] hover:text-white hover:bg-[#35373c] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d6f78]">Üye Ekle</p>
                </div>
                <div className="px-2 pt-2 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6d6f78]" />
                    <input
                      value={friendSearch}
                      onChange={e => setFriendSearch(e.target.value)}
                      placeholder="Arkadaş ara..."
                      className="w-full bg-[#1e1f22] text-[#dbdee1] text-xs rounded-lg pl-7 pr-2 py-1.5 outline-none placeholder-[#6d6f78]"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  {loadingFriends ? (
                    <div className="flex justify-center pt-4">
                      <Loader2 className="w-4 h-4 animate-spin text-[#6d6f78]" />
                    </div>
                  ) : filteredFriends.length === 0 ? (
                    <p className="text-[11px] text-[#6d6f78] text-center pt-4 px-2">
                      {friends.length === 0 ? 'Eklenecek arkadaş yok' : 'Eşleşen arkadaş yok'}
                    </p>
                  ) : (
                    filteredFriends.map(f => (
                      <div key={f.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#35373c] transition-colors">
                        <Avatar className="h-7 w-7 shrink-0">
                          {f.avatarUrl && <AvatarImage src={f.avatarUrl} />}
                          <AvatarFallback className="bg-[#5865f2] text-white text-[10px]">{f.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#dbdee1] truncate">{f.displayName}</p>
                          <p className="text-[10px] text-[#6d6f78] truncate">@{f.username}</p>
                        </div>
                        <button
                          onClick={() => handleAddMember(f.userId)}
                          disabled={addingUserId === f.userId}
                          className="shrink-0 p-1 rounded text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
                          title="Ekle"
                        >
                          {addingUserId === f.userId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Member list */
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 flex items-center justify-between shrink-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d6f78]">Üyeler — {members.length}</p>
                  {isOwner && (
                    <button
                      onClick={() => setShowAddPanel(true)}
                      className="p-1 rounded text-[#6d6f78] hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                      title="Üye Ekle"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5 px-2 pb-2">
                  {members.map(m => (
                    <div
                      key={m.userId}
                      onClick={() => insertMention(m.displayName)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#35373c] transition-colors group/member cursor-pointer"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-7 w-7">
                          {m.avatarUrl && <AvatarImage src={m.avatarUrl} />}
                          <AvatarFallback className="bg-[#5865f2] text-white text-[10px]">{m.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31] flex items-center justify-center ${
                          m.status === 'online' ? 'bg-emerald-500' :
                          m.status === 'idle' ? 'bg-yellow-400' :
                          m.status === 'dnd' ? 'bg-red-400' : 'bg-[#6d6f78]'
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate leading-tight ${m.status === 'offline' ? 'text-[#6d6f78]' : 'text-[#dbdee1]'}`}>{m.displayName}</p>
                        <p className="text-[10px] leading-none">
                          {m.isOwner
                            ? <span className="text-[#faa61a]">Sahip</span>
                            : <span className="text-[#6d6f78]">{STATUS_LABEL[m.status || 'offline']}</span>
                          }
                        </p>
                      </div>
                      {isOwner && !m.isOwner && (
                        <button
                          onClick={e => { e.stopPropagation(); handleRemoveMember(m.userId); }}
                          disabled={removingMemberId === m.userId}
                          className="shrink-0 p-1 rounded text-[#6d6f78] opacity-0 group-hover/member:opacity-100 hover:text-[#ed4245] hover:bg-[#ed4245]/10 transition-all disabled:opacity-40"
                          title="Gruptan Çıkar"
                        >
                          {removingMemberId === m.userId ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDMChatArea;
