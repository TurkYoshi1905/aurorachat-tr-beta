import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const queryType = searchParams.get('type') || '';

      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace('#', '?').replace('#', '&'));
      const hashType = hashParams.get('type') || '';

      const flowType = queryType || hashType;

      if (flowType === 'recovery') {
        navigate('/reset-password', { replace: true });
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Auth callback error:', error);
          navigate('/login', { replace: true });
          return;
        }
        navigate('/verified', { replace: true });
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          navigate('/reset-password', { replace: true });
        } else if (event === "SIGNED_IN") {
          navigate('/verified', { replace: true });
        }
      });

      return () => subscription.unsubscribe();
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Doğrulanıyor...</p>
      </div>
    </div>
  );
}
