import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      navigate("/login");
    }
  }, [navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t('common.success'), description: t('auth.passwordResetSuccess') });
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-aurora-purple/10 via-transparent to-transparent rounded-full blur-3xl animate-aurora-pulse" />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md mx-4">
        <div className="glass rounded-2xl p-8 aurora-glow">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2">{t('auth.newPassword')}</h1>
            <p className="text-muted-foreground">{t('auth.newPasswordDesc')}</p>
          </div>
          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.newPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-muted/50 border-border/50" minLength={6} required />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t('common.updating') : t('auth.resetPasswordButton')}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
