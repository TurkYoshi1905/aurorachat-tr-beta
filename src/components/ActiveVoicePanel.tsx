import { PhoneOff, Mic, MicOff, Headphones, HeadphoneOff, Users } from 'lucide-react';
import type { VoiceState } from '@/hooks/useVoice';
import { useTranslation } from '@/i18n';

interface ActiveVoicePanelProps {
  voiceState: VoiceState;
}

const ActiveVoicePanel = ({ voiceState }: ActiveVoicePanelProps) => {
  const { voiceChannelName, participants, micMuted, deafened, toggleMic, toggleDeafen, disconnect } = voiceState;
  const { t } = useTranslation();

  return (
    <div className="w-60 bg-sidebar flex flex-col border-l border-border/60 shrink-0">
      <div className="h-12 flex items-center px-3 border-b border-border/60 shrink-0 gap-2">
        <Users className="w-4 h-4 text-status-online shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-status-online leading-none truncate">{t('voice.voiceChannel')}</p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">#{voiceChannelName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {participants.map((p) => (
          <div
            key={p.identity}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-secondary/40 transition-colors"
          >
            <div className="relative shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold overflow-hidden transition-all duration-200 ${
                  p.isSpeaking
                    ? 'ring-2 ring-status-online ring-offset-2 ring-offset-sidebar shadow-[0_0_8px_rgba(var(--status-online-rgb,34,197,94),0.6)]'
                    : ''
                }`}
              >
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-foreground text-[13px] font-bold">
                      {p.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {p.isSpeaking && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-status-online border-2 border-sidebar animate-pulse" />
              )}
            </div>
            <span
              className={`flex-1 text-[13px] font-medium truncate transition-colors ${
                p.isSpeaking ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {p.displayName}
            </span>
            {p.micMuted ? (
              <MicOff className="w-3.5 h-3.5 text-destructive shrink-0" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
            )}
          </div>
        ))}
        {participants.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-4">{t('voice.noParticipants')}</p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border/60 shrink-0">
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={toggleMic}
            data-testid="button-voice-panel-mic"
            title={micMuted ? t('voice.unmuteMic') : t('voice.muteMic')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs flex-1 justify-center transition-colors ${
              micMuted
                ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{micMuted ? t('voice.mutedLabel') : t('voice.micLabel')}</span>
          </button>
          <button
            onClick={toggleDeafen}
            data-testid="button-voice-panel-deafen"
            title={deafened ? t('voice.undeafen') : t('voice.deafen')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs flex-1 justify-center transition-colors ${
              deafened
                ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {deafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{deafened ? t('voice.deafenedLabel') : t('voice.headphones')}</span>
          </button>
          <button
            onClick={disconnect}
            data-testid="button-voice-panel-disconnect"
            title={t('voice.leaveChannel')}
            className="w-8 h-8 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/15 transition-colors shrink-0"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveVoicePanel;
