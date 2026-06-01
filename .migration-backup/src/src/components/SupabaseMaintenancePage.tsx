import { useEffect, useState } from 'react';
import { RefreshCw, Wifi, WifiOff, Database, Shield, Activity, Zap, HardDrive, ExternalLink, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { HealthStatus } from '@/hooks/useSupabaseHealth';

interface Props {
  status: HealthStatus;
  retrying: boolean;
  countdown: number;
  failCount: number;
  onRetry: () => void;
}

const SERVICES = [
  { label: 'Veritabanı',    icon: Database,  key: 'db' },
  { label: 'Auth',          icon: Shield,    key: 'auth' },
  { label: 'PostgREST',     icon: Activity,  key: 'rest' },
  { label: 'Realtime',      icon: Zap,       key: 'rt' },
  { label: 'Storage',       icon: HardDrive, key: 'storage' },
  { label: 'Edge Functions',icon: Activity,  key: 'ef' },
];

const Particle = ({ style }: { style: React.CSSProperties }) => (
  <div className="absolute w-1 h-1 rounded-full bg-primary/20 animate-pulse" style={style} />
);

const ServiceRow = ({ label, icon: Icon, isRecovering }: { label: string; icon: typeof Database; isRecovering: boolean }) => {
  const [localStatus, setLocalStatus] = useState<'error' | 'checking' | 'ok'>('error');

  useEffect(() => {
    if (isRecovering) {
      const t = setTimeout(() => setLocalStatus('checking'), Math.random() * 800);
      const t2 = setTimeout(() => setLocalStatus('ok'), 1200 + Math.random() * 600);
      return () => { clearTimeout(t); clearTimeout(t2); };
    } else {
      setLocalStatus('error');
    }
  }, [isRecovering]);

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          localStatus === 'ok' ? 'bg-emerald-500/15' :
          localStatus === 'checking' ? 'bg-yellow-500/15' :
          'bg-red-500/10'
        }`}>
          <Icon className={`w-3.5 h-3.5 ${
            localStatus === 'ok' ? 'text-emerald-400' :
            localStatus === 'checking' ? 'text-yellow-400' :
            'text-red-400/70'
          }`} />
        </div>
        <span className="text-sm text-foreground/80 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {localStatus === 'ok' ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Aktif</span>
          </>
        ) : localStatus === 'checking' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
            <span className="text-xs text-yellow-400 font-medium">Kontrol ediliyor...</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-red-400/70" />
            <span className="text-xs text-red-400/70 font-medium">Yanıt yok</span>
          </>
        )}
      </div>
    </div>
  );
};

const SupabaseMaintenancePage = ({ status, retrying, countdown, failCount, onRetry }: Props) => {
  const isRecovering = status === 'recovering';

  const particles = Array.from({ length: 12 }, (_, i) => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    animationDelay: `${i * 0.4}s`,
    animationDuration: `${2 + Math.random() * 3}s`,
  }));

  return (
    <div className="fixed inset-0 z-[9998] bg-background flex flex-col items-center justify-start overflow-y-auto">
      {/* Subtle ambient particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => <Particle key={i} style={p} />)}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[200px] bg-red-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md mx-auto px-4 py-8 flex flex-col gap-5 min-h-screen justify-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-lg font-bold text-foreground">AuroraChat</span>
        </div>

        {/* Main status card */}
        <div className={`rounded-2xl border p-6 text-center space-y-4 transition-all duration-500 ${
          isRecovering
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-red-500/20 bg-card'
        }`}>
          {/* Icon */}
          <div className="flex justify-center">
            <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center ${
              isRecovering ? 'bg-emerald-500/15' : 'bg-red-500/10'
            }`}>
              {isRecovering ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-in zoom-in duration-500" />
              ) : (
                <>
                  <WifiOff className={`w-10 h-10 text-red-400/80 ${retrying ? 'opacity-50' : ''}`} />
                  {retrying && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-xl border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  )}
                </>
              )}
              {/* Pulse ring */}
              {!isRecovering && !retrying && (
                <div className="absolute inset-0 rounded-2xl border-2 border-red-500/20 animate-ping" />
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            {isRecovering ? (
              <>
                <h1 className="text-xl font-bold text-emerald-400">Bağlantı Geri Geldi!</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Supabase yeniden erişilebilir durumda. Uygulama birkaç saniye içinde yeniden yüklenecek.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Bağlantı Kesintisi</span>
                </div>
                <h1 className="text-xl font-bold text-foreground">Sunucuya Bağlanılamıyor</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AuroraChat'in veritabanı (Supabase) şu an yanıt vermiyor.
                  Verileriniz güvende — geçici bir altyapı sorunu yaşanıyor.
                </p>
              </>
            )}
          </div>

          {/* Recovery redirect */}
          {isRecovering && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Uygulamaya Git
            </button>
          )}

          {/* Retry section */}
          {!isRecovering && (
            <div className="space-y-3 pt-1">
              <button
                onClick={onRetry}
                disabled={retrying}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Bağlanılıyor...' : 'Tekrar Dene'}
              </button>
              {countdown > 0 && !retrying && (
                <p className="text-xs text-muted-foreground/60 text-center">
                  Otomatik yeniden deneme: <span className="font-mono text-muted-foreground">{countdown}s</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Service status card */}
        {!isRecovering && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Servis Durumu</p>
              <span className="text-[10px] text-muted-foreground/50">{failCount} başarısız deneme</span>
            </div>
            {SERVICES.map(s => (
              <ServiceRow key={s.key} label={s.label} icon={s.icon} isRecovering={isRecovering} />
            ))}
          </div>
        )}

        {/* Tips card */}
        {!isRecovering && (
          <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4 space-y-2.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ne Yapabilirsiniz?</p>
            <div className="space-y-2">
              {[
                { icon: Wifi, text: 'İnternet bağlantınızı kontrol edin' },
                { icon: RefreshCw, text: 'Birkaç dakika bekleyip tekrar deneyin' },
                { icon: Activity, text: 'Supabase\'in genel durum sayfasını inceleyin' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 pb-4">
          <a
            href="https://status.supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> status.supabase.com
          </a>
          <span className="text-muted-foreground/30">·</span>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Sayfayı Yenile
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupabaseMaintenancePage;
