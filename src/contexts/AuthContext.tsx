import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
    };
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(buildProfile(data));
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setMfaPending(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setMfaPending(false);
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
