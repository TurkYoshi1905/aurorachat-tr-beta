import { Camera, Mic, MicOff, MonitorUp } from 'lucide-react';

interface Participant {
  identity: string;
  displayName: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  micMuted?: boolean;
  cameraEnabled?: boolean;
  screenSharing?: boolean;
}

interface VoiceParticipantsProps {
  participants: Participant[];
}

const VoiceParticipants = ({ participants }: VoiceParticipantsProps) => {
  return (
    <div className="pl-7 space-y-1 py-1">
      {participants.map((p) => (
        <div key={p.identity} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg group/vp bg-secondary/20 min-w-0">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold overflow-hidden shrink-0 transition-all ${
              p.isSpeaking
                ? 'ring-2 ring-status-online ring-offset-1 ring-offset-sidebar'
                : 'bg-secondary'
            }`}
          >
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-foreground">{p.displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span
            className={`text-[12px] flex-1 truncate ${
              p.isSpeaking ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}
          >
            {p.displayName}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {p.micMuted ? (
              <MicOff className="w-3 h-3 text-destructive" />
            ) : (
              <Mic className="w-3 h-3 text-status-online/70" />
            )}
            {p.cameraEnabled && <Camera className="w-3 h-3 text-blue-400" />}
            {p.screenSharing && <MonitorUp className="w-3 h-3 text-status-online" />}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VoiceParticipants;
