import { useState, useEffect } from 'react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

interface VoiceState {
  connected: boolean;
  connecting: boolean;
  voiceChannelId: string | null;
  voiceChannelName: string;
  participants: { identity: string; displayName: string; avatarUrl?: string | null; isSpeaking: boolean; micMuted?: boolean }[];
  micMuted: boolean;
  deafened: boolean;
  joinVoice: (channelId: string, channelName: string, serverId?: string | null) => void;
  disconnect: () => void;
  toggleMic: () => void;
  toggleDeafen: () => void;
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

const ChannelList = ({ serverName, serverId, serverIcon, channels, categories = [], activeChannel, onChannelChange, currentUserStatus = 'offline', onStatusChange, isOwner, onChannelCreated, onServerDeleted, onServerUpdated, onLeaveServer, isMobile, voiceState, userPermissions, unreadChannels }: ChannelListProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelDialogType, setChannelDialogType] = useState<'text' | 'voice'>('text');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [voiceMembers, setVoiceMembers] = useState<Record<string, { user_id: string; display_name: string; avatar_url: string | null; mic_muted: boolean }[]>>({});

  useEffect(() => {
    if (!serverId) return;

    const fetchVoiceMembers = async () => {
      const { data } = await (supabase as any)
        .from('voice_channel_members')
        .select('channel_id, user_id, display_name, avatar_url, mic_muted')
        .eq('server_id', serverId);
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

    const channel = supabase
      .channel(`voice-members-${serverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_channel_members', filter: `server_id=eq.${serverId}` }, () => {
        fetchVoiceMembers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [serverId]);

  const openCreateChannel = (type: 'text' | 'voice') => { setChannelDialogType(type); setChannelDialogOpen(true); };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Group channels by category
  const uncategorizedChannels = channels.filter(c => !c.category_id);
  const textUncategorized = uncategorizedChannels.filter(c => c.type === 'text');
  const voiceUncategorized = uncategorizedChannels.filter(c => c.type === 'voice');

  const renderChannel = (channel: DbChannel) => {
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
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full z-10" />
        )}
        <button
          data-testid={`channel-button-${channel.id}`}
          onClick={() => isVoice ? voiceState?.joinVoice?.(channel.id, channel.name, serverId) : onChannelChange(channel.id)}
          className={`w-full flex items-center gap-1.5 pl-3 pr-2 py-[7px] rounded-md text-sm transition-all duration-100 group ${
            isActive
              ? 'bg-secondary/80 text-foreground'
              : hasUnread
              ? 'text-foreground hover:bg-secondary/40'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
          } ${isVoiceActive ? 'text-status-online' : ''}`}
        >
          <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'opacity-90' : hasUnread ? 'opacity-90' : 'opacity-60 group-hover:opacity-80'} ${isVoiceActive ? 'text-status-online' : ''}`} />
          <span className={`truncate font-medium text-[14px] ${hasUnread ? 'font-semibold' : ''}`}>{channel.name}</span>
          {hasUnread && (
            <span className="ml-auto w-2 h-2 rounded-full bg-white shrink-0" />
          )}
          {voiceState?.connecting && isVoiceActive && (
            <span className="ml-auto text-[10px] text-muted-foreground animate-pulse">...</span>
          )}
        </button>
        {isVoice && (() => {
          if (voiceState?.voiceChannelId === channel.id && voiceState.participants.length > 0) {
            return <VoiceParticipants participants={voiceState.participants} />;
          }
          const dbParts = voiceMembers[channel.id];
          if (dbParts && dbParts.length > 0) {
            return <VoiceParticipants participants={dbParts.map(p => ({
              identity: p.user_id,
              displayName: p.display_name,
              avatarUrl: p.avatar_url,
              isSpeaking: false,
              micMuted: p.mic_muted,
            }))} />;
          }
          return null;
        })()}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
    <div className={`${isMobile ? 'flex-1 h-full' : 'w-60'} bg-sidebar flex flex-col`}>
      {/* Server Header - Discord style */}
      <div className="h-12 flex items-center px-3 border-b border-border/60 shadow-sm cursor-pointer hover:bg-secondary/40 transition-colors group justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {serverIcon && (serverIcon.startsWith('http') || serverIcon.startsWith('/')) ? (
            <img src={serverIcon} alt={serverName} className="w-5 h-5 rounded-full object-cover shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
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
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
        {/* Uncategorized channels */}
        {textUncategorized.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center justify-between px-1 mt-4 mb-0.5 group/cat">
              <button className="flex items-center gap-1 min-w-0" onClick={() => {}}>
                <ChevronDown className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover/cat:text-foreground transition-colors truncate">{t('channels.textChannels')}</p>
              </button>
              {(isOwner || userPermissions?.manage_channels || userPermissions?.administrator) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => openCreateChannel('text')} className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/cat:opacity-100 shrink-0 p-0.5 rounded hover:bg-secondary/60">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>{t('channels.createChannel') || 'Kanal Oluştur'}</p></TooltipContent>
                </Tooltip>
              )}
            </div>
            {textUncategorized.map(renderChannel)}
          </div>
        )}

