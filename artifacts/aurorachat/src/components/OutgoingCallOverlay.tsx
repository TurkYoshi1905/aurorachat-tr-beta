import { useEffect, useRef, useCallback } from 'react';
import { PhoneOff, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CallTarget {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

interface OutgoingCallOverlayProps {
  target: CallTarget;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  onAccepted: (target: CallTarget) => void;
  onClosed: () => void;
}

const OutgoingCallOverlay = ({ target, callerId, callerName, callerAvatar, onAccepted, onClosed }: OutgoingCallOverlayProps) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);

  const closeOverlay = useCallback((showToast?: string) => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (showToast) toast.error(showToast);
    onClosed();
  }, [onClosed]);

  const handleCancel = useCallback(async () => {
    await supabase.channel(`dm-call-${target.userId}`).send({
      type: 'broadcast',
      event: 'call_cancelled',
      payload: { callerId },
    });
    closeOverlay();
  }, [callerId, target.userId, closeOverlay]);

  useEffect(() => {
    if (!callerId) return;

    const sendCall = async () => {
      await supabase.channel(`dm-call-${target.userId}`).send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: { callerId, callerName, callerAvatar },
      });
    };
    sendCall();

    timeoutRef.current = setTimeout(() => {
      closeOverlay('Arama yanıtsız kaldı');
    }, 30000);

    const ch = supabase
      .channel(`dm-call-response-outgoing-${callerId}`)
      .on('broadcast', { event: 'call_accepted' }, (payload: any) => {
        if (payload.payload?.calleeId !== target.userId) return;
        if (closedRef.current) return;
        closedRef.current = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        onAccepted(target);
      })
      .on('broadcast', { event: 'call_rejected' }, (payload: any) => {
        if (payload.payload?.calleeId !== target.userId) return;
        closeOverlay(`${target.displayName} aramayı reddetti`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [callerId, callerName, callerAvatar, target, onAccepted, closeOverlay]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" data-testid="outgoing-call-overlay">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative z-10 bg-[#1e1f22] border border-[#3f4147] rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 min-w-[300px] max-w-[360px] w-full mx-4">
        <div className="text-sm text-[#b5bac1] font-medium tracking-wide uppercase">Sesli Arama</div>

        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping bg-[#5865f2]/30 scale-110" />
          <div className="absolute inset-0 rounded-full animate-ping bg-[#5865f2]/20 scale-125" style={{ animationDelay: '0.4s' }} />
          <Avatar className="h-24 w-24 relative z-10 ring-4 ring-[#5865f2]/50">
            {target.avatarUrl && <AvatarImage src={target.avatarUrl} />}
            <AvatarFallback className="bg-[#5865f2] text-white text-3xl font-bold">
              {target.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center">
          <p className="text-xl font-bold text-[#f2f3f5]">{target.displayName}</p>
          <div className="flex items-center justify-center gap-2 mt-1.5 text-sm text-[#b5bac1]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Aranıyor...</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 mt-2">
          <button
            onClick={handleCancel}
            data-testid="button-cancel-call"
            className="w-16 h-16 rounded-full bg-[#ed4245] hover:bg-[#c03537] transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
          <span className="text-xs text-[#b5bac1]">İptal Et</span>
        </div>
      </div>
    </div>
  );
};

export default OutgoingCallOverlay;
