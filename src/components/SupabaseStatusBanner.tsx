import { useEffect, useState, useCallback, useRef } from 'react';
import { AlertTriangle, RefreshCw, X, CheckCircle2 } from 'lucide-react';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string)
  || 'https://ktittqaubkaylprxnoya.supabase.co';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXR0cWF1YmtheWxwcnhub3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzI3NDAsImV4cCI6MjA4ODIwODc0MH0.nmgU8lXCueNmDyoDtX94x9uOAY9292ZTFaaXz8XI3dU';

type Status = 'checking' | 'online' | 'offline';

const CHECK_INTERVAL_OK_MS = 60_000;
const CHECK_INTERVAL_FAIL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 6_000;

const ping = async (signal: AbortSignal): Promise<boolean> => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
      {
        method: 'HEAD',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal,
        cache: 'no-store',
      }
    );
    return res.ok || res.status === 401 || res.status === 403 || res.status === 406;
  } catch {
    return false;
  }
};

const SupabaseStatusBanner = () => {
  const [status, setStatus] = useState<Status>('checking');
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [justRecovered, setJustRecovered] = useState(false);
  const wasOfflineRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef<AbortController | null>(null);

  const runCheck = useCallback(async (manual = false) => {
    inflightRef.current?.abort();
    const controller = new AbortController();
    inflightRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    if (manual) setRetrying(true);
    const ok = await ping(controller.signal);
    window.clearTimeout(timeoutId);
    if (controller.signal.aborted && !manual) return;
    setRetrying(false);
    setStatus(prev => {
      if (ok) {
        if (wasOfflineRef.current) {
          setJustRecovered(true);
          window.setTimeout(() => setJustRecovered(false), 5000);
        }
        wasOfflineRef.current = false;
        if (prev !== 'online') setDismissed(false);
        return 'online';
      } else {
        wasOfflineRef.current = true;
        return 'offline';
      }
    });
  }, []);

  useEffect(() => {
    runCheck();
    const onOnline = () => runCheck();
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      inflightRef.current?.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [runCheck]);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const delay = status === 'offline' ? CHECK_INTERVAL_FAIL_MS : CHECK_INTERVAL_OK_MS;
    timerRef.current = window.setTimeout(() => runCheck(), delay);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [status, runCheck]);

  if (status === 'online' && !justRecovered) return null;
  if (status === 'offline' && dismissed) return null;
  if (status === 'checking') return null;

  const isOffline = status === 'offline';

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[9999] pointer-events-none flex justify-center px-3 pt-3`}
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
        <div
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            isOffline ? 'bg-red-500/20' : 'bg-emerald-500/20'
          }`}
        >
          {isOffline ? (
            <AlertTriangle className="w-4 h-4 text-red-300" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isOffline ? (
            <>
              <p className="text-sm font-semibold leading-tight">
                Sunucuya bağlanılamıyor
              </p>
              <p className="text-[11px] sm:text-xs text-red-200/80 leading-snug mt-0.5">
                AuroraChat veritabanı şu an yanıt vermiyor. Mesajların ve verilerin yüklenmemiş
                olabilir. Birkaç dakika içinde otomatik tekrar denenecek.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold leading-tight">Bağlantı geri geldi</p>
              <p className="text-[11px] sm:text-xs text-emerald-200/80 leading-snug mt-0.5">
                Veritabanı tekrar erişilebilir. Sayfayı yenilemeni öneririz.
              </p>
            </>
          )}
        </div>

        {isOffline ? (
          <>
            <button
              onClick={() => runCheck(true)}
              disabled={retrying}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              title="Tekrar dene"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{retrying ? 'Deneniyor...' : 'Tekrar Dene'}</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-red-200/70 hover:text-red-50 hover:bg-red-500/20 transition-colors"
              title="Kapat"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => window.location.reload()}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Yenile</span>
            </button>
            <button
              onClick={() => setJustRecovered(false)}
              className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-emerald-200/70 hover:text-emerald-50 hover:bg-emerald-500/20 transition-colors"
              title="Kapat"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SupabaseStatusBanner;
