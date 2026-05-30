import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { HealthStatus } from '@/hooks/useSupabaseHealth';

interface Props {
  status: HealthStatus;
  retrying: boolean;
  countdown: number;
  retry: () => void;
}

const SupabaseStatusBanner = ({ status, retrying, countdown, retry }: Props) => {
  const isOffline = status === 'offline';

  return (
    <div
      className="fixed top-0 inset-x-0 z-[9999] pointer-events-none flex justify-center px-3 pt-3"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto w-full max-w-3xl rounded-xl shadow-2xl border backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          isOffline
            ? 'bg-red-950/85 border-red-500/40 text-red-50'
            : 'bg-emerald-950/85 border-emerald-500/40 text-emerald-50'
        }`}
      >
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isOffline ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
          {isOffline
            ? <AlertTriangle className="w-4 h-4 text-red-300" />
            : <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
        </div>

        <div className="flex-1 min-w-0">
          {isOffline ? (
            <>
              <p className="text-sm font-semibold leading-tight">Sunucuya bağlanılamıyor</p>
              <p className="text-[11px] sm:text-xs text-red-200/80 leading-snug mt-0.5">
                AuroraChat veritabanı yanıt vermiyor.
                {countdown > 0 && ` ${countdown}s içinde tekrar denenecek.`}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold leading-tight">Bağlantı geri geldi</p>
              <p className="text-[11px] sm:text-xs text-emerald-200/80 leading-snug mt-0.5">
                Veritabanı yeniden erişilebilir. Sayfayı yenilemeni öneririz.
              </p>
            </>
          )}
        </div>

        {isOffline ? (
          <button
            onClick={retry}
            disabled={retrying}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{retrying ? 'Deneniyor...' : 'Tekrar Dene'}</span>
          </button>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Yenile</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SupabaseStatusBanner;
