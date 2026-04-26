import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  bio: string | null;
  language: string;
  banner_color: string;
  is_premium: boolean;
  has_premium_badge: boolean;
  has_basic_badge: boolean;
  premium_expires_at: string | null;
  basic_expires_at: string | null;
  is_app_admin: boolean;
  gender: string | null;
  birth_date: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  mfaPending: boolean;
  setMfaPending: (pending: boolean) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  mfaPending: false,
  setMfaPending: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const profileRef = useRef<Profile | null>(null);

  const buildProfile = (data: any): Profile => {
    const now = new Date();
    const premiumExpires = data.premium_expires_at ? new Date(data.premium_expires_at) : null;
    const basicExpires = data.basic_expires_at ? new Date(data.basic_expires_at) : null;
    const isPremiumActive = !!(data.is_premium) && (premiumExpires ? premiumExpires > now : true);
    const isBasicActive = !!(data.has_basic_badge) && (basicExpires ? basicExpires > now : true);
    return {
      id: data.id,
      username: data.username,
      display_name: data.display_name || data.username,
      avatar_url: data.avatar_url,
      status: data.status,
      bio: data.bio,
      language: data.language || 'tr',
      banner_color: data.banner_color || '#1a1a2e',
      is_premium: isPremiumActive,
      has_premium_badge: !!(data.has_premium_badge) && isPremiumActive,
      has_basic_badge: isBasicActive,
      premium_expires_at: data.premium_expires_at || null,
      basic_expires_at: data.basic_expires_at || null,
      is_app_admin: !!data.is_app_admin,
      gender: data.gender ?? null,
      birth_date: data.birth_date ?? null,
    };
  };

  const forceSignOutForBan = async (reason?: string | null) => {
    localStorage.setItem('aurorachat_account_ban_reason', reason || 'Sebep belirtilmedi');
    setMfaPending(false);
    await supabase.auth.signOut();
    window.location.assign('/login?banned=1');
  };

  // Zaman aşımı yardımcısı: promise'yi verilen ms sonra reddeder
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);

  const fetchProfile = async (userId: string) => {
    try {
      const result = await withTimeout(
        supabase.from("profiles").select("id, username, display_name, avatar_url, status, bio, language, banner_color, is_premium, has_premium_badge, has_basic_badge, premium_expires_at, basic_expires_at, is_app_admin, gender, birth_date").eq("id", userId).single(),
        6000
      );
      const data = (result as any)?.data;
      if (data) {
        const builtProfile = buildProfile(data);
        profileRef.current = builtProfile;
        setProfile(builtProfile);
      }
    } catch {
      // profil yüklenemedi, yükleme ekranını engellemez
    }
  };

  useEffect(() => {
    let loadingResolved = false;

    const resolveLoading = () => {
      if (!loadingResolved) {
        loadingResolved = true;
        setLoading(false);
      }
    };

    // Güvenlik ağı: 8 saniye sonra hâlâ yüklüyorsa zorla kapat
    const safetyTimer = setTimeout(resolveLoading, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        profileRef.current = null;
        setProfile(null);
        setMfaPending(false);
      }
      resolveLoading();
    });

    withTimeout(supabase.auth.getSession(), 7000).then((result) => {
      const session = (result as any)?.data?.session ?? null;
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      resolveLoading();
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    const userId = session.user.id;

    const checkBan = async () => {
      const { data } = await (supabase.from('account_bans') as any)
        .select('reason')
        .eq('banned_user_id', userId)
        .eq('active', true)
        .maybeSingle();
      if (active && data) {
        await forceSignOutForBan(data.reason);
      }
    };

    checkBan();

    const channel = supabase
      .channel(`account-ban-watch:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'account_bans',
        filter: `banned_user_id=eq.${userId}`,
      }, async (payload) => {
        const row = (payload.new || payload.old) as any;
        if (row?.active) {
          await forceSignOutForBan(row.reason);
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) return;
    let sessionKey = localStorage.getItem('aurora_session_key');
    const userId = session.user.id;

    const registerSession = async () => {
      let key = localStorage.getItem('aurora_session_key');
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem('aurora_session_key', key);
      }
      sessionKey = key;
      if (!localStorage.getItem('aurora_session_created')) {
        localStorage.setItem('aurora_session_created', new Date().toISOString());
      }
      const now = new Date().toISOString();
      const ua = navigator.userAgent;
      const deviceType = /Mobi|Android/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';
      const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Bilinmeyen';
      const os = /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iOS|iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Bilinmeyen';
      const savedStatus = localStorage.getItem(`aurorachat_status_${userId}`);
      const status = savedStatus && ['online', 'idle', 'dnd', 'offline'].includes(savedStatus) ? savedStatus : profileRef.current?.status || 'online';
      await (supabase.from('user_sessions') as any).upsert({
        user_id: userId,
        session_key: key,
        device_type: deviceType,
        browser,
        os,
        last_seen: now,
        is_active: true,
      }, { onConflict: 'user_id,session_key' });
      await (supabase.from('profiles') as any)
        .update({ status: status as any, last_seen: now })
        .eq('id', userId);
    };

    const markInactive = () => {
      const now = new Date().toISOString();
      const key = sessionKey || localStorage.getItem('aurora_session_key');
      if (key) {
        (supabase.from('user_sessions') as any)
          .update({ is_active: false, last_seen: now })
          .eq('user_id', userId)
          .eq('session_key', key)
          .then(() => {});
      }
      (supabase.from('profiles') as any)
        .update({ status: 'offline' as any, last_seen: now })
        .eq('id', userId)
        .then(() => {});
    };

    registerSession();
    // Her 90 saniyede bir session'ı güncelle (tab gizliyse atla)
    const interval = setInterval(() => {
      if (!document.hidden) registerSession();
    }, 90 * 1000);
    window.addEventListener('beforeunload', markInactive);
    window.addEventListener('pagehide', markInactive);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', markInactive);
      window.removeEventListener('pagehide', markInactive);
      markInactive();
    };
  }, [session?.user?.id]);

  const signOut = async () => {
    setMfaPending(false);
    profileRef.current = null;
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, mfaPending, setMfaPending, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
