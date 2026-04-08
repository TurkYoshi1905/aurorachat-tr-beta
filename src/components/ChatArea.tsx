import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { DbMessage, DbReaction, DbMember } from '@/types/chat';
import { Hash, Users, Pin, Search, SmilePlus, PlusCircle, Gift, ImagePlus, Send, ArrowLeft, Trash2, Pencil, Check, X, Lock, SendHorizontal, Reply, CornerDownRight, MessageSquare, Clock, Bell } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { renderMessageContent, type ServerEmoji } from '@/utils/messageRenderer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import MessageAttachments from './MessageAttachments';
import FileUploadPreview from './FileUploadPreview';
import { toast } from 'sonner';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import MentionPopup from './MentionPopup';
import SlashCommandPopup from './SlashCommandPopup';
import EmojiAutocompletePopup from './EmojiAutocompletePopup';
import UserProfileCard from './UserProfileCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import NotificationSettingsPopover from './NotificationSettingsPopover';
import { executeBotCommand, checkAfkMention } from '@/utils/botCommands';
import { pickFiles } from '@/lib/fileHelper';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀', '💯', '✅', '❌', '🤔', '👏', '💪', '🙏', '😎', '🥳', '💀', '😭', '🫡', '👎', '💜', '🧡'];

const MAX_FILES = 3;
const FREE_FILE_SIZE  = 10 * 1024 * 1024;
const BASIC_FILE_SIZE = 20 * 1024 * 1024;
const PREM_FILE_SIZE  = 50 * 1024 * 1024;

