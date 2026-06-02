import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import EmailVerified from "./pages/EmailVerified";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import ServerSettings from "./pages/ServerSettings";
import InvitePage from "./pages/InvitePage";
import Changelog from "./pages/Changelog";
import ChangelogDetail from "./pages/ChangelogDetail";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Rules from "./pages/Rules";
import VoiceJoin from "./pages/VoiceJoin";
import VoiceRemote from "./pages/VoiceRemote";
import SpotifyCallback from "./pages/SpotifyCallback";
import ModerationPage from "./pages/ModerationPage";
import Landing from "./pages/Landing";
import BotDeveloper from "./pages/BotDeveloper";
import Communities from "./pages/Communities";
import Announcements from "./pages/Announcements";
import AnnouncementDetail from "./pages/AnnouncementDetail";
import ProfileCompletionModal from "@/components/ProfileCompletionModal";
import EmailVerificationModal from "@/components/EmailVerificationModal";
import AccountBanModal from "@/components/AccountBanModal";
import SupabaseStatusBanner from "@/components/SupabaseStatusBanner";
import SupabaseMaintenancePage from "@/components/SupabaseMaintenancePage";
import { useSupabaseHealth } from "@/hooks/useSupabaseHealth";
import { I18nProvider } from "@/components/I18nProvider";
import { initNotificationPermission } from "@/lib/tauriNotifications";

const queryClient = new QueryClient();

const GlobalAuthModals = () => {
  const { user, accountBan, signOut } = useAuth();
  if (!user) return null;
  return (
    <>
      <EmailVerificationModal />
      <AccountBanModal
        open={!!accountBan}
        reason={accountBan?.reason ?? null}
        bannedAt={accountBan?.banned_at ?? null}
        onSignOut={signOut}
      />
    </>
  );
};

const NotificationBootstrap = () => {
  useEffect(() => { initNotificationPermission(); }, []);
  return null;
};

const LoadingScreen = () => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-4 px-6 text-center">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground text-sm">Yükleniyor...</p>
      {slow && (
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity mt-1"
        >
          Yeniden Yükle
        </button>
      )}
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/welcome" />;
  return (
    <>
      <ProfileCompletionModal userId={user.id} />
      {children}
    </>
  );
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, mfaPending } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && !mfaPending) return <Navigate to="/" />;
  return <>{children}</>;
};

const AppShell = () => {
  // Single health hook instance — no duplicate ping timers
  const health = useSupabaseHealth();

  // If still 'checking' after 6 s, treat as offline to prevent frozen blank screen
  // (happens when PostgREST is doing a slow schema-reload ~14s)
  const [checkingTooLong, setCheckingTooLong] = useState(false);
  useEffect(() => {
    if (health.status !== 'checking') {
      setCheckingTooLong(false);
      return;
    }
    const t = setTimeout(() => setCheckingTooLong(true), 6000);
    return () => clearTimeout(t);
  }, [health.status]);

  const showMaintenance =
    health.showFullPage ||
    (health.status === 'checking' && checkingTooLong);

  // When recovering, auto-reload after a short delay
  useEffect(() => {
    if (health.status === 'recovering') {
      const t = setTimeout(() => window.location.reload(), 3500);
      return () => clearTimeout(t);
    }
  }, [health.status]);

  return (
    <>
      <NotificationBootstrap />

      {/* Full-page maintenance: shown on FIRST failure or slow initial check */}
      {showMaintenance && (
        <SupabaseMaintenancePage
          status={health.status === 'checking' ? 'offline' : health.status}
          retrying={health.retrying}
          countdown={health.countdown}
          failCount={health.failCount}
          onRetry={health.retry}
        />
      )}

      {/* Slim banner: only for recovery notification (full page already handles offline) */}
      {!showMaintenance && health.status === 'recovering' && (
        <SupabaseStatusBanner
          status={health.status}
          retrying={health.retrying}
          countdown={health.countdown}
          retry={health.retry}
        />
      )}

      <GlobalAuthModals />

      <Routes>
        <Route path="/welcome" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/verified" element={<EmailVerified />} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/server-settings/:serverId" element={<ProtectedRoute><ServerSettings /></ProtectedRoute>} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/changelog/:id" element={<ChangelogDetail />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/voice-join" element={<ProtectedRoute><VoiceJoin /></ProtectedRoute>} />
        <Route path="/voice-remote" element={<VoiceRemote />} />
        <Route path="/spotify-callback" element={<ProtectedRoute><SpotifyCallback /></ProtectedRoute>} />
        <Route path="/moderation" element={<ProtectedRoute><ModerationPage /></ProtectedRoute>} />
        <Route path="/bot-developer" element={<ProtectedRoute><BotDeveloper /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
        <Route path="/announcements/:id" element={<ProtectedRoute><AnnouncementDetail /></ProtectedRoute>} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="bottom-left" richColors expand={false} closeButton />
      <BrowserRouter>
        <AuthProvider>
          <VoiceProvider>
            <I18nProvider>
              <AppShell />
            </I18nProvider>
          </VoiceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
