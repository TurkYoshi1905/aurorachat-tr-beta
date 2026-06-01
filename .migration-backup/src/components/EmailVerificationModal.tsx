import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle2, ShieldCheck, Clock3, ExternalLink, RefreshCw, LogOut, Inbox, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProviderInfo {
  match: RegExp;
  label: string;
  url: string;
  color: string;
}

const PROVIDERS: ProviderInfo[] = [
  { match: /@gmail\./i,          label: 'Gmail',    url: 'https://mail.google.com',                color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { match: /@(outlook|hotmail|live|msn)\./i, label: 'Outlook',  url: 'https://outlook.live.com/mail', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { match: /@yahoo\./i,          label: 'Yahoo',    url: 'https://mail.yahoo.com',                  color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  { match: /@(icloud|me|mac)\./i,label: 'iCloud',   url: 'https://www.icloud.com/mail/',            color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  { match: /@(proton|protonmail)\./i, label: 'Proton', url: 'https://mail.proton.me',                color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { match: /@yandex\./i,         label: 'Yandex',   url: 'https://mail.yandex.com',                 color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
];

const RESEND_COOLDOWN_S = 60;

const EmailVerificationModal = () => {
  const { user, signOut, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const email = user?.email || '';
  const provider = useMemo(() => PROVIDERS.find(p => p.match.test(email)), [email]);

  useEffect(() => {
    if (!user) { setOpen(false); return; }
    // Supabase email_confirmed_at is the canonical "verified" flag.
    const confirmed = !!(user.email_confirmed_at || (user as any).confirmed_at);
    setOpen(!confirmed);
  }, [user, session?.access_token]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast.error(error.message || 'Doğrulama e-postası gönderilemedi.');
      } else {
        toast.success('Doğrulama e-postası tekrar gönderildi.');
        setCooldown(RESEND_COOLDOWN_S);
      }
    } catch {
      toast.error('Beklenmeyen bir hata oluştu.');
    }
    setResending(false);
  };

  const handleRefresh = async () => {
    try {
      const { data } = await supabase.auth.refreshSession();
      const refreshed = data?.user;
      if (refreshed?.email_confirmed_at || (refreshed as any)?.confirmed_at) {
        toast.success('E-posta doğrulandı.');
        setOpen(false);
      } else {
        toast.info('E-posta hâlâ doğrulanmamış görünüyor.');
      }
    } catch {
      toast.error('Durum kontrolü yapılamadı.');
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* not user-closable */ }}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-border/60 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Hero */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-b border-border">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-xl scale-110" />
              <div className="relative w-16 h-16 rounded-2xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 ring-2 ring-background flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground">E-postanı Doğrula</h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[320px]">
              Hesabını tam olarak kullanabilmen için aşağıdaki e-posta adresine gönderdiğimiz bağlantıya tıklaman gerekiyor.
            </p>
            {email && (
              <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full bg-secondary/60 border border-border text-foreground/90">
                <Inbox className="w-3 h-3" />
                {email}
              </span>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 pt-5 pb-2 space-y-2.5">
          {[
            { icon: Inbox, text: 'Gelen kutunu (ve Spam/Gereksiz klasörünü) kontrol et.' },
            { icon: CheckCircle2, text: '"E-postamı Doğrula" bağlantısına tıkla.' },
            { icon: RefreshCw, text: 'Bu pencereye dönüp "Doğruladım" butonuna bas.' },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-secondary/30 border border-border/40">
              <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 text-[11px] font-bold">{i + 1}</div>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground/85 leading-snug">{text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Provider quick link */}
        {provider && (
          <div className="px-6 pt-3">
            <a
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-sm font-semibold transition-colors ${provider.color} hover:opacity-90`}
            >
              <ExternalLink className="w-4 h-4" />
              {provider.label} Posta Kutusunu Aç
            </a>
          </div>
        )}

        {/* Trust badges */}
        <div className="px-6 pt-3 flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-3 h-3" /> Şifrelenmiş
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
            <Clock3 className="w-3 h-3" /> 24 saat geçerli
          </span>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-4 border-t border-border mt-4 space-y-2">
          <Button onClick={handleRefresh} className="w-full">
            <CheckCircle2 className="w-4 h-4" /> Doğruladım
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
            >
              <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
              {cooldown > 0 ? `Tekrar gönder (${cooldown}s)` : 'Tekrar Gönder'}
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" /> Çıkış
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationModal;
