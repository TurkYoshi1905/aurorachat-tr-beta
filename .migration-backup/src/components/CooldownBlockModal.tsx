import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Timer, MessageSquareOff, ServerCrash } from 'lucide-react';

interface CooldownBlockModalProps {
  open: boolean;
  onClose: () => void;
  action: 'message' | 'server';
  reason: string | null;
  cooldownUntil: string | null;
}

const CooldownBlockModal = ({ open, onClose, action, reason, cooldownUntil }: CooldownBlockModalProps) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!cooldownUntil || !open) return;
    const calc = () => setRemaining(Math.max(0, new Date(cooldownUntil).getTime() - Date.now()));
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil, open]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const timeStr = minutes > 0
    ? `${minutes} dakika ${seconds} saniye`
    : `${seconds} saniye`;

  const isMessage = action === 'message';
  const ActionIcon = isMessage ? MessageSquareOff : ServerCrash;
  const actionTitle = isMessage ? 'Mesaj Gönderilemiyor' : 'Sunucu Oluşturulamıyor';
  const actionDesc = isMessage
    ? 'Cooldown süreniz dolana kadar mesaj, resim ve emoji gönderemezsiniz.'
    : 'Cooldown süreniz dolana kadar yeni sunucu oluşturamazsınız.';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
              <Timer className="w-5 h-5 text-orange-400" />
            </div>
            Cooldown Aktif
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <ActionIcon className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{actionTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{actionDesc}</p>
            </div>
          </div>

          {reason && (
            <div className="rounded-xl bg-secondary/40 px-3 py-2.5 space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sebep</p>
              <p className="text-sm text-foreground">{reason}</p>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30">
            <Timer className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Kalan süre:{' '}
              <span className="font-bold text-foreground tabular-nums">{remaining > 0 ? timeStr : 'Doldu'}</span>
            </p>
          </div>

          <Button onClick={onClose} className="w-full">Tamam</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CooldownBlockModal;
