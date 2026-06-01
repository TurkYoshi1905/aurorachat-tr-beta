import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Globe, LogOut, AlertTriangle, Mail } from 'lucide-react';

interface IpBanModalProps {
  open: boolean;
  reason?: string | null;
  onSignOut: () => void | Promise<void>;
}

const IpBanModal = ({ open, reason, onSignOut }: IpBanModalProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-orange-500/30 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-orange-500/15 via-orange-500/5 to-transparent border-b border-orange-500/20">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="absolute inset-0 rounded-2xl bg-orange-500/40 blur-xl scale-110 animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-orange-500/15 ring-1 ring-orange-500/40 flex items-center justify-center">
                <Globe className="w-8 h-8 text-orange-400" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 mb-2 border border-orange-500/30">
              <ShieldAlert className="w-3 h-3" /> Erişim Engellendi
            </span>
            <h2 className="text-xl font-bold text-foreground">IP Adresiniz Yasaklandı</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-[320px] leading-relaxed">
              Bu IP adresinden AuroraChat'e erişim engellendi. Yasak kalkana kadar giriş yapmanız mümkün değildir.
            </p>
          </div>
        </div>

        <div className="px-6 pt-5 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> Yasak Sebebi
            </p>
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                {reason && reason.trim().length > 0 ? reason : 'Sebep belirtilmedi'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pt-4">
          <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="text-foreground/85 font-medium mb-0.5">İtiraz Etmek İstiyor musunuz?</p>
              <p>Bu yasağın hatalı olduğunu düşünüyorsanız uygulama destek ekibiyle iletişime geçin. Talebiniz incelenecektir.</p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-4 mt-2 border-t border-border">
          <Button
            onClick={onSignOut}
            className="w-full bg-orange-500 hover:bg-orange-500/90 text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Oturumu Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IpBanModal;