interface ChatAreaProps {
  channelName: string;
  channelId?: string;
  messages: DbMessage[];
  onSendMessage: (content: string, files?: File[], replyTo?: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRetryMessage?: (messageId: string, content: string) => void;
  onToggleMembers: () => void;
  showMembers: boolean;
  isOwner?: boolean;
  isMobile?: boolean;
  onBack?: () => void;
  reactions?: Record<string, DbReaction[]>;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  typingUsers?: { userId: string; displayName: string }[];
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  members?: DbMember[];
  isLocked?: boolean;
  onPinMessage?: (messageId: string) => void;
  onUnpinMessage?: (messageId: string) => void;
  serverId?: string;
  threadCounts?: Record<string, number>;
  onOpenThread?: (messageId: string, author: string, content: string, threadId: string | null) => void;
  userPermissions?: Record<string, boolean>;
  serverEmojis?: ServerEmoji[];
  onToggleSearch?: () => void;
  onToggleNotifications?: () => void;
  slowModeInterval?: number;
  wordFilter?: string[];
  onBotMessage?: (content: string) => void;
}

const LONG_MESSAGE_CHAR_THRESHOLD = 400;

const CollapsibleMessageContent = memo(({ content, userId, serverEmojis }: { content: string; userId?: string; serverEmojis?: ServerEmoji[] }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > LONG_MESSAGE_CHAR_THRESHOLD;

  if (!isLong) {
    return <div className="text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap">{renderMessageContent(content, userId, serverEmojis)}</div>;
  }

  return (
    <div>
      <div
        className={`text-sm text-foreground leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap relative overflow-hidden transition-all duration-200`}
        style={{ maxHeight: expanded ? 'none' : '200px' }}
      >
        {renderMessageContent(content, userId, serverEmojis)}
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-xs text-primary hover:text-primary/80 font-medium mt-1 transition-colors"
      >
        {expanded ? '▲ Daha az göster' : '▼ Devamını göster'}
      </button>
    </div>
  );
});

const TypingIndicator = ({ typingUsers, t }: { typingUsers: { userId: string; displayName: string }[]; t: (key: string, vars?: Record<string, string | number>) => string }) => {
  if (typingUsers.length === 0) return null;
  let text = '';
  if (typingUsers.length === 1) { text = t('chat.typing1', { user: typingUsers[0].displayName }); }
  else if (typingUsers.length === 2) { text = t('chat.typing2', { user1: typingUsers[0].displayName, user2: typingUsers[1].displayName }); }
  else if (typingUsers.length === 3) { text = t('chat.typing3', { user1: typingUsers[0].displayName, user2: typingUsers[1].displayName, user3: typingUsers[2].displayName }); }
  else { text = t('chat.typingMany', { count: typingUsers.length }); }
  return (
    <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground h-6">
      <span className="inline-flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span className="font-medium">{text}</span>
    </div>
  );
};

const POLL_OPTION_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

const parsePoll = (content: string): { question: string; options: { emoji: string; label: string }[] } | null => {
  if (!content.startsWith('📊 **ANKET**')) return null;
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let question = '';
  const options: { emoji: string; label: string }[] = [];
  for (const line of lines) {
    if (line === '📊 **ANKET**') continue;
    const boldMatch = line.match(/^\*\*(.+)\*\*$/);
    if (boldMatch && !question) { question = boldMatch[1]; continue; }
    for (const emoji of POLL_OPTION_EMOJIS) {
      if (line.startsWith(emoji)) {
        options.push({ emoji, label: line.slice(emoji.length).trim() });
        break;
      }
    }
  }
  if (!question || options.length === 0) return null;
  return { question, options };
};

const PollMessage = ({ messageId, content, reactions, onToggleReaction, currentUserId }: {
  messageId: string;
  content: string;
  reactions: { emoji: string; userIds: string[]; count: number }[];
  onToggleReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
}) => {
  const poll = parsePoll(content);
  if (!poll) return <span>{content}</span>;
  const totalVotes = poll.options.reduce((sum, opt) => {
    const r = reactions.find(r => r.emoji === opt.emoji);
    return sum + (r?.count || 0);
  }, 0);
  return (
    <div className="mt-1 rounded-xl border border-[#3f4147] bg-[#2b2d31] p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📊</span>
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#b5bac1]">Anket</span>
      </div>
      <p className="text-[#dbdee1] font-semibold text-sm mb-3">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const r = reactions.find(r => r.emoji === opt.emoji);
          const count = r?.count || 0;
          const voted = !!(currentUserId && r?.userIds.includes(currentUserId));
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          return (
            <button
              key={opt.emoji}
              onClick={() => onToggleReaction?.(messageId, opt.emoji)}
              className={`w-full text-left rounded-lg border px-3 py-2 transition-all text-sm relative overflow-hidden group ${voted ? 'border-[#5865f2] bg-[#5865f2]/15' : 'border-[#3f4147] hover:border-[#5865f2]/50 hover:bg-[#35373c]'}`}
            >
              {pct > 0 && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all ${voted ? 'bg-[#5865f2]/20' : 'bg-[#3f4147]/60'}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-base">{opt.emoji}</span>
                  <span className={voted ? 'text-[#c9cdfb] font-medium' : 'text-[#b5bac1]'}>{opt.label}</span>
                </span>
                <span className={`text-xs font-medium ${voted ? 'text-[#c9cdfb]' : 'text-[#6d6f78]'}`}>
                  {count > 0 ? `${pct}%` : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-[#6d6f78] mt-2">{totalVotes} oy</p>
    </div>
  );
};

const ChatArea = ({ channelName, channelId, messages, onSendMessage, onDeleteMessage, onEditMessage, onRetryMessage, onToggleMembers, showMembers, isOwner, isMobile, onBack, reactions, onToggleReaction, typingUsers, onTypingStart, onTypingStop, members = [], isLocked, onPinMessage, onUnpinMessage, serverId, threadCounts, onOpenThread, userPermissions, serverEmojis, onToggleSearch, onToggleNotifications, slowModeInterval, wordFilter, onBotMessage }: ChatAreaProps) => {
  const { user, profile } = useAuth();
  const MAX_FILE_SIZE = profile?.is_premium ? PREM_FILE_SIZE : profile?.has_basic_badge ? BASIC_FILE_SIZE : FREE_FILE_SIZE;
  const { t } = useTranslation();
  const isMobileDevice = useIsMobile();
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [showSlashPopup, setShowSlashPopup] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [showEmojiAutocomplete, setShowEmojiAutocomplete] = useState(false);
  const [emojiAutocompleteQuery, setEmojiAutocompleteQuery] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<DbMessage | null>(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [slowModeCountdown, setSlowModeCountdown] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef<number>(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<number>(0);

  const isSlowModeExempt = !!(isOwner || userPermissions?.manage_messages || userPermissions?.administrator);
  const effectiveSlowMode = (slowModeInterval && slowModeInterval > 0 && !isSlowModeExempt) ? slowModeInterval : 0;

  // Slow mode countdown timer
  useEffect(() => {
    if (slowModeCountdown <= 0) return;
    const timer = setInterval(() => {
      setSlowModeCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [slowModeCountdown]);

  const pinnedMessages = messages.filter(m => m.isPinned);

  useEffect(() => { requestAnimationFrame(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }); }, [messages]);
  useEffect(() => { if (editingId) editInputRef.current?.focus(); }, [editingId]);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/10');
      setTimeout(() => el.classList.remove('bg-primary/10'), 2000);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    
    if (val.startsWith('/')) {
      setShowSlashPopup(true);
      setSlashQuery(val.slice(1).split(' ')[0]);
    } else {
      setShowSlashPopup(false);
      setSlashQuery('');
    }
    
    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);
    if (mentionMatch) {
      setShowMentionPopup(true);
      setMentionQuery(mentionMatch[1]);
    } else {
      setShowMentionPopup(false);
      setMentionQuery('');
    }
    
    // Emoji autocomplete: detect :query pattern (at least 2 chars after :)
    const emojiMatch = textBeforeCursor.match(/:([a-z0-9_]{2,})$/);
    if (emojiMatch) {
      setShowEmojiAutocomplete(true);
      setEmojiAutocompleteQuery(emojiMatch[1]);
    } else {
      setShowEmojiAutocomplete(false);
      setEmojiAutocompleteQuery('');
    }
    
    if (val.trim()) { const now = Date.now(); if (now - lastTypingSentRef.current > 2000) { lastTypingSentRef.current = now; onTypingStart?.(); } }
    else { onTypingStop?.(); }
  }, [onTypingStart, onTypingStop]);

  const handleSlashSelect = useCallback((cmd: string) => {
    setInput(cmd + ' ');
    setShowSlashPopup(false);
    setSlashQuery('');
    inputRef.current?.focus();
  }, []);

  const handleMentionSelect = useCallback((name: string) => {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
      const afterCursor = input.slice(cursorPos);
      setInput(`${beforeMention}@${name} ${afterCursor}`);
    }
    setShowMentionPopup(false);
    setMentionQuery('');
    inputRef.current?.focus();
  }, [input]);

  const handleEmojiAutocompleteSelect = useCallback((value: string, isCustom: boolean) => {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const emojiMatch = textBeforeCursor.match(/:([a-z0-9_]{2,})$/);
    if (emojiMatch) {
      const beforeEmoji = textBeforeCursor.slice(0, emojiMatch.index);
      const afterCursor = input.slice(cursorPos);
      setInput(`${beforeEmoji}${value} ${afterCursor}`);
    }
    setShowEmojiAutocomplete(false);
    setEmojiAutocompleteQuery('');
    inputRef.current?.focus();
  }, [input]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const totalFiles = pendingFiles.length + files.length;
    if (totalFiles > MAX_FILES) { toast.error(t('chat.maxFiles')); return; }
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) { toast.error(t('chat.fileTooLarge')); return; }
    }
    setPendingFiles((prev) => [...prev, ...files].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingFiles, t]);

  const handlePickFiles = useCallback(async () => {
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    if (pendingFiles.length + files.length > MAX_FILES) { toast.error(t('chat.maxFiles')); return; }
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) { toast.error(t('chat.fileTooLarge')); return; }
    }
    setPendingFiles((prev) => [...prev, ...files].slice(0, MAX_FILES));
  }, [pendingFiles, t]);

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const applyWordFilter = useCallback((text: string): string => {
    if (!wordFilter || wordFilter.length === 0) return text;
    let filtered = text;
    for (const word of wordFilter) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      filtered = filtered.replace(regex, '***');
    }
    return filtered;
  }, [wordFilter]);

