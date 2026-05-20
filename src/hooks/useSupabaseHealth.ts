import { useState, useEffect, useCallback, useRef } from 'react';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string)
  || 'https://ktittqaubkaylprxnoya.supabase.co';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXR0cWF1YmtheWxwcnhub3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzI3NDAsImV4cCI6MjA4ODIwODc0MH0.nmgU8lXCueNmDyoDtX94x9uOAY9292ZTFaaXz8XI3dU';

export type HealthStatus = 'checking' | 'online' | 'offline' | 'recovering';

const CHECK_INTERVAL_OK_MS   = 60_000;
const CHECK_INTERVAL_FAIL_MS = 12_000;
const REQUEST_TIMEOUT_MS     = 5_000;   // fail fast — 5s max per ping
const FULL_PAGE_THRESHOLD    = 1;       // show full page on FIRST failure

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

export const useSupabaseHealth = () => {
  const [status, setStatus]               = useState<HealthStatus>('checking');
  const [retrying, setRetrying]           = useState(false);
  const [justRecovered, setJustRecovered] = useState(false);
  const [countdown, setCountdown]         = useState(0);
  const [failCount, setFailCount]         = useState(0);

  const timerRef     = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const inflightRef  = useRef<AbortController | null>(null);
  const wasOffline   = useRef(false);

  const clearCountdown = () => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = (seconds: number) => {
    clearCountdown();
    setCountdown(seconds);
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearCountdown(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const runCheck = useCallback(async (manual = false) => {
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    const tid = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    if (manual) setRetrying(true);

    const ok = await ping(ctrl.signal);
    window.clearTimeout(tid);
    if (ctrl.signal.aborted && !manual) return;

    setRetrying(false);

    if (ok) {
      if (wasOffline.current) {
        setStatus('recovering');
        setJustRecovered(true);
        window.setTimeout(() => {
          setStatus('online');
          setJustRecovered(false);
        }, 4000);
      } else {
        setStatus('online');
      }
      wasOffline.current = false;
      setFailCount(0);
      clearCountdown();
    } else {
      wasOffline.current = true;
      setFailCount(prev => prev + 1);
      setStatus('offline');
      const delay = Math.round(CHECK_INTERVAL_FAIL_MS / 1000);
      startCountdown(delay);
    }
  }, []);

  useEffect(() => {
    runCheck();
    const onOnline = () => runCheck();
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      inflightRef.current?.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      clearCountdown();
    };
  }, [runCheck]);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const delay = status === 'offline' ? CHECK_INTERVAL_FAIL_MS : CHECK_INTERVAL_OK_MS;
    timerRef.current = window.setTimeout(() => runCheck(), delay);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [status, runCheck]);

  const showFullPage = status === 'offline' && failCount >= FULL_PAGE_THRESHOLD;

  return {
    status,
    retrying,
    justRecovered,
    countdown,
    failCount,
    showFullPage,
    retry: () => runCheck(true),
  };
};
