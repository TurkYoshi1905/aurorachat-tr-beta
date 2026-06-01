import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DbChannel, DbMember, DbCategory } from '@/types/chat';
import { Hash, Volume2, Settings, Plus, UserPlus, LogOut, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import CreateChannelDialog from '@/components/CreateChannelDialog';
import InviteDialog from '@/components/InviteDialog';
import { useTranslation } from '@/i18n';
import UserInfoPanel from '@/components/UserInfoPanel';
import VoicePanel from '@/components/VoicePanel';
import VoiceParticipants from '@/components/VoiceParticipants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VoiceState {
  connected: boolean;
  connecting: boolean;
  voiceChannelId: string | null;
  voiceChannelName: string;
  participants: { identity: string; displayName: string; avatarUrl?: string | null; isSpeaking: boolean; micMuted?: boolean; cameraEnabled?: boolean; screenSharing?: boolean }[];
  micMuted: boolean;
  deafened: boolean;
  joinVoice: (channelId: string, channelName: string, serverId?: string | null) => void;
  disconnect: () => void;
  toggleMic: () => void;
  toggleDeafen: () => void;
  connectionQuality?: number;
}

interface ChannelListProps {
  serverName: string; serverId: string; serverIcon: string; channels: DbChannel[];
  categories?: DbCategory[];
  activeChannel: string; onChannelChange: (id: string) => void;
  currentUserStatus?: DbMember['status']; onStatusChange?: (status: DbMember['status']) => void;
  isOwner?: boolean; onChannelCreated?: () => void; onServerDeleted?: () => void;
  onServerUpdated?: () => void; onLeaveServer?: () => void; isMobile?: boolean;
  voiceState?: VoiceState;
  userPermissions?: Record<string, boolean>;
  unreadChannels?: Set<string>;
}

// Discord-style sortable channel row: whole row is drag handle, no visible grip dots
// Green drop-indicator line appears above the target item
interface SortableChannelRowProps {
  id: string;
  isOver: boolean;
  canDrag: boolean;
  children: React.ReactNode;
}