        {voiceUncategorized.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center justify-between px-1 mt-4 mb-0.5 group/cat">
              <button className="flex items-center gap-1 min-w-0" onClick={() => {}}>
                <ChevronDown className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover/cat:text-foreground transition-colors truncate">{t('channels.voiceChannels')}</p>
              </button>
              {(isOwner || userPermissions?.manage_channels || userPermissions?.administrator) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => openCreateChannel('voice')} className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/cat:opacity-100 shrink-0 p-0.5 rounded hover:bg-secondary/60">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>{t('channels.createChannel') || 'Kanal Oluştur'}</p></TooltipContent>
                </Tooltip>
              )}
            </div>
            {voiceUncategorized.map(renderChannel)}
          </div>
        )}

        {/* Categorized channels */}
        {categories.map(cat => {
          const catChannels = channels.filter(c => c.category_id === cat.id);
          if (catChannels.length === 0) return null;
          const isCollapsed = collapsedCategories.has(cat.id);

          return (
            <div key={cat.id} className="mb-1">
              <div className="flex items-center justify-between px-1 mt-4 mb-0.5 group/cat">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="flex items-center gap-1 min-w-0"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                  )}
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover/cat:text-foreground transition-colors truncate">
                    {cat.name}
                  </p>
                </button>
                {(isOwner || userPermissions?.manage_channels || userPermissions?.administrator) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => openCreateChannel('text')} className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/cat:opacity-100 shrink-0 p-0.5 rounded hover:bg-secondary/60">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right"><p>{t('channels.createChannel') || 'Kanal Oluştur'}</p></TooltipContent>
                  </Tooltip>
                )}
              </div>
              {!isCollapsed && <div>{catChannels.map(renderChannel)}</div>}
            </div>
          );
        })}

        {/* If no channels at all */}
        {channels.length === 0 && categories.length === 0 && (
          <div className="mb-1">
            <div className="flex items-center justify-between px-1 mt-4 mb-0.5 group/cat">
              <button className="flex items-center gap-1 min-w-0" onClick={() => {}}>
                <ChevronDown className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{t('channels.textChannels')}</p>
              </button>
              {(isOwner || userPermissions?.manage_channels || userPermissions?.administrator) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => openCreateChannel('text')} className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/cat:opacity-100 shrink-0 p-0.5 rounded hover:bg-secondary/60">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>{t('channels.createChannel') || 'Kanal Oluştur'}</p></TooltipContent>
                </Tooltip>
              )}
            </div>
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
          connectionQuality={voiceState.connectionQuality}
        />
      )}

      <UserInfoPanel currentUserStatus={currentUserStatus} onStatusChange={onStatusChange} isOwner={isOwner} />

      {(isOwner || userPermissions?.manage_channels || userPermissions?.administrator) && (
        <CreateChannelDialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen} serverId={serverId} defaultType={channelDialogType} existingCount={channels.length} onChannelCreated={() => onChannelCreated?.()} />
      )}
      <InviteDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} serverId={serverId} serverName={serverName} />
    </div>
    </TooltipProvider>
  );
};

export default ChannelList;
