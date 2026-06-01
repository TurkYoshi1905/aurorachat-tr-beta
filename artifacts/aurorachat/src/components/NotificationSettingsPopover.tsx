import { useState } from 'react';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';

interface NotificationSettingsPopoverProps {
  channelId: string;
  serverId: string;
}

const NotificationSettingsPopover = ({ channelId, serverId }: NotificationSettingsPopoverProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifyLevel, setNotifyLevel] = useState<'all' | 'mentions' | 'none'>('all');
  const [suppressEveryone, setSuppressEveryone] = useState(false);
  const [muteUntil, setMuteUntil] = useState<string | null>(null);

  const MUTE_DURATIONS = [
    { label: t('notifications.min15'), value: 15 },
    { label: t('notifications.hour1'), value: 60 },
    { label: t('notifications.hour8'), value: 480 },
    { label: t('notifications.hour24'), value: 1440 },
    { label: t('notifications.forever'), value: -1 },
  ];

  const isMuted = muteUntil ? (muteUntil === 'forever' || new Date(muteUntil) > new Date()) : false;

  const handleLevelChange = (level: 'all' | 'mentions' | 'none') => {
    setNotifyLevel(level);
    localStorage.setItem(`notif_level_${channelId}`, level);
    toast.success(t('notifications.updated'));
  };

  const handleSuppressToggle = (value: boolean) => {
    setSuppressEveryone(value);
    localStorage.setItem(`notif_suppress_${channelId}`, String(value));
  };

  const handleMute = (minutes: number) => {
    let muteVal: string;
    if (minutes === -1) {
      muteVal = '2099-12-31T23:59:59Z';
    } else {
      muteVal = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }
    setMuteUntil(muteVal);
    localStorage.setItem(`notif_mute_${channelId}`, muteVal);
    toast.success(t('notifications.muted'));
  };

  const handleUnmute = () => {
    setMuteUntil(null);
    localStorage.removeItem(`notif_mute_${channelId}`);
    toast.success(t('notifications.unmuted'));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`hover:text-foreground transition-colors ${isMuted ? 'text-destructive' : ''}`}>
          {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 p-0">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">{t('notifications.title')}</h3>
        </div>

        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t('notifications.level')}</p>
            {[
              { value: 'all' as const, label: t('notifications.allMessages'), icon: Volume2 },
              { value: 'mentions' as const, label: t('notifications.mentionsOnly'), icon: Bell },
              { value: 'none' as const, label: t('notifications.noneLevel'), icon: VolumeX },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleLevelChange(opt.value)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors ${notifyLevel === opt.value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-secondary/80'}`}
              >
                <opt.icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground">{t('notifications.suppressEveryone')}</span>
            <Switch checked={suppressEveryone} onCheckedChange={handleSuppressToggle} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t('notifications.muteChannel')}</p>
            {isMuted ? (
              <Button size="sm" variant="outline" onClick={handleUnmute} className="w-full h-7 text-xs">
                <Bell className="w-3 h-3 mr-1" /> {t('notifications.unmute')}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-1">
                {MUTE_DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => handleMute(d.value)}
                    className="px-2 py-1 rounded text-[10px] bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationSettingsPopover;
