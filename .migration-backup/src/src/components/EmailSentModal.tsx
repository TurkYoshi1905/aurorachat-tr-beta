import { useEffect, useState } from 'react';
import { Mail, CheckCircle2, ArrowRight, Inbox, ShieldCheck, Sparkles, Clock, RefreshCw, X } from 'lucide-react';

interface EmailSentModalProps {
  open: boolean;
  email: string;
  onClose: () => void;
  onGoToLogin: () => void;
}

const EmailSentModal = ({ open, email, onClose, onGoToLogin }: EmailSentModalProps) => {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (open) {
      setAnimateIn(false);
      const t = setTimeout(() => setAnimateIn(true), 30);
      setResendCooldown(60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open || resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [open, resendCooldown]);

  if (!open) return null;

  const provider = (() => {
    const domain = (email.split('@')[1] || '').toLowerCase();
    if (domain.includes('gmail')) return { name: 'Gmail', url: 'https://mail.google.com' };
    if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live'))
      return { name: 'Outlook', url: 'https://outlook.live.com' };
    if (domain.includes('yahoo')) return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' };
    if (domain.includes('icloud') || domain.includes('me.com'))
      return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
    if (domain.includes('proton')) return { name: 'Proton Mail', url: 'https://mail.proton.me' };
    if (domain.includes('yandex')) return { name: 'Yandex Mail', url: 'https://mail.yandex.com' };
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl transition-all duration-300 ${
          animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero header */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-b border-border/50">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute top-2 left-6 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <div className="absolute top-10 right-10 w-1 h-1 rounded-full bg-primary/70 animate-pulse [animation-delay:300ms]" />
            <div className="absolute bottom-4 left-12 w-1 h-1 rounded-full bg-primary/50 animate-pulse [animation-delay:600ms]" />
          </div>
          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">E-posta Gönderildi</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Hesabını doğrulamak için bir bağlantı gönderdik
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Email pill */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/40 border border-border/50">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Gönderildiği adres</p>
              <p className="text-sm font-semibold text-foreground truncate">{email}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-secondary/30">
              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Gelen kutunu kontrol et</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">E-posta birkaç dakika içinde gelir. Spam klasörünü de kontrol etmeyi unutma.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-secondary/30">
              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Doğrulama bağlantısına tıkla</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Hesabını aktifleştirmek için e-postadaki butonu kullan.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-secondary/30">
              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Giriş yap ve sohbete başla</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Doğrulama tamamlandığında AuroraChat seni bekliyor olacak.</p>
              </div>
            </div>
          </div>

          {/* Info badges */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
              <ShieldCheck className="w-3 h-3" /> Şifrelenmiş bağlantı
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
              <Sparkles className="w-3 h-3" /> 24 saat geçerli
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 border border-border/50 text-muted-foreground text-[11px] font-medium">
              <Clock className="w-3 h-3" />
              {resendCooldown > 0 ? `Tekrar gönder ${resendCooldown}sn` : 'Hemen gelmediyse spam\'a bak'}
            </span>
          </div>

          {/* CTA */}
          {provider && (
            <a
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/70 border border-border/50 text-sm font-semibold text-foreground transition-colors"
            >
              {provider.name} aç
              <ArrowRight className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={onGoToLogin}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors shadow-lg shadow-primary/20"
          >
            Giriş Sayfasına Git
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-center text-muted-foreground">
            E-posta gelmediyse adresi yanlış girmiş olabilirsin. Tekrar denemek için <span className="text-foreground font-medium">Kapat</span>'a basıp adresi düzeltebilirsin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailSentModal;
