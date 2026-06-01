import { PhoneOff, Mic, MicOff, Headphones, HeadphoneOff, SignalLow, SignalMedium, SignalHigh, Signal } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface VoicePanelProps {
  channelName: string;
  onDisconnect: () => void;
  micMuted: boolean;
  deafened: boolean;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'unknown';
}

const SignalIcon = ({ quality }: { quality?: string }) => {
  const color = '#23a559';
  const cls = 'w-3.5 h-3.5 shrink-0';
  if (quality === 'excellent') return <SignalHigh className={cls} style={{ color }} />;
  if (quality === 'good')      return <SignalMedium className={cls} style={{ color }} />;
  if (quality === 'poor')      return <SignalLow className={cls} style={{ color: '#f0b132' }} />;
  return <Signal className={cls} style={{ color }} />;
};

const VoicePanel = ({ channelName, onDisconnect, micMuted, deafened, onToggleMic, onToggleDeafen, connectionQuality }: VoicePanelProps) => {
  const { t } = useTranslation();

  const qualityLabel =
    connectionQuality === 'excellent' ? 'Mükemmel' :
    connectionQuality === 'good'      ? 'İyi' :
    connectionQuality === 'poor'      ? 'Zayıf' :
    t('voice.connected');

  return (
    <div className="px-3 pt-2 pb-1 border-t border-border/60 bg-sidebar/80 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <SignalIcon quality={connectionQuality} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-status-online leading-none">{qualityLabel}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">#{channelName}</p>
        </div>
        <button
          onClick={onDisconnect}
          title={t('voice.disconnect')}
          data-testid="button-voice-disconnect"
          className="w-6 h-6 flex items-center justify-center rounded text-destructive hover:bg-destructive/15 transition-colors shrink-0"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMic}
          title={micMuted ? t('voice.unmuteMic') : t('voice.muteMic')}
          data-testid="button-voice-mic"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
            micMuted
              ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span className="text-[11px]">{micMuted ? t('voice.mutedLabel') : t('voice.micLabel')}</span>
        </button>
        <button
          onClick={onToggleDeafen}
          title={deafened ? t('voice.undeafen') : t('voice.deafen')}
          data-testid="button-voice-deafen"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
            deafened
              ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          {deafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
          <span className="text-[11px]">{deafened ? t('voice.deafenedLabel') : t('voice.headphones')}</span>
        </button>
      </div>
    </div>
  );
};

export default VoicePanel;