const SortableChannelRow = ({ id, isOver, canDrag, children }: SortableChannelRowProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id, disabled: !canDrag });
  return (
    <div
      ref={setNodeRef}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      className="relative outline-none select-none"
      style={{ cursor: canDrag ? 'grab' : undefined }}
    >
      {/* Green line drop indicator — shown above this item when it's the drop target */}
      {isOver && canDrag && (
        <div
          className="absolute -top-px left-1 right-1 h-[2px] bg-primary rounded-full z-50 pointer-events-none"
          style={{ boxShadow: '0 0 8px 1px hsl(var(--primary) / 0.55)' }}
        />
      )}
      {/* Hide source item while dragging (DragOverlay shows it) */}
      <div className={isDragging ? 'opacity-0 pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );
};

const ChannelList = ({
  serverName, serverId, serverIcon, channels, categories = [], activeChannel,
  onChannelChange, currentUserStatus = 'offline', onStatusChange, isOwner,
  onChannelCreated, onServerDeleted, onServerUpdated, onLeaveServer, isMobile,
  voiceState, userPermissions, unreadChannels,
}: ChannelListProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelDialogType, setChannelDialogType] = useState<'text' | 'voice'>('text');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [voiceMembers, setVoiceMembers] = useState<Record<string, any[]>>({});
  const [localChannels, setLocalChannels] = useState<DbChannel[]>([]);

  // Drag state: which item is being dragged, which item is the current over target
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const canManageChannels = !!(isOwner || userPermissions?.manage_channels || userPermissions?.administrator);
  const canDrag = canManageChannels && !isMobile;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    setLocalChannels(
      [...channels].sort((a, b) => ((a as any).position ?? 999) - ((b as any).position ?? 999))
    );
  }, [channels]);

  // Voice members realtime
  useEffect(() => {
    if (!serverId) return;
    const fetchVoiceMembers = async () => {
      try { await (supabase as any).rpc('cleanup_stale_voice_members'); } catch { }
      let { data, error } = await (supabase as any)
        .from('voice_channel_members')
        .select('channel_id, user_id, display_name, avatar_url, mic_muted, camera_enabled, screen_sharing')
        .eq('server_id', serverId);
      if (error) {
        const fallback = await (supabase as any)
          .from('voice_channel_members')
          .select('channel_id, user_id, display_name, avatar_url, mic_muted')
          .eq('server_id', serverId);
        data = fallback.data;
      }
      if (data) {
        const grouped: Record<string, any[]> = {};
        for (const row of data) {
          if (!grouped[row.channel_id]) grouped[row.channel_id] = [];
          grouped[row.channel_id].push(row);
        }
        setVoiceMembers(grouped);
      }
    };
    fetchVoiceMembers();
    const ch = supabase.channel(`voice-members-${serverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_channel_members', filter: `server_id=eq.${serverId}` }, fetchVoiceMembers)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [serverId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent, groupChannels: DbChannel[]) => {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupChannels.findIndex(c => c.id === active.id);
    const newIndex = groupChannels.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newGroup = arrayMove(groupChannels, oldIndex, newIndex);
    const groupIds = new Set(groupChannels.map(c => c.id));
    setLocalChannels(prev => [...prev.filter(c => !groupIds.has(c.id)), ...newGroup]);
    await Promise.all(newGroup.map((ch, idx) =>
      (supabase as any).from('channels').update({ position: idx }).eq('id', ch.id)
    ));
  }, []);

  const openCreateChannel = (type: 'text' | 'voice') => {
    setChannelDialogType(type);
    setChannelDialogOpen(true);
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const renderChannelButton = (channel: DbChannel) => {
    const isVoice = channel.type === 'voice';
    const Icon = isVoice ? Volume2 : Hash;
    const isVoiceActive = voiceState?.voiceChannelId === channel.id;
    const isActive = activeChannel === channel.id;
    const hasUnread = !isActive && !isVoice && unreadChannels?.has(channel.id);

    return (
      <div key={channel.id} className="relative">
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-foreground rounded-r-full z-10" />
        )}
        {hasUnread && !isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-foreground/50 rounded-r-full z-10" />
        )}
        <button
          onClick={() => isVoice
            ? voiceState?.joinVoice?.(channel.id, channel.name, serverId)
            : onChannelChange(channel.id)
          }
          className={`w-full flex items-center gap-1.5 pl-3 pr-2 py-[6px] rounded-md text-sm transition-all duration-100 group ${
            isActive
              ? 'bg-secondary/80 text-foreground'
              : hasUnread
              ? 'text-foreground hover:bg-secondary/40'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
          } ${isVoiceActive ? 'text-status-online' : ''}`}
        >
          <Icon className={`w-[18px] h-[18px] shrink-0 ${
            isActive ? 'opacity-90' : hasUnread ? 'opacity-90' : 'opacity-60 group-hover:opacity-80'
          } ${isVoiceActive ? 'text-status-online' : ''}`} />
          <span className={`truncate text-[13.5px] ${isActive ? 'font-semibold' : hasUnread ? 'font-semibold' : 'font-medium'}`}>
            {channel.name}
          </span>
          {hasUnread && <span className="ml-auto w-2 h-2 rounded-full bg-foreground shrink-0" />}
        </button>
        {isVoice && (() => {
          if (voiceState?.voiceChannelId === channel.id && (voiceState.participants?.length ?? 0) > 0) {
            return <VoiceParticipants participants={voiceState.participants} />;
          }
          const dbParts = voiceMembers[channel.id];
          if (dbParts?.length > 0) {
            return <VoiceParticipants participants={dbParts.map(p => ({
              identity: p.user_id, displayName: p.display_name, avatarUrl: p.avatar_url,
              isSpeaking: false, micMuted: p.mic_muted, cameraEnabled: !!p.camera_enabled, screenSharing: !!p.screen_sharing,
            }))} />;
          }
          return null;
        })()}
      </div>
    );
  };

  // Renders a sortable group of channels with Discord-style DnD
  const renderGroup = (groupChannels: DbChannel[], groupKey: string) => {
    if (!canDrag || groupChannels.length <= 1) {
      return groupChannels.map(ch => renderChannelButton(ch));
    }
    return (
      <DndContext
        key={groupKey}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => { setActiveId(String(e.active.id)); setOverId(null); }}
        onDragOver={(e) => { setOverId(e.over ? String(e.over.id) : null); }}
        onDragEnd={(e) => handleDragEnd(e, groupChannels)}
        onDragCancel={() => { setActiveId(null); setOverId(null); }}
      >
        <SortableContext items={groupChannels.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {groupChannels.map(ch => (
            <SortableChannelRow
              key={ch.id}
              id={ch.id}
              isOver={overId === ch.id && activeId !== ch.id}
              canDrag={canDrag}
            >
              {renderChannelButton(ch)}
            </SortableChannelRow>
          ))}
        </SortableContext>
        {/* Ghost overlay following cursor while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="flex items-center gap-1.5 pl-3 pr-2 py-[6px] rounded-md bg-secondary/90 border border-primary/30 shadow-xl text-foreground text-[13.5px] font-semibold opacity-90 backdrop-blur-sm">
              <Hash className="w-[18px] h-[18px] shrink-0 opacity-70" />
              {localChannels.find(c => c.id === activeId)?.name ?? ''}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  const uncategorized = localChannels.filter(c => !c.category_id);
  const textUncategorized = uncategorized.filter(c => c.type === 'text');
  const voiceUncategorized = uncategorized.filter(c => c.type === 'voice');

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`${isMobile ? 'flex-1 h-full' : 'w-60'} bg-sidebar flex flex-col`}>

        {/* Server header */}
        <div className="h-12 flex items-center px-3 border-b border-border/60 shadow-sm shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {serverIcon && (serverIcon.startsWith('http') || serverIcon.startsWith('/')) ? (
              <img src={serverIcon} alt={serverName} className="w-5 h-5 rounded-full object-cover shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : null}
            <span className="font-semibold text-[15px] text-foreground truncate leading-tight">{serverName}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isOwner && !userPermissions?.manage_server && !userPermissions?.administrator && onLeaveServer && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onLeaveServer(); }}
                    className="w-7 h-7 flex items-center justify-center rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{t('server.leaveServer')}</p></TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); setInviteDialogOpen(true); }}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{t('server.createInvite')}</p></TooltipContent>
            </Tooltip>
            {(isOwner || userPermissions?.manage_server || userPermissions?.administrator) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/server-settings/${serverId}`); }}
                    className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{t('server.serverSettings')}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-0.5">

          {/* Uncategorized text channels */}
          {textUncategorized.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center justify-between px-1 mt-3 mb-0.5 group/cat">
                <div className="flex items-center gap-1 min-w-0">
                  <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover/cat:text-foreground transition-colors truncate">
                    {t('channels.textChannels')}
                  </p>
                </div>
                {canManageChannels && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => openCreateChannel('text')}
                        className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/cat:opacity-100 shrink-0 p-0.5 rounded hover:bg-secondary/60">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right"><p>{t('channels.createChannel') || 'Kanal Oluştur'}</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
              {renderGroup(textUncategorized, 'text-uncategorized')}
            </div>
          )}

          {/* Uncategorized voice channels */}
          {voiceUncategorized.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center justify-between px-1 mt-3 mb-0.5 group/cat">
                <div className="flex items-center gap-1 min-w-0">
                  <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover/cat:text-foreground transition-colors truncate">
                    {t('channels.voiceChannels')}
                  </p>
                </div>
                {canManageChannels && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => openCreateChannel('voice')}
                        className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/cat:opacity-100 shrink-0 p-0.5 rounded hover:bg-secondary/60">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right"><p>{t('channels.createChannel') || 'Kanal Oluştur'}</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
              {renderGroup(voiceUncategorized, 'voice-uncategorized')}
            </div>
          )}

          {/* Categorized channels */}
          {categories.map(cat => {
            const catChannels = localChannels.filter(c => c.category_id === cat.id);
            if (catChannels.length === 0 && !canManageChannels) return null;
            const isCollapsed = collapsedCategories.has(cat.id);
            return (
              <div key={cat.id} className="mb-1">
                <div className="flex items-center justify-between px-1 mt-3 mb-0.5 group/cat">
                  <button onClick={() => toggleCategory(cat.id)} className="flex items-center gap-1 min-w-0">
                    {isCollapsed
                      ? <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      : <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    }
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover/cat:text-foreground transition-colors truncate">
                      {cat.name}
                    </p>
                  </button>
                  {canManageChannels && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => openCreateChannel('text')}
                          className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/cat:opacity-100 shrink-0 p-0.5 rounded hover:bg-secondary/60">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right"><p>{t('channels.createChannel') || 'Kanal Oluştur'}</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {!isCollapsed && renderGroup(catChannels, `cat-${cat.id}`)}
              </div>
            );
          })}

          {/* Empty state */}
          {channels.length === 0 && categories.length === 0 && (
            <div className="flex items-center justify-between px-1 mt-3 mb-0.5 group/cat">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                {t('channels.textChannels')}
              </p>
              {canManageChannels && (
                <button onClick={() => openCreateChannel('text')}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5 rounded">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Voice panel */}
        {voiceState?.connected && (
          <VoicePanel
            channelName={voiceState.voiceChannelName}
            onDisconnect={voiceState.disconnect}
            micMuted={voiceState.micMuted}
            deafened={voiceState.deafened}
            onToggleMic={voiceState.toggleMic}
            onToggleDeafen={voiceState.toggleDeafen}
            connectionQuality={(voiceState as any).connectionQuality}
          />
        )}

        <UserInfoPanel currentUserStatus={currentUserStatus} onStatusChange={onStatusChange} isOwner={isOwner} />

        {canManageChannels && (
          <CreateChannelDialog
            open={channelDialogOpen}
            onOpenChange={setChannelDialogOpen}
            serverId={serverId}
            defaultType={channelDialogType}
            existingCount={channels.length}
            onChannelCreated={() => onChannelCreated?.()}
          />
        )}
        <InviteDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} serverId={serverId} serverName={serverName} />
      </div>
    </TooltipProvider>
  );
};

export default ChannelList;
