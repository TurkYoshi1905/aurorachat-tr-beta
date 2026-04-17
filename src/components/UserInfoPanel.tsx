import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Headphones, HeadphoneOff, Settings, Circle, Moon, MinusCircle, EyeOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n';
import { DbMember } from '@/types/chat';

interface UserInfoPanelProps {
  currentUserStatus?: DbMember['status'];
  onStatusChange?: (status: DbMember['status']) => void;
  isOwner?: boolean;
}

const statusColors: Record<string, string> = {
  online: 'bg-status-online',
  idle: 'bg-status-idle',
  dnd: 'bg-status-dnd',
  offline: 'bg-muted-foreground',
};

const UserInfoPanel = ({ currentUserStatus = 'offline', onStatusChange }: UserInfoPanelProps) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [statusOpen, setStatusOpen] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  const statusOptions: { value: DbMember['status']; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'online', label: t('status.online'), icon: <Circle className="w-3 h-3 text-status-online fill-status-online" />, desc: '' },
    { value: 'idle', label: t('status.idle'), icon: <Moon className="w-3 h-3 text-status-idle fill-status-idle" />, desc: '' },
    { value: 'dnd', label: t('status.dnd'), icon: <MinusCircle className="w-3 h-3 text-status-dnd fill-status-dnd" />, desc: t('status.dndDesc') },
    { value: 'offline', label: t('status.invisible'), icon: <EyeOff className="w-3 h-3 text-muted-foreground" />, desc: t('status.invisibleDesc') },
  ];

  const handleToggleMic = () => {
    if (deafened) return;
    setMicMuted(prev => !prev);
  };

  const handleToggleDeafen = () => {
    setDeafened(prev => {
      const next = !prev;
      if (next) setMicMuted(true);
      else setMicMuted(false);
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={500}>
      <div
        className="h-[52px] flex items-center px-2 gap-0 shrink-0 select-none"
        style={{ background: 'hsl(var(--server-bg))' }}
      >
        {/* Avatar + Name block */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <button
              data-testid="user-avatar-button"
              className="flex items-center gap-2 min-w-0 flex-1 h-full px-1 rounded-md hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer text-left"
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (profile?.display_name?.charAt(0)?.toUpperCase() ?? '?')}
                </div>
                {currentUserStatus === 'idle' ? (
                  <div className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full bg-[hsl(var(--server-bg))] flex items-center justify-center">
                    <Moon className="w-2.5 h-2.5 text-status-idle fill-status-idle" />
                  </div>
                ) : (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-[2.5px] border-[hsl(var(--server-bg))] ${statusColors[currentUserStatus]}`} />
                )}
              </div>

              {/* Name + username */}
              <div className="min-w-0 flex flex-col justify-center leading-none gap-[3px]">
                <span
                  data-testid="user-display-name"
                  className="text-[13px] font-semibold text-foreground truncate leading-none"
                >
                  {profile?.display_name || t('common.user')}
                </span>
                <span
                  data-testid="user-username"
                  className="text-[11px] font-medium text-muted-foreground truncate leading-none"
                >
                  {profile?.username || 'user'}
                </span>
              </div>
            </button>
          </PopoverTrigger>

          <PopoverContent side="top" align="start" sideOffset={6} className="w-52 p-1.5 bg-popover border-border shadow-lg">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-2 pt-1 pb-1.5">
              {t('status.setStatus')}
            </p>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onStatusChange?.(opt.value); setStatusOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                  currentUserStatus === opt.value
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
              >
                {opt.icon}
                <div className="text-left">
                  <span className="block text-[13px] font-medium">{opt.label}</span>
                  {opt.desc && <span className="block text-[11px] text-muted-foreground mt-0.5">{opt.desc}</span>}
                </div>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Control buttons */}
        <div className="flex items-center shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="button-toggle-mic"
                onClick={handleToggleMic}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                  micMuted
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                }`}
              >
                {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              <p className="text-xs">{micMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="button-toggle-deafen"
                onClick={handleToggleDeafen}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                  deafened
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                }`}
              >
                {deafened ? <HeadphoneOff className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              <p className="text-xs">{deafened ? 'Sesi Aç' : 'Sesi Kapat'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="button-settings"
                onClick={() => navigate('/settings')}
                className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              <p className="text-xs">Kullanıcı Ayarları</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default UserInfoPanel;
