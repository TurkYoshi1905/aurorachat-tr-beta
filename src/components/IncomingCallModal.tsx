import { useEffect, useRef } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface IncomingCallModalProps {
  callerName: string;
  callerAvatar: string | null;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal = ({ callerName, callerAvatar, onAccept, onReject }: IncomingCallModalProps) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onReject();
    }, 30000);
    return () => clearTimeout(timer);
  }, [onReject]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 bg-[#1e1f22] border border-[#3f4147] rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 min-w-[300px] max-w-[360px] w-full mx-4">
        <div className="text-sm text-[#b5bac1] font-medium tracking-wide uppercase">Gelen Sesli Arama</div>

        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping bg-[#3ba55d]/30 scale-110" />
          <div className="absolute inset-0 rounded-full animate-ping bg-[#3ba55d]/20 scale-125 animation-delay-200" style={{ animationDelay: '0.4s' }} />
          <Avatar className="h-24 w-24 relative z-10 ring-4 ring-[#3ba55d]/50">
            {callerAvatar && <AvatarImage src={callerAvatar} />}
            <AvatarFallback className="bg-[#5865f2] text-white text-3xl font-bold">
              {callerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center">
          <p className="text-xl font-bold text-[#f2f3f5]">{callerName}</p>
          <p className="text-sm text-[#b5bac1] mt-1">seni arıyor...</p>
        </div>

        <div className="flex items-center gap-6 mt-2">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-[#ed4245] hover:bg-[#c03537] transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95"
              data-testid="button-call-reject"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <span className="text-xs text-[#b5bac1]">Reddet</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-[#3ba55d] hover:bg-[#2d8049] transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-green-500/30 hover:scale-105 active:scale-95"
              data-testid="button-call-accept"
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
            <span className="text-xs text-[#b5bac1]">Kabul Et</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