  const formatCountdown = (seconds: number) => {
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}sa ${Math.floor((seconds % 3600) / 60)}dk`;
    if (seconds >= 60) return `${Math.floor(seconds / 60)}dk ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const handleSend = async () => {
    if (!input.trim() && pendingFiles.length === 0) return;

    // Bot command handling
    if (input.trim().startsWith('/') && serverId && channelId && user) {
      const ctx = {
        serverId,
        channelId,
        userId: user.id,
        isOwner: !!isOwner,
        members: members.map(m => ({ id: m.id, name: m.name, role: m.role })),
      };
      const response = await executeBotCommand(input.trim(), ctx);
      if (response) {
        const { supabase: sb } = await import('@/integrations/supabase/client');
        // Clear AFK on any command except /afk itself (which sets it)
        const cmdName = input.trim().split(/\s+/)[0].toLowerCase().replace('/', '');
        if (cmdName !== 'afk') {
          await sb.from('profiles').update({ is_afk: false, afk_reason: '' } as any).eq('id', user.id);
        }
        
        // First send the user's command as a normal message
        onSendMessage(input.trim());
        
        // Insert bot response as a real message in DB (for other users via realtime)
        await sb.from('messages').insert({
          channel_id: channelId,
          user_id: user.id,
          author_name: 'AuroraChat Bot',
          content: response.content,
          server_id: serverId,
        } as any);
        
        // Directly notify parent to add bot message to state immediately (reliable for current user)
        onBotMessage?.(response.content);
        
        setInput('');
        setPendingFiles([]);
        setReplyingTo(null);
        onTypingStop?.();
        return;
      }
    }

    // Check AFK mentions — send bot message to chat
    if (input.trim().includes('@') && members.length > 0 && serverId && channelId && user) {
      const afkMsg = await checkAfkMention(input.trim(), members.map(m => ({ id: m.id, name: m.name, username: m.username })));
      if (afkMsg) {
        const { supabase: sb } = await import('@/integrations/supabase/client');
        await sb.from('messages').insert({
          channel_id: channelId,
          user_id: user.id,
          author_name: 'AuroraChat Bot',
          content: afkMsg,
          server_id: serverId,
        } as any);
      }
    }

    // Clear own AFK on any message
    if (user) {
      import('@/integrations/supabase/client').then(({ supabase }) => 
        supabase.from('profiles').update({ is_afk: false, afk_reason: '' } as any).eq('id', user.id)
      );
    }

    // Slow mode check
    if (effectiveSlowMode > 0) {
      const now = Date.now();
      const elapsed = (now - lastMessageTimeRef.current) / 1000;
      if (elapsed < effectiveSlowMode) {
        const remaining = Math.ceil(effectiveSlowMode - elapsed);
        setSlowModeCountdown(remaining);
        toast.error(`Yavaş mod aktif. ${formatCountdown(remaining)} bekleyin.`);
        return;
      }
      lastMessageTimeRef.current = now;
      setSlowModeCountdown(effectiveSlowMode);
    }
    const filteredInput = applyWordFilter(input.trim());
    onSendMessage(filteredInput, pendingFiles.length > 0 ? pendingFiles : undefined, replyingTo?.id);
    setInput('');
    setPendingFiles([]);
    setReplyingTo(null);
    onTypingStop?.();
  };

