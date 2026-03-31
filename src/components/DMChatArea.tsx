import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Send, PlusCircle, Pencil, Trash2, Check, X, ImagePlus, Phone, PhoneOff, Video, ChevronDown, ChevronUp, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n';
import { renderMessageContent } from './ChatArea';
import MessageAttachments from './MessageAttachments';
import FileUploadPreview from './FileUploadPreview';
import { toast } from 'sonner';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVoiceContext } from '@/contexts/VoiceContext';
import VoiceMeetingRoom from './VoiceMeetingRoom';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface DMUser { userId: string; displayName: string; username: string; avatarUrl: string | null; }
interface DMMessage { id: string; senderId: string; content: string; createdAt: string; updatedAt: string | null; senderName: string; senderAvatar: string | null; status?: 'sending' | 'failed'; attachments?: string[]; }
interface DMChatAreaProps { dmUser: DMUser; onBack: () => void; onlineStatus?: string; autoStartVoice?: boolean; initiateCall?: boolean; scrollToMessageId?: string; }

const getDMRoomId = (userId1: string, userId2: string) =>
  `dm-${[userId1, userId2].sort().join('-')}`;

const formatTimestamp = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const uploadFiles = async (files: File[], userId: string, messageId: string): Promise<string[]> => {
  const urls: string[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/dm/${messageId}/${crypto.randomUUID()}_${safeName}`;
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      const urlWithMeta = `${data.publicUrl}?originalName=${encodeURIComponent(file.name)}&size=${file.size}`;
      urls.push(urlWithMeta);
    }
  }
  return urls;
};

// Helper to find or create a DM conversation
const getOrCreateConversation = async (userId: string, otherUserId: string): Promise<string | null> => {
  // Check existing
  const { data: existing } = await supabase.from('dm_conversations').select('id')
    .or(`and(user1_id.eq.${userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${userId})`)
    .maybeSingle();
  if (existing) return existing.id;
  // Create new
  const { data: created, error } = await supabase.from('dm_conversations')
    .insert({ user1_id: userId, user2_id: otherUserId })
    .select('id').single();
  if (error || !created) return null;
  return created.id;
};

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  online: 'Çevrimiçi',
  idle: 'Boşta',
  dnd: 'Rahatsız Etme',
  offline: 'Çevrimdışı',
};

const SYSTEM_SENDER_ID = '__system__';

const DMChatArea = ({ dmUser, onBack, onlineStatus, autoStartVoice, initiateCall, scrollToMessageId }: DMChatAreaProps) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const voice = useVoiceContext();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [dmUserStatus, setDmUserStatus] = useState<string>(onlineStatus || 'offline');
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [hasBlockedOther, setHasBlockedOther] = useState(false);
  const [blockRecordId, setBlockRecordId] = useState<string | null>(null);
  const [dmBlocked, setDmBlocked] = useState(false);
  const [dmDisabledReason, setDmDisabledReason] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [voicePanelVisible, setVoicePanelVisible] = useState(false);
  const [voiceFullscreen, setVoiceFullscreen] = useState(false);
  const [isCallOutgoing, setIsCallOutgoing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initiateCallHandled = useRef(false);

  useEffect(() => {
    if (!scrollToMessageId || messages.length === 0) return;
    const tryScroll = () => {
      const el = document.getElementById(`dm-msg-${scrollToMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-primary/10', 'ring-1', 'ring-primary/30');
        setTimeout(() => el.classList.remove('bg-primary/10', 'ring-1', 'ring-primary/30'), 2500);
      }
    };
    const t = setTimeout(tryScroll, 400);
    return () => clearTimeout(t);
  }, [scrollToMessageId, messages.length]);

  useEffect(() => { requestAnimationFrame(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }); }, [messages]);

  // Get or create conversation
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const convId = await getOrCreateConversation(user.id, dmUser.userId);
      setConversationId(convId);
    };
    init();
  }, [user, dmUser.userId]);

  // Check blocking status and allow_dms privacy setting
  useEffect(() => {
    if (!user || !dmUser.userId) return;
    const checkPrivacy = async () => {
      // Check if current user has blocked the DM partner
      const { data: myBlock } = await (supabase.from('blocked_users') as any)
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', dmUser.userId)
        .maybeSingle();

      if (myBlock) {
        setHasBlockedOther(true);
        setBlockRecordId(myBlock.id);
        setIsBlockedByOther(false);
        setDmBlocked(false);
        setDmDisabledReason(null);
        return;
      }
      setHasBlockedOther(false);
      setBlockRecordId(null);

      // Check if current user is blocked by the DM partner
      const { data: blockedByOther } = await (supabase.from('blocked_users') as any)
        .select('id')
        .eq('blocker_id', dmUser.userId)
        .eq('blocked_id', user.id)
        .maybeSingle();

      if (blockedByOther) {
        setIsBlockedByOther(true);
        setDmBlocked(true);
        setDmDisabledReason('Bu kullanıcı tarafından engellendiniz.');
        return;
      }

      // Check if DM partner has allow_dms disabled and user is not a friend
      const { data: partnerProfile } = await (supabase.from('profiles') as any)
        .select('allow_dms')
        .eq('id', dmUser.userId)
        .maybeSingle();

      if (partnerProfile && partnerProfile.allow_dms === false) {
        // Check if they are friends
        const { data: friendship } = await supabase.from('friends').select('id')
          .or(`and(user_id.eq.${user.id},friend_id.eq.${dmUser.userId}),and(user_id.eq.${dmUser.userId},friend_id.eq.${user.id})`)
          .eq('status', 'accepted')
          .maybeSingle();

        if (!friendship) {
          setDmBlocked(true);
          setDmDisabledReason('Bu kullanıcı direkt mesajlara izin vermiyor.');
          return;
        }
      }

      setIsBlockedByOther(false);
      setDmBlocked(false);
      setDmDisabledReason(null);
    };
    checkPrivacy();
  }, [user, dmUser.userId]);

  const handleUnblockFromChat = async () => {
    if (!blockRecordId || unblocking) return;
    setUnblocking(true);
    await (supabase.from('blocked_users') as any).delete().eq('id', blockRecordId);
    setHasBlockedOther(false);
    setBlockRecordId(null);
    setUnblocking(false);
    toast.success(`${dmUser.displayName} engeli kaldırıldı`);
  };

  // Auto-start voice when coming from an accepted call
  useEffect(() => {
    if (!autoStartVoice || !user) return;
    const roomId = getDMRoomId(user.id, dmUser.userId);
    voice.joinVoice(roomId, `DM: ${dmUser.displayName}`);
    setVoicePanelVisible(true);
  }, [autoStartVoice, user, dmUser.userId, dmUser.displayName]);

  // Initiate call when triggered from friends list
  useEffect(() => {
    if (!initiateCall || !user || !profile || initiateCallHandled.current) return;
    initiateCallHandled.current = true;
    const startCall = async () => {
      if (isCallOutgoing || voice.connected) return;
      setIsCallOutgoing(true);
      const callerName = profile.display_name || profile.username || 'Biri';
      const callerAvatar = profile.avatar_url || null;
      await supabase.channel(`dm-call-${dmUser.userId}`).send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: { callerId: user.id, callerName, callerAvatar },
      });
      callTimeoutRef.current = setTimeout(() => {
        setIsCallOutgoing(false);
        toast.error('Arama yanıtsız kaldı');
      }, 30000);
    };
    startCall();
  }, [initiateCall, user, profile, dmUser.userId]);

  // Subscribe to call responses (accept/reject from the other side)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm-call-response-${user.id}`)
      .on('broadcast', { event: 'call_accepted' }, (payload: any) => {
        if (payload.payload?.calleeId !== dmUser.userId) return;
        setIsCallOutgoing(false);
        const roomId = getDMRoomId(user.id, dmUser.userId);
        voice.joinVoice(roomId, `DM: ${dmUser.displayName}`);
        setVoicePanelVisible(true);
      })
      .on('broadcast', { event: 'call_rejected' }, (payload: any) => {
        if (payload.payload?.calleeId !== dmUser.userId) return;
        setIsCallOutgoing(false);
        toast.error(`${dmUser.displayName} aramayı reddetti`);
      })
      .subscribe();
    callChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      callChannelRef.current = null;
    };
  }, [user?.id, dmUser.userId, dmUser.displayName]);

  const handleStartCall = useCallback(async () => {
    if (!user || !profile || isCallOutgoing || voice.connected) return;
    setIsCallOutgoing(true);
    const callerName = profile.display_name || profile.username || 'Biri';
    const callerAvatar = profile.avatar_url || null;
    await supabase.channel(`dm-call-${dmUser.userId}`).send({
      type: 'broadcast',
      event: 'incoming_call',
      payload: { callerId: user.id, callerName, callerAvatar },
    });
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      setIsCallOutgoing(false);
      toast.error('Arama yanıtsız kaldı');
    }, 30000);
  }, [user, profile, dmUser.userId, dmUser.displayName, isCallOutgoing, voice.connected]);

  const handleCancelCall = useCallback(async () => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    setIsCallOutgoing(false);
    if (user) {
      await supabase.channel(`dm-call-${dmUser.userId}`).send({
        type: 'broadcast',
        event: 'call_cancelled',
        payload: { callerId: user.id },
      });
    }
  }, [user, dmUser.userId]);

  const handleEndCall = useCallback(async () => {
    await voice.disconnect();
    setVoicePanelVisible(false);
    setVoiceFullscreen(false);
    setIsCallOutgoing(false);
  }, [voice]);

  // Sync onlineStatus prop (from presence in parent) into local state
  useEffect(() => {
    if (onlineStatus) setDmUserStatus(onlineStatus);
  }, [onlineStatus]);

  // Fetch and subscribe to dm user's real-time status
  // Note: profiles table has no status column — status comes from Presence (onlineStatus prop)
  useEffect(() => {
    if (!dmUser.userId) return;
    // Only use cached status as initial fallback when no presence status is available
    if (!onlineStatus) {
      const cacheKey = `aurorachat_dm_status_${dmUser.userId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached && STATUS_COLOR[cached]) setDmUserStatus(cached);
    }
  }, [dmUser.userId, onlineStatus]);

  // Fetch messages when conversation is ready
  useEffect(() => {
    if (!user || !conversationId) return;
    const fetchMessages = async () => {
      const { data } = await supabase.from('direct_messages').select('*')
        .eq('conversation_id', conversationId)
        .order('inserted_at', { ascending: true });
      if (data) {
        setMessages((data as any[]).map((m) => ({
          id: m.id, senderId: m.sender_id, content: m.content, createdAt: m.inserted_at, updatedAt: null,
          senderName: m.sender_id === user.id ? (profile?.display_name || 'Sen') : dmUser.displayName,
          senderAvatar: m.sender_id === user.id ? (profile?.avatar_url || null) : dmUser.avatarUrl,
          attachments: m.attachments || undefined,
        })));
      }
    };
    fetchMessages();
  }, [user, conversationId, dmUser, profile]);

  const userIdRef = useRef(user?.id);
  const dmUserIdRef = useRef(dmUser.userId);
  const dmDisplayNameRef = useRef(dmUser.displayName);
  const dmAvatarUrlRef = useRef(dmUser.avatarUrl);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  useEffect(() => { dmUserIdRef.current = dmUser.userId; }, [dmUser.userId]);
  useEffect(() => { dmDisplayNameRef.current = dmUser.displayName; }, [dmUser.displayName]);
  useEffect(() => { dmAvatarUrlRef.current = dmUser.avatarUrl; }, [dmUser.avatarUrl]);

  // Realtime subscription on conversation
  useEffect(() => {
    if (!user?.id || !conversationId) return;

    const handleInsert = (payload: any) => {
      const m = payload.new as any;
      if (m.conversation_id !== conversationId) return;
      if (m.sender_id === userIdRef.current) return;
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === m.id)) return prev;
        return [...prev, { id: m.id, senderId: m.sender_id, content: m.content, createdAt: m.inserted_at, updatedAt: null, senderName: dmDisplayNameRef.current, senderAvatar: dmAvatarUrlRef.current, attachments: m.attachments || undefined }];
      });
      // Note: DM notifications are handled globally in Index.tsx to avoid duplicates
    };

    const handleDelete = (payload: any) => {
      const old = payload.old as any;
      if (old?.id) setMessages((prev) => prev.filter((msg) => msg.id !== old.id));
    };

    const handleUpdate = (payload: any) => {
      const m = payload.new as any;
      if (m.conversation_id !== conversationId) return;
      setMessages((prev) => prev.map((msg) => msg.id === m.id ? { ...msg, content: m.content, updatedAt: new Date().toISOString() } : msg));
    };

    const ch = supabase.channel(`dm-conv-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, handleInsert)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'direct_messages' }, handleDelete)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, handleUpdate)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id, conversationId]);

  // Real-time block status: re-check whenever blocked_users changes
  useEffect(() => {
    if (!user || !dmUser.userId) return;
    const checkBlocking = async () => {
      const { data: myBlock } = await (supabase.from('blocked_users') as any)
        .select('id').eq('blocker_id', user.id).eq('blocked_id', dmUser.userId).maybeSingle();
      if (myBlock) {
        setHasBlockedOther(true); setBlockRecordId(myBlock.id);
        setIsBlockedByOther(false); setDmBlocked(false); setDmDisabledReason(null);
        return;
      }
      setHasBlockedOther(false); setBlockRecordId(null);
      const { data: blockedByOther } = await (supabase.from('blocked_users') as any)
        .select('id').eq('blocker_id', dmUser.userId).eq('blocked_id', user.id).maybeSingle();
      if (blockedByOther) {
        setIsBlockedByOther(true); setDmBlocked(true);
        setDmDisabledReason('Bu kullanıcı tarafından engellendiniz.');
      } else {
        setIsBlockedByOther(false); setDmBlocked(false); setDmDisabledReason(null);
      }
    };
    const blockChannel = supabase.channel(`block-status-${user.id}-${dmUser.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users' }, () => {
        checkBlocking();
      })
      .subscribe();
    return () => { supabase.removeChannel(blockChannel); };
  }, [user?.id, dmUser.userId]);

  // Typing indicators
  useEffect(() => {
    if (!user || !conversationId) return;
    const typingChannel = supabase.channel(`dm-typing-${conversationId}`);
    typingChannelRef.current = typingChannel;
    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => { if (payload.payload?.userId === dmUserIdRef.current) setIsTyping(true); })
      .on('broadcast', { event: 'stop_typing' }, (payload) => { if (payload.payload?.userId === dmUserIdRef.current) setIsTyping(false); })
      .subscribe();
    return () => { typingChannelRef.current = null; supabase.removeChannel(typingChannel); };
  }, [user?.id, conversationId]);

  const sendTypingEvent = useCallback(() => {
    if (!user || !typingChannelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id } });
    setTimeout(() => { typingChannelRef.current?.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: user.id } }); }, 3000);
  }, [user]);

  const stopTypingEvent = useCallback(() => {
    if (!user || !typingChannelRef.current) return;
    typingChannelRef.current.send({ type: 'broadcast', event: 'stop_typing', payload: { userId: user.id } });
  }, [user]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (pendingFiles.length + files.length > MAX_FILES) { toast.error(t('chat.maxFiles')); return; }
    for (const f of files) { if (f.size > MAX_FILE_SIZE) { toast.error(t('chat.fileTooLarge')); return; } }
    setPendingFiles((prev) => [...prev, ...files].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingFiles, t]);

  const handleSend = useCallback(async (overrideContent?: string) => {
    const contentToSend = overrideContent ?? input.trim();
    if ((!contentToSend && pendingFiles.length === 0) || !user || !profile || !conversationId) return;

    // If blocked, show system message instead of sending
    if (isBlockedByOther) {
      const systemMsg: DMMessage = {
        id: `system-${crypto.randomUUID()}`,
        senderId: SYSTEM_SENDER_ID,
        content: 'Bu mesaj şu anda gönderilemiyor. (Kullanıcı Sizi Engellemiş Olabilir.)',
        createdAt: new Date().toISOString(),
        updatedAt: null,
        senderName: 'AuroraChat Sistem',
        senderAvatar: null,
      };
      setMessages((prev) => [...prev, systemMsg]);
      setInput('');
      setPendingFiles([]);
      return;
    }
    const content = contentToSend;
    const filesToUpload = [...pendingFiles];
    setInput('');
    setPendingFiles([]);
    stopTypingEvent();

    const tempId = crypto.randomUUID();
    const optimistic: DMMessage = { id: tempId, senderId: user.id, content, createdAt: new Date().toISOString(), updatedAt: null, senderName: profile.display_name || 'Sen', senderAvatar: profile.avatar_url || null, status: 'sending' };
    setMessages((prev) => [...prev, optimistic]);

    let attachmentUrls: string[] | undefined;
    if (filesToUpload.length > 0) {
      setUploading(true);
      attachmentUrls = await uploadFiles(filesToUpload, user.id, tempId);
      setUploading(false);
      if (attachmentUrls.length === 0 && !content) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(t('settings.uploadFailed'));
        return;
      }
    }

    const insertData: any = { sender_id: user.id, conversation_id: conversationId, content: content || '' };
    if (attachmentUrls && attachmentUrls.length > 0) insertData.attachments = attachmentUrls;

    const { data, error } = await supabase.from('direct_messages').insert(insertData).select().single();
    if (error) { setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: 'failed' as const } : m)); }
    else if (data) {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: (data as any).id, status: undefined, attachments: attachmentUrls } : m));
      // Send push notification to recipient (for offline/background case)
      const senderName = profile?.display_name || profile?.username || 'Biri';
      const pushBody = (content || '📎 Dosya').slice(0, 100);
      supabase.auth.getSession().then(({ data: { session } }) => {
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            user_id: dmUser.userId,
            title: `${senderName} sana mesaj gönderdi`,
            body: pushBody,
            data: { conversation_id: (data as any).conversation_id, message_id: (data as any).id },
          }),
        }).catch(() => {});
      }).catch(() => {});
    }
  }, [input, user, profile, conversationId, stopTypingEvent, pendingFiles, t, isBlockedByOther, dmUser.userId]);

  const handleEdit = async (msgId: string) => {
    if (!editValue.trim()) return;
    const newContent = editValue.trim();
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: newContent, updatedAt: new Date().toISOString() } : m));
    setEditingId(null); setEditValue('');
    await supabase.from('direct_messages').update({ content: newContent } as any).eq('id', msgId);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await supabase.from('direct_messages').delete().eq('id', id);
  };

  const handleRetrySend = useCallback(async (msg: DMMessage) => {
    if (!user || !profile || !conversationId) return;
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: 'sending' as const } : m));
    const insertData: any = { sender_id: user.id, conversation_id: conversationId, content: msg.content };
    if (msg.attachments) insertData.attachments = msg.attachments;
    const { data, error } = await supabase.from('direct_messages').insert(insertData).select().single();
    if (error) { setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: 'failed' as const } : m)); }
    else if (data) { setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, id: (data as any).id, status: undefined } : m)); }
  }, [user, profile, conversationId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) sendTypingEvent(); else stopTypingEvent();
  };

  const isOwnMessage = (msg: DMMessage) => msg.senderId === user?.id;

  const shouldShowAvatar = (msg: DMMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    return prev.senderId !== msg.senderId || (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000);
  };

  const isInVoiceCall = voice.connected && voice.voiceChannelId === getDMRoomId(user?.id || '', dmUser.userId);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-background relative">
      {/* Outgoing Call Overlay */}
      {isCallOutgoing && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
          <Avatar className="h-24 w-24 mb-5 ring-4 ring-primary/30 shadow-xl">
            {dmUser.avatarUrl && <AvatarImage src={dmUser.avatarUrl} />}
            <AvatarFallback className="bg-secondary text-foreground text-3xl font-bold">{dmUser.displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className="text-xl font-semibold text-foreground mb-1">{dmUser.displayName}</p>
          <div className="flex items-center gap-2 text-muted-foreground mb-10">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Aranıyor...</span>
          </div>
          <button
            onClick={handleCancelCall}
            data-testid="button-cancel-call"
            className="flex items-center gap-2 px-7 py-3 rounded-full bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90 transition-colors shadow-lg"
          >
            <PhoneOff className="w-5 h-5" />
            Aramayı İptal Et
          </button>
        </div>
      )}
      {/* Header */}
      <div className={`flex items-center px-4 border-b border-border shadow-sm gap-3 ${isMobile ? 'min-h-[56px]' : 'h-12'}`}>
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative shrink-0">
            <Avatar className={`${isMobile ? 'h-9 w-9' : 'h-7 w-7'}`}>
              {dmUser.avatarUrl && <AvatarImage src={dmUser.avatarUrl} />}
              <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">{dmUser.displayName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${STATUS_COLOR[dmUserStatus] || 'bg-gray-500'} border-2 border-background`} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-foreground text-sm block truncate">{dmUser.displayName}</span>
            <span className="text-[11px] text-muted-foreground block truncate">
              {isInVoiceCall ? (
                <span className="text-[#3ba55d] font-medium">Sesli Görüşmede</span>
              ) : isCallOutgoing ? (
                <span className="text-yellow-400 font-medium animate-pulse">Aranıyor...</span>
              ) : (
                <>{STATUS_LABEL[dmUserStatus] || 'Çevrimdışı'} · @{dmUser.username}</>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isInVoiceCall ? (
            <>
              <button
                onClick={() => setVoicePanelVisible(v => !v)}
                className="p-2 rounded-lg text-[#3ba55d] hover:bg-[#3ba55d]/15 transition-colors"
                title={voicePanelVisible ? 'Ses Panelini Gizle' : 'Ses Panelini Göster'}
                data-testid="button-dm-voice-toggle"
              >
                {voicePanelVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {voicePanelVisible && (
                <button
                  onClick={() => setVoiceFullscreen(v => !v)}
                  className="p-2 rounded-lg text-[#3ba55d] hover:bg-[#3ba55d]/15 transition-colors"
                  title={voiceFullscreen ? 'Küçük Ekran' : 'Tam Ekran'}
                  data-testid="button-dm-voice-fullscreen"
                >
                  {voiceFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={handleEndCall}
                className="p-2 rounded-lg text-destructive hover:bg-destructive/15 transition-colors"
                title="Aramayı Sonlandır"
                data-testid="button-dm-voice-end"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleStartCall}
                disabled={isCallOutgoing}
                className={`p-2 rounded-lg transition-colors ${
                  isCallOutgoing
                    ? 'text-yellow-400 bg-yellow-400/10 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
                title={isCallOutgoing ? 'Aranıyor...' : 'Sesli Arama'}
                data-testid="button-dm-voice-call"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors" title="Görüntülü Arama">
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* DM Voice Panel - split or full screen when active */}
      {isInVoiceCall && voicePanelVisible && (
        <div className={voiceFullscreen ? 'flex-1 min-h-0' : 'shrink-0 border-b border-border'} style={voiceFullscreen ? {} : { height: '45%' }}>
          <VoiceMeetingRoom voiceState={voice} isMobile={isMobile} />
        </div>
      )}

      {/* Messages - hidden only when voice panel is in full screen mode */}
      <div className={`flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-3 md:px-4 py-4 space-y-0.5 ${isInVoiceCall && voicePanelVisible && voiceFullscreen ? 'hidden' : ''}`} style={{ minHeight: 0 }}>
        <div className="mb-6 flex flex-col items-center text-center py-8">
          <Avatar className={`${isMobile ? 'h-16 w-16' : 'h-20 w-20'} mb-3 ring-4 ring-secondary`}>
            {dmUser.avatarUrl && <AvatarImage src={dmUser.avatarUrl} />}
            <AvatarFallback className="bg-secondary text-foreground text-2xl font-bold">{dmUser.displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>{dmUser.displayName}</h2>
          <p className="text-muted-foreground text-xs mt-1">@{dmUser.username}</p>
          <p className="text-muted-foreground text-sm mt-2 max-w-xs">{t('dm.conversationStart', { username: dmUser.username })}</p>
        </div>

        {messages.map((msg, idx) => {
          const isSystem = msg.senderId === SYSTEM_SENDER_ID;
          const own = isOwnMessage(msg);
          const showAvatar = shouldShowAvatar(msg, idx);

          // System message rendering
          if (isSystem) {
            return (
              <div key={msg.id} className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold uppercase text-destructive bg-destructive/20 px-1.5 py-0.5 rounded">AuroraChat Sistem</span>
                </div>
                <span className="text-sm text-destructive">{msg.content}</span>
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatTimestamp(msg.createdAt)}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              id={`dm-msg-${msg.id}`}
              className={`group flex gap-2.5 py-0.5 px-2 rounded-lg transition-colors ${
                showAvatar ? 'mt-3' : 'mt-0.5'
              } ${msg.status === 'sending' ? 'opacity-50' : ''
              } ${msg.status === 'failed' ? 'border border-destructive/40 bg-destructive/5' : ''
              } hover:bg-secondary/20`}
            >
              <div className={`shrink-0 ${isMobile ? 'w-8' : 'w-9'}`}>
                {showAvatar ? (
                  <Avatar className={`${isMobile ? 'h-8 w-8' : 'h-9 w-9'}`}>
                    {msg.senderAvatar && <AvatarImage src={msg.senderAvatar} />}
                    <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">{msg.senderName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                {showAvatar && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-[13px] text-foreground">{msg.senderName}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTimestamp(msg.createdAt)}</span>
                    {msg.updatedAt && <span className="text-[9px] text-muted-foreground italic">{t('dm.edited')}</span>}
                  </div>
                )}

                {editingId === msg.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(msg.id); if (e.key === 'Escape') { setEditingId(null); setEditValue(''); } }}
                      className="flex-1 bg-input rounded-lg px-3 py-1.5 text-sm outline-none text-foreground ring-1 ring-border focus:ring-primary/40"
                      autoFocus
                    />
                    <button onClick={() => handleEdit(msg.id)} className="text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingId(null); setEditValue(''); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div>
                    {msg.content && (
                      <div className="inline-block rounded-2xl px-3.5 py-2 text-sm max-w-[85%] bg-secondary/60 text-foreground rounded-bl-md">
                        {renderMessageContent(msg.content)}
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <MessageAttachments attachments={msg.attachments} />
                    )}
                    {msg.status === 'sending' && !showAvatar && (
                      <span className="text-[10px] text-muted-foreground italic ml-1">{t('dm.sending')}</span>
                    )}
                    {msg.status === 'failed' && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-destructive">{t('dm.failed')}</span>
                        <button onClick={() => handleRetrySend(msg)} className="text-xs text-primary hover:underline">{t('dm.retry')}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {own && editingId !== msg.id && !msg.status && (
                <div className={`${isMobile ? 'flex' : 'hidden group-hover:flex'} items-center gap-0.5 shrink-0 self-start mt-1`}>
                  <button onClick={() => { setEditingId(msg.id); setEditValue(msg.content); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title={t('dm.edit')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(msg.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t('dm.delete')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {isTyping && !(isInVoiceCall && voicePanelVisible && voiceFullscreen) && (
        <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground h-6">
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span className="font-medium">{t('dm.typing', { user: dmUser.displayName })}</span>
        </div>
      )}

      {!(isInVoiceCall && voicePanelVisible && voiceFullscreen) && (
        <FileUploadPreview files={pendingFiles} onRemove={(i) => setPendingFiles((p) => p.filter((_, idx) => idx !== i))} />
      )}

      {/* Input area - hidden in fullscreen voice mode */}
      <div className={`px-3 md:px-4 pt-2 ${isMobile ? 'pb-[calc(0.75rem+env(safe-area-inset-bottom))] pr-4' : 'pb-5'} ${isInVoiceCall && voicePanelVisible && voiceFullscreen ? 'hidden' : ''}`}>
        {hasBlockedOther ? (
          <div className="bg-secondary/40 rounded-2xl flex items-center justify-between px-4 py-3 ring-1 ring-border gap-3">
            <span className="text-sm text-muted-foreground">Engellediğin bir kullanıcıya mesaj gönderemezsin.</span>
            <button
              onClick={handleUnblockFromChat}
              disabled={unblocking}
              className="text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors shrink-0 disabled:opacity-50"
            >
              {unblocking ? '...' : 'Engeli kaldır'}
            </button>
          </div>
        ) : dmBlocked && !isBlockedByOther ? (
          <div className="bg-secondary/40 rounded-2xl flex items-center justify-center px-4 py-3 ring-1 ring-border text-sm text-muted-foreground">
            {dmDisabledReason}
          </div>
        ) : (
          <div className="bg-secondary/40 rounded-2xl flex items-center px-3 md:px-4 gap-2 ring-1 ring-border focus-within:ring-primary/40 transition-all">
            <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            <button onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" disabled={dmBlocked}>
              <PlusCircle className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isBlockedByOther ? 'Mesaj gönderemezsiniz' : t('dm.messagePlaceholder', { user: dmUser.displayName })}
              className={`flex-1 bg-transparent ${isMobile ? 'py-3 text-[16px]' : 'py-3 text-sm'} outline-none text-foreground placeholder:text-muted-foreground`}
            />
            <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
              {!isMobile && (
                <button onClick={() => fileInputRef.current?.click()} className="hover:text-foreground transition-colors p-1">
                  <ImagePlus className="w-5 h-5" />
                </button>
              )}
              <GifPicker onGifSelect={(url) => handleSend(url)} />
              <EmojiPicker onEmojiSelect={(emoji) => setInput(prev => prev + emoji)} />
              {(input.trim() || pendingFiles.length > 0) && (
                <button onClick={() => handleSend()} className="bg-primary text-primary-foreground rounded-full p-1.5 hover:bg-primary/90 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dm.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dm.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('dm.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DMChatArea;
