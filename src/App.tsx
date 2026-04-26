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
import VoiceJoin from "./pages/VoiceJoin";
import VoiceRemote from "./pages/VoiceRemote";
import SpotifyCallback from "./pages/SpotifyCallback";
import ModerationPage from "./pages/ModerationPage";
import Landing from "./pages/Landing";
import ProfileCompletionModal from "@/components/ProfileCompletionModal";
import { I18nProvider } from "@/components/I18nProvider";

const queryClient = new QueryClient();

const LoadingScreen = () => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground text-sm">Yükleniyor...</p>
      {slow && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-xs text-muted-foreground/60">Bağlantı yavaş görünüyor.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Yeniden Yükle
          </button>
        </div>
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="bottom-left" richColors expand={false} closeButton />
      <BrowserRouter>
        <AuthProvider>
          <VoiceProvider>
            <I18nProvider>
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
                <Route path="/voice-join" element={<ProtectedRoute><VoiceJoin /></ProtectedRoute>} />
                <Route path="/voice-remote" element={<VoiceRemote />} />
                <Route path="/spotify-callback" element={<ProtectedRoute><SpotifyCallback /></ProtectedRoute>} />
                <Route path="/moderation" element={<ProtectedRoute><ModerationPage /></ProtectedRoute>} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </I18nProvider>
          </VoiceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