  const startEdit = (msg: DbMessage) => { setEditingId(msg.id); setEditContent(msg.content); };
  const cancelEdit = () => { setEditingId(null); setEditContent(''); };
  const confirmEdit = () => { if (!editingId || !editContent.trim()) return; onEditMessage?.(editingId, editContent.trim()); setEditingId(null); setEditContent(''); };

  // Mobile long-press context menu
  const [longPressMsg, setLongPressMsg] = useState<DbMessage | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const handleTouchStart = useCallback((msg: DbMessage) => {
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) setLongPressMsg(msg);
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
      <TooltipProvider delayDuration={300}>
      <div className="h-12 flex items-center px-4 border-b border-border shadow-sm gap-2">
        {isMobile && onBack && (<button onClick={onBack} className="mr-1 text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>)}
        <Hash className="w-5 h-5 text-muted-foreground" />
        <span className="font-semibold text-foreground">{channelName}</span>
        <div className="ml-auto flex items-center gap-3 text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <Popover open={showPinnedPanel} onOpenChange={setShowPinnedPanel}>
                <PopoverTrigger asChild>
                  <button className={`hover:text-foreground transition-colors relative ${showPinnedPanel ? 'text-foreground' : ''}`}>
                    <Pin className="w-4 h-4" />
                    {pinnedMessages.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold">{pinnedMessages.length}</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-80 p-0 max-h-96">
                  <div className="p-3 border-b border-border">
                    <h3 className="font-semibold text-sm text-foreground">{t('chat.pinnedMessages')}</h3>
                  </div>
                  <ScrollArea className="max-h-80">
                    {pinnedMessages.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">{t('chat.noPinnedMessages')}</p>
                    ) : (
                      <div className="p-2 space-y-2">
                        {pinnedMessages.map(msg => (
                          <div key={msg.id} className="p-2 rounded-md bg-secondary/50 hover:bg-secondary/80 cursor-pointer transition-colors" onClick={() => { scrollToMessage(msg.id); setShowPinnedPanel(false); }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">{msg.author}</span>
                              <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>{t('chat.pinnedMessages')}</p></TooltipContent>
          </Tooltip>
          {channelId && serverId && <NotificationSettingsPopover channelId={channelId} serverId={serverId} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onToggleMembers} className={`hover:text-foreground transition-colors ${showMembers ? 'text-foreground' : ''}`}><Users className="w-4 h-4" /></button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>{t('members.title') || 'Üyeler'}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onToggleSearch} className="hover:text-foreground transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>{t('chat.search') || 'Mesaj Ara'}</p></TooltipContent>
          </Tooltip>
          {onToggleNotifications && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleNotifications} className="hover:text-foreground transition-colors relative" data-testid="button-notification-history">
                  <Bell className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Bildirim Geçmişi</p></TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      </TooltipProvider>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin px-4 py-4 space-y-4" style={{ minHeight: 0 }}>
        <div className="mb-6">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-3xl mb-3"><Hash className="w-8 h-8 text-foreground" /></div>
          <h2 className="text-2xl font-bold text-foreground">{t('chat.welcomeChannel', { channel: channelName })}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t('chat.channelStart', { channel: channelName })}</p>
        </div>

        {messages.map((msg) => {
          const msgReactions = reactions?.[msg.id] || [];
          const replyRef = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;
          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`flex gap-3 group hover:bg-secondary/30 -mx-2 px-2 py-1 rounded-md transition-colors relative ${msg.status === 'sending' ? 'opacity-50' : ''} ${msg.status === 'failed' ? 'border border-destructive/40 bg-destructive/5' : ''}`}
              onTouchStart={isMobileDevice ? () => handleTouchStart(msg) : undefined}
              onTouchMove={isMobileDevice ? handleTouchMove : undefined}
              onTouchEnd={isMobileDevice ? handleTouchEnd : undefined}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 font-semibold overflow-hidden ${msg.isBot ? 'bg-primary/20 aurora-glow' : 'bg-secondary'}`}>
                {msg.avatarUrl ? (<img src={msg.avatarUrl} alt="" className="w-full h-full object-cover" />) : (msg.avatar)}
              </div>
              <div className="min-w-0 flex-1">
                {/* Reply reference */}
                {(replyRef || msg.replyAuthor) && (
                  <button
                    onClick={() => replyRef && scrollToMessage(replyRef.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-0.5 transition-colors"
                  >
                    <CornerDownRight className="w-3 h-3" />
                    <span className="font-medium text-primary">@{replyRef?.author || msg.replyAuthor}</span>
                    <span className="truncate max-w-[200px]">{replyRef?.content || msg.replyContent || ''}</span>
                  </button>
                )}
                <div className="flex items-baseline gap-2">
                  <UserProfileCard userId={msg.userId} serverId={serverId} status={members.find(m => m.id === msg.userId)?.status}>
                    {(() => {
                      const member = members.find(m => m.id === msg.userId);
                      const hasGradient = !!(member?.roleColor && member?.roleGradientEnd);
                      const authorStyle: React.CSSProperties = hasGradient
                        ? { background: `linear-gradient(to right, ${member!.roleColor}, ${member!.roleGradientEnd}, ${member!.roleColor})`, backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                        : member?.roleColor
                          ? { color: member.roleColor }
                          : {};
                      return (
                        <button
                          className={`font-medium text-sm hover:underline ${msg.isBot ? 'text-primary' : (!member?.roleColor ? 'text-foreground' : '')} ${hasGradient && !msg.isBot ? 'role-gradient-text' : ''}`}
                          style={!msg.isBot ? authorStyle : {}}
                        >
                          {msg.author}
                        </button>
                      );
                    })()}
                  </UserProfileCard>
                  {msg.isBot && (<span className="text-[9px] bg-primary text-primary-foreground px-1 py-0.5 rounded font-bold uppercase">Bot</span>)}
                  <span className="text-[11px] text-muted-foreground">{msg.timestamp}</span>
                  {msg.edited && (<span className="text-[10px] text-muted-foreground italic">{t('chat.edited')}</span>)}
                  {msg.status === 'sending' && (<span className="text-[10px] text-muted-foreground italic">{t('chat.sending')}</span>)}
                  {msg.isPinned && (<Pin className="w-3 h-3 text-primary" />)}
                </div>
                {editingId === msg.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input ref={editInputRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }} className="flex-1 bg-input rounded px-2 py-1 text-sm outline-none text-foreground" />
                    <button onClick={confirmEdit} className="text-green-500 hover:text-green-400 transition-colors"><Check className="w-4 h-4" /></button>
                    <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    {msg.content && (
                      msg.content.startsWith('📊 **ANKET**')
                        ? <PollMessage messageId={msg.id} content={msg.content} reactions={reactions?.[msg.id] || []} onToggleReaction={onToggleReaction} currentUserId={user?.id} />
                        : <CollapsibleMessageContent content={msg.content} userId={user?.id} serverEmojis={serverEmojis} />
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <MessageAttachments attachments={msg.attachments} />
                    )}
                    {msg.status === 'failed' && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-destructive">{t('chat.failed')}</span>
                        <button onClick={() => onRetryMessage?.(msg.id, msg.content)} className="text-xs text-primary hover:underline">{t('chat.retry')}</button>
                      </div>
                    )}
                  </>
                )}
                {msgReactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msgReactions.map((r) => {
                      const hasReacted = user ? r.userIds.includes(user.id) : false;
                      return (<button key={r.emoji} onClick={() => onToggleReaction?.(msg.id, r.emoji)} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md border transition-colors ${hasReacted ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary'}`}><span>{r.emoji}</span><span className="font-medium">{r.count}</span></button>);
                    })}
                  </div>
                )}
                {/* Thread count button */}
                {threadCounts && threadCounts[msg.id] > 0 && onOpenThread && (
                  <button
                    onClick={() => onOpenThread(msg.id, msg.author, msg.content, null)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mt-1 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="font-medium">{threadCounts[msg.id]} {t('thread.replies')}</span>
                  </button>
                )}
              </div>
              {editingId !== msg.id && !isMobileDevice && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                  {/* Reply button */}
                  <button onClick={() => { setReplyingTo(msg); inputRef.current?.focus(); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all" title={t('chat.reply')}>
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  {/* Thread button */}
                  {onOpenThread && (
                    <button onClick={() => onOpenThread(msg.id, msg.author, msg.content, null)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all" title={t('thread.startThread')}>
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onToggleReaction && (
                    <Popover>
                      <PopoverTrigger asChild><button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all" title={t('chat.addReaction')}><SmilePlus className="w-3.5 h-3.5" /></button></PopoverTrigger>
                      <PopoverContent className="w-auto p-2" side="top" align="end">
                        <div className="grid grid-cols-6 gap-1">
                          {EMOJI_LIST.map((emoji) => (<button key={emoji} onClick={() => onToggleReaction(msg.id, emoji)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary text-lg transition-colors">{emoji}</button>))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  {/* Pin/Unpin button - owner or permission */}
                  {(isOwner || userPermissions?.pin_messages) && onPinMessage && onUnpinMessage && (
                    <button
                      onClick={() => msg.isPinned ? onUnpinMessage(msg.id) : onPinMessage(msg.id)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                      title={msg.isPinned ? t('chat.unpin') : t('chat.pin')}
                    >
                      <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'text-primary' : ''}`} />
                    </button>
                  )}
                  {msg.userId === user?.id && onEditMessage && (<button onClick={() => startEdit(msg)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all" title={t('chat.editMessage')}><Pencil className="w-3.5 h-3.5" /></button>)}
                  {(msg.userId === user?.id || isOwner || userPermissions?.manage_messages) && onDeleteMessage && (<button onClick={() => onDeleteMessage(msg.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all" title={t('chat.deleteMessage')}><Trash2 className="w-3.5 h-3.5" /></button>)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Mobile Long-Press Context Menu */}
      <Sheet open={!!longPressMsg} onOpenChange={(open) => { if (!open) setLongPressMsg(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl px-2 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-sm text-muted-foreground">{t('chat.messageActions')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            {/* Quick reactions */}
            {onToggleReaction && longPressMsg && (
              <div className="flex justify-center gap-2 py-2 border-b border-border mb-1">
                {EMOJI_LIST.slice(0, 8).map((emoji) => (
                  <button key={emoji} onClick={() => { onToggleReaction(longPressMsg.id, emoji); setLongPressMsg(null); }} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary text-xl transition-colors">{emoji}</button>
                ))}
              </div>
            )}
            <button onClick={() => { if (longPressMsg) { setReplyingTo(longPressMsg); inputRef.current?.focus(); } setLongPressMsg(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
              <Reply className="w-5 h-5 text-muted-foreground" />
              {t('chat.reply')}
            </button>
            {onOpenThread && longPressMsg && (
              <button onClick={() => { onOpenThread(longPressMsg.id, longPressMsg.author, longPressMsg.content, null); setLongPressMsg(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                {t('thread.startThread')}
              </button>
            )}
            {(isOwner || userPermissions?.pin_messages) && onPinMessage && onUnpinMessage && longPressMsg && (
              <button onClick={() => { longPressMsg.isPinned ? onUnpinMessage(longPressMsg.id) : onPinMessage(longPressMsg.id); setLongPressMsg(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
                <Pin className={`w-5 h-5 ${longPressMsg.isPinned ? 'text-primary' : 'text-muted-foreground'}`} />
                {longPressMsg.isPinned ? t('chat.unpin') : t('chat.pin')}
              </button>
            )}
            {longPressMsg?.userId === user?.id && onEditMessage && (
              <button onClick={() => { if (longPressMsg) startEdit(longPressMsg); setLongPressMsg(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
                <Pencil className="w-5 h-5 text-muted-foreground" />
                {t('chat.editMessage')}
              </button>
            )}
            {longPressMsg && (longPressMsg.userId === user?.id || isOwner || userPermissions?.manage_messages) && onDeleteMessage && (
              <button onClick={() => { onDeleteMessage(longPressMsg.id); setLongPressMsg(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-5 h-5" />
                {t('chat.deleteMessage')}
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TypingIndicator typingUsers={typingUsers || []} t={t} />

      <FileUploadPreview files={pendingFiles} onRemove={handleRemoveFile} />

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-secondary/50 border-t border-border flex items-center gap-2">
          <CornerDownRight className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground">{t('chat.replyingTo')}</span>
          <span className="text-xs font-medium text-foreground truncate">{replyingTo.author}</span>
          <span className="text-xs text-muted-foreground truncate flex-1">{replyingTo.content}</span>
          <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Slow mode countdown */}
      {slowModeCountdown > 0 && (
        <div className="px-4 py-1.5 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs text-destructive font-medium">Yavaş mod: {formatCountdown(slowModeCountdown)} bekleyin</span>
        </div>
      )}

      <div className={`px-4 ${isMobileDevice ? 'pb-2' : 'pb-6'}`}>
        <div className="relative">
        {showSlashPopup && (
          <SlashCommandPopup
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashPopup(false)}
            isOwner={!!isOwner}
          />
        )}
        {showMentionPopup && members.length > 0 && (
          <MentionPopup
            query={mentionQuery}
            members={members}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentionPopup(false)}
            position={{ bottom: 60, left: 0 }}
           />
        )}
        {showEmojiAutocomplete && (
          <EmojiAutocompletePopup
            query={emojiAutocompleteQuery}
            serverEmojis={serverEmojis || []}
            onSelect={handleEmojiAutocompleteSelect}
            onClose={() => setShowEmojiAutocomplete(false)}
            position={{ bottom: 60, left: 0 }}
          />
        )}
        {isLocked && !isOwner ? (
          <div className="bg-secondary/50 rounded-xl flex items-center justify-center px-4 py-3 gap-2 text-muted-foreground">
            <Lock className="w-4 h-4" />
            <span className="text-sm">Bu kanal kilitli. Yalnızca sunucu sahibi mesaj gönderebilir.</span>
          </div>
        ) : isMobileDevice ? (
          /* ===== MOBILE INPUT BAR ===== */
          <div className="flex items-center gap-2">
            <Popover open={plusMenuOpen} onOpenChange={setPlusMenuOpen}>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1">
                  <PlusCircle className="w-6 h-6" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-48 p-1.5 bg-popover border-border">
                <button onClick={() => { handlePickFiles(); setPlusMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                  <ImagePlus className="w-4 h-4" /> Resim Ekle
                </button>
                <div className="w-full">
                  <GifPicker onGifSelect={(url: string) => { onSendMessage(url); setPlusMenuOpen(false); }}>
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <span className="text-xs font-bold opacity-70">GIF</span> GIF Gönder
                    </button>
                  </GifPicker>
                </div>
              </PopoverContent>
            </Popover>
            <input type="file" ref={fileInputRef} accept="*" multiple className="hidden" onChange={handleFileSelect} />

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === 'Enter' && !showMentionPopup && !showSlashPopup) handleSend(); }}
                placeholder={t('chat.mobileMessagePlaceholder') || 'Mesaj gönder...'}
                className="w-full bg-input rounded-2xl py-3 pl-4 pr-10 text-sm outline-none text-foreground placeholder:text-muted-foreground ring-1 ring-border focus:ring-primary/40 transition-all min-h-[44px]"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <EmojiPicker onEmojiSelect={(emoji) => setInput(prev => prev + emoji)} serverEmojis={serverEmojis} />
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() && pendingFiles.length === 0}
              className="shrink-0 p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <SendHorizontal className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* ===== DESKTOP INPUT BAR ===== */
          <div className="bg-input rounded-xl flex items-center px-4 gap-2 ring-1 ring-border focus-within:ring-primary/40 transition-all">
            <input type="file" ref={fileInputRef} accept="*" multiple className="hidden" onChange={handleFileSelect} />
            <button onClick={handlePickFiles} className="text-muted-foreground hover:text-foreground transition-colors"><PlusCircle className="w-5 h-5" /></button>
            <input ref={inputRef} type="text" value={input} onChange={handleInputChange} onKeyDown={(e) => { if (e.key === 'Enter' && !showMentionPopup && !showSlashPopup) handleSend(); }} placeholder={t('chat.messagePlaceholder', { channel: channelName })} className="flex-1 bg-transparent py-3 text-sm outline-none text-foreground placeholder:text-muted-foreground" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <button onClick={handlePickFiles} className="hover:text-foreground transition-colors"><ImagePlus className="w-5 h-5" /></button>
              <GifPicker onGifSelect={(url: string) => { onSendMessage(url); }}><button className="hover:text-foreground transition-colors text-xs font-bold">GIF</button></GifPicker>
              <EmojiPicker onEmojiSelect={(emoji) => setInput(prev => prev + emoji)} serverEmojis={serverEmojis} />
              {(input.trim() || pendingFiles.length > 0) && (<button onClick={handleSend} className="text-primary hover:text-primary/80 transition-colors"><Send className="w-5 h-5" /></button>)}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
