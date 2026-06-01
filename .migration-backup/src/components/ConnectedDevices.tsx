import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Monitor, Smartphone, Tablet, Globe, Trash2, ShieldAlert,
  RefreshCw, Wifi, Clock, MapPin, CheckCircle
} from 'lucide-react';

interface DeviceSession {
  id: string;
  session_key: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  last_seen: string;
  created_at: string;
  is_active: boolean;
  isCurrent?: boolean;
}

const detectDeviceInfo = () => {
  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';

  let browser = 'Bilinmeyen';
  if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let os = 'Bilinmeyen';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iOS|iPhone|iPad/.test(ua)) os = 'iOS';

  return { deviceType, browser, os };
};

const getOrCreateSessionKey = (): string => {
  let key = localStorage.getItem('aurora_session_key');
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem('aurora_session_key', key);
  }
  return key;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Şu an aktif';
  if (mins < 60) return `${mins} dakika önce`;
  if (hours < 24) return `${hours} saat önce`;
  if (days < 7) return `${days} gün önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === 'mobile') return <Smartphone className="w-5 h-5" />;
  if (type === 'tablet') return <Tablet className="w-5 h-5" />;
  return <Monitor className="w-5 h-5" />;
};

const ConnectedDevices = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableExists, setTableExists] = useState(true);
  const currentSessionKey = getOrCreateSessionKey();

  const makeCurrentSessionFallback = useCallback((): DeviceSession => {
    const { deviceType, browser, os } = detectDeviceInfo();
    const now = new Date().toISOString();
    return {
      id: 'current',
      session_key: currentSessionKey,
      device_type: deviceType,
      browser,
      os,
      ip_address: null,
      last_seen: now,
      created_at: localStorage.getItem('aurora_session_created') || now,
      is_active: true,
      isCurrent: true,
    };
  }, [currentSessionKey]);

  const fetchGeoLocation = async (): Promise<{ city: string | null; country: string | null }> => {
    try {
      const cached = localStorage.getItem('aurora_geo');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.ts && Date.now() - parsed.ts < 24 * 60 * 60 * 1000) {
          return { city: parsed.city, country: parsed.country };
        }
      }
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { city: null, country: null };
      const data = await res.json();
      const city = data.city || null;
      const country = data.country_name || null;
      localStorage.setItem('aurora_geo', JSON.stringify({ city, country, ts: Date.now() }));
      return { city, country };
    } catch {
      return { city: null, country: null };
    }
  };

  const registerCurrentSession = useCallback(async () => {
    if (!user) return;
    const { deviceType, browser, os } = detectDeviceInfo();
    if (!localStorage.getItem('aurora_session_created')) {
      localStorage.setItem('aurora_session_created', new Date().toISOString());
    }

    const { city, country } = await fetchGeoLocation();

    const { error } = await supabase.from('user_sessions').upsert({
      user_id: user.id,
      session_key: currentSessionKey,
      device_type: deviceType,
      browser,
      os,
      city,
      country,
      last_seen: new Date().toISOString(),
      is_active: true,
    } as any, { onConflict: 'user_id,session_key' });

    if (error) {
      setTableExists(false);
    } else {
      setTableExists(true);
    }
  }, [user, currentSessionKey]);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_seen', { ascending: false });

      if (error || !data) {
        // Fallback: show current session from local info
        setSessions([makeCurrentSessionFallback()]);
        setTableExists(false);
      } else {
        setTableExists(true);
        const withCurrent = data.map((s: any) => ({
          ...s,
          isCurrent: s.session_key === currentSessionKey,
        }));
        // Make sure current session is first
        withCurrent.sort((a: any, b: any) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));
        setSessions(withCurrent);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, currentSessionKey, makeCurrentSessionFallback]);

  useEffect(() => {
    registerCurrentSession().then(() => fetchSessions());
  }, [registerCurrentSession, fetchSessions]);

  // Real-time updates
  useEffect(() => {
    if (!user || !tableExists) return;
    const channel = supabase
      .channel('user-sessions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_sessions',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchSessions(); })
      .subscribe();

    const interval = setInterval(() => { registerCurrentSession(); }, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, tableExists, fetchSessions, registerCurrentSession]);

  const broadcastForceLogout = async (targetSessionKey: string) => {
    const ch = supabase.channel(`force-logout:${user!.id}`);
    await ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.send({ type: 'broadcast', event: 'force-logout', payload: { sessionKey: targetSessionKey } });
        setTimeout(() => supabase.removeChannel(ch), 1000);
      }
    });
  };

  const handleSignOutDevice = async (session: DeviceSession) => {
    if (session.isCurrent) {
      toast.error('Mevcut cihazdan bu şekilde çıkış yapamazsın.');
      return;
    }
    try {
      if (tableExists) {
        await (supabase.from('user_sessions') as any).update({ is_active: false }).eq('id', session.id);
      }
      // Broadcast force-logout to the target device instantly
      await broadcastForceLogout(session.session_key);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      toast.success('Cihazdan çıkış yapıldı');
    } catch {
      toast.error('Çıkış yapılamadı');
    }
  };

  const handleSignOutAll = async () => {
    if (!user) return;
    try {
      const otherSessions = sessions.filter(s => !s.isCurrent);
      if (tableExists) {
        await (supabase.from('user_sessions') as any)
          .update({ is_active: false })
          .eq('user_id', user.id)
          .neq('session_key', currentSessionKey);
      }
      // Broadcast force-logout to every other device
      for (const s of otherSessions) {
        await broadcastForceLogout(s.session_key);
      }
      setSessions(prev => prev.filter(s => s.isCurrent));
      toast.success('Diğer tüm cihazlardan çıkış yapıldı');
    } catch {
      toast.error('İşlem başarısız');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-secondary/50 rounded w-1/3" />
                <div className="h-3 bg-secondary/50 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Aktif Oturumlar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} cihaz bağlı</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="sm"
            onClick={() => { registerCurrentSession(); fetchSessions(); }}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
          {sessions.filter(s => !s.isCurrent).length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleSignOutAll} className="h-8 gap-1.5 text-xs">
              <ShieldAlert className="w-3.5 h-3.5" />
              Diğerlerinden Çık
            </Button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aktif oturum bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`rounded-xl border bg-card p-4 transition-all ${
                session.isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  session.isCurrent ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground'
                }`}>
                  <DeviceIcon type={session.device_type} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {session.browser} — {session.os}
                    </p>
                    {session.isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Bu Cihaz
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDate(session.last_seen)}</span>
                    </div>
                    {(session.city || session.country) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary/70" />
                        <span className="font-medium text-foreground/70">
                          {session.city && session.country
                            ? `${session.city}, ${session.country}`
                            : session.city || session.country}
                        </span>
                      </div>
                    )}
                    {!session.city && !session.country && session.ip_address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{session.ip_address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wifi className="w-3.5 h-3.5" />
                      <span className="capitalize">{session.device_type === 'mobile' ? 'Mobil' : session.device_type === 'tablet' ? 'Tablet' : 'Masaüstü'}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    İlk giriş: {new Date(session.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleSignOutDevice(session)}
                    className="h-8 px-2 text-[#ed4245] hover:text-[#ed4245] hover:bg-[#ed4245]/10 flex-shrink-0"
                    title="Bu cihazdan çıkış yap"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-500">Güvenlik İpucu</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tanımadığın bir cihaz görürsen hemen o cihazdan çıkış yap ve şifreni değiştir.</p>
        </div>
      </div>

      {!tableExists && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
          <Globe className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-400">Gerçek Zamanlı Takip</p>
            <p className="text-xs text-muted-foreground mt-0.5">Çok cihaz takibi için <code className="font-mono bg-secondary/50 px-1 rounded">supabase/migrations/20260323000000_user_sessions.sql</code> migration dosyasını uygulayın.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectedDevices;
