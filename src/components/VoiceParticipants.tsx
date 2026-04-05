import { Mic, MicOff } from 'lucide-react';

interface Participant {
  identity: string;
  displayName: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  micMuted?: boolean;
}

interface VoiceParticipantsProps {
  participants: Participant[];
}

const VoiceParticipants = ({ participants }: VoiceParticipantsProps) => {
  return (
    <div className="pl-7 space-y-0.5 py-0.5">
      {participants.map((p) => (
        <div key={p.identity} className="flex items-center gap-1.5 px-2 py-[3px] rounded-md group/vp">
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
          {p.micMuted ? (
            <MicOff className="w-3 h-3 text-destructive shrink-0" />
          ) : (
            <Mic className="w-3 h-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover/vp:opacity-100 transition-opacity" />
          )}
        </div>
      ))}
    </div>
  );
};

export default VoiceParticipants;
