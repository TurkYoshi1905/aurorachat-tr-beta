import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Ban, Mail, ArrowLeft, AlertOctagon, Calendar, ExternalLink } from 'lucide-react';

interface LoginBanModalProps {
  open: boolean;
  reason: string | null;
  bannedAt?: string | null;
  email?: string | null;
  onClose: () => void;
}

const LoginBanModal = ({ open, reason, bannedAt, email, onClose }: LoginBanModalProps) => {
  const [closing, setClosing] = useState(false);

  useEffect(() => { if (!open) setClosing(false); }, [open]);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    onClose();
  };

  const formatDate = (s?: string | null) => {
    if (!s) return null;
    try {
      return new Date(s).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };
  const dateStr = formatDate(bannedAt);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-red-500/30 [&>button]:hidden"
      >
        {/* Hero */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent border-b border-red-500/20">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-red-500/15 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="absolute inset-0 rounded-2xl bg-red-500/40 blur-xl scale-110 animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-red-500/15 ring-1 ring-red-500/40 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 mb-2 border border-red-500/30">
              <Ban className="w-3 h-3" /> Giriş Engellendi
            </span>
            <h2 className="text-xl font-bold text-foreground">Bu Hesap Banlı</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-[320px] leading-relaxed">
              Bu hesap AuroraChat kurallarını ihlal ettiği için kalıcı olarak askıya alındı. Giriş yapamazsınız.
            </p>
          </div>
        </div>

        {/* Email row */}
        {email && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 rounded-lg bg-secondary/40 border border-border/60 px-3 py-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{email}</span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div className={`px-6 ${email ? 'pt-3' : 'pt-5'} space-y-3`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <AlertOctagon className="w-3 h-3" /> Banlanma Sebebi
            </p>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                {reason && reason.trim().length > 0 ? reason : 'Sebep belirtilmedi'}
              </p>
            </div>
          </div>

          {dateStr && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Ban tarihi: <span className="text-foreground/80 font-medium">{dateStr}</span></span>
            </div>
          )}
        </div>

        {/* Appeal info */}
        <div className="px-6 pt-4">
          <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="text-foreground/85 font-medium mb-0.5">İtiraz Etmek İstiyor musunuz?</p>
              <p>Banın hatalı olduğunu düşünüyorsanız, AuroraChat destek e-postasına bu hesap bilgileriyle birlikte yazın. Ekip, talebinizi inceleyip sonuç hakkında geri dönüş yapacaktır.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-4 mt-4 border-t border-border">
          <Button
            onClick={handleClose}
            variant="secondary"
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Giriş Sayfasına Dön
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginBanModal;
