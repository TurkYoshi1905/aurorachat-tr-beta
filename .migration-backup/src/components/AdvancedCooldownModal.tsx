import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Timer, User, AlertTriangle, Clock, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CooldownTarget {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

interface AdvancedCooldownModalProps {
  open: boolean;
  target: CooldownTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { label: '5 Dakika',   value: 5 },
  { label: '15 Dakika',  value: 15 },
  { label: '30 Dakika',  value: 30 },
  { label: '1 Saat',     value: 60 },
  { label: '3 Saat',     value: 180 },
  { label: '6 Saat',     value: 360 },
  { label: '12 Saat',    value: 720 },
  { label: '24 Saat',    value: 1440 },
  { label: '7 Gün',      value: 10080 },
];

const AdvancedCooldownModal = ({ open, target, onClose, onSuccess }: AdvancedCooldownModalProps) => {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(30);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!target) return;
    if (!reason.trim()) { toast.error('Cooldown sebebi zorunludur'); return; }
    setApplying(true);
    try {
      const { data, error } = await (supabase as any).rpc('apply_manual_cooldown', {
        p_target_user_id: target.id,
        p_reason: reason.trim(),
        p_duration_minutes: duration,
      });
      if (error) {
        toast.error('Cooldown uygulanamadı: ' + error.message);
        return;
      }
      if (data?.success === false) {
        toast.error(data.error || 'Cooldown uygulanamadı');
        return;
      }
      const selectedLabel = DURATION_OPTIONS.find(o => o.value === duration)?.label || `${duration} dk`;
      toast.success(`@${target.username} kullanıcısına ${selectedLabel} cooldown uygulandı`);
      setReason('');
      setDuration(30);
      onSuccess?.();
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const selectedOpt = DURATION_OPTIONS.find(o => o.value === duration);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Timer className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <span className="font-bold text-foreground">Manuel Cooldown Uygula</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Aurora Guard · Moderasyon</p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          {target && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
              <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                {target.avatar_url
                  ? <img src={target.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <User className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{target.display_name || target.username}</p>
                <p className="text-xs text-muted-foreground">@{target.username}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" /> Süre
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={`text-xs py-2 px-1 rounded-lg border font-medium transition-all ${
                    duration === opt.value
                      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                      : 'bg-secondary/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {selectedOpt && (
              <p className="text-[11px] text-muted-foreground">Seçilen süre: <span className="text-foreground font-medium">{selectedOpt.label}</span></p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400" /> Sebep <span className="text-destructive">*</span>
            </label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Cooldown sebebini açıkla..."
              className="bg-input"
              onKeyDown={e => e.key === 'Enter' && !applying && handleApply()}
            />
          </div>

          <div className="rounded-xl bg-yellow-500/8 border border-yellow-500/20 p-3 text-xs text-yellow-400/90 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Bu işlem geri alınabilir. Cooldown süresi dolmadan kaldırmak için Güvenlik sekmesini kullan.</span>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">İptal</Button>
          <Button
            onClick={handleApply}
            disabled={applying || !reason.trim()}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold gap-1.5"
          >
            {applying
              ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              : <><Check className="w-4 h-4" /> Uygula</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedCooldownModal;
