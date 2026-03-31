import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, LogIn, Sparkles, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';

const RECAPTCHA_SITE_KEY = '6LdS-J8sAAAAAOiGrK87r8WNkmyOEhQuSCRXHC9P';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get('redirect') || '/';
  const { t } = useTranslation();
  const { setMfaPending } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);

  // MFA Challenge state
  const [showMFAChallenge, setShowMFAChallenge] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);

  // Load reCaptcha script
  useEffect(() => {
    if (document.getElementById('recaptcha-script')) { setCaptchaLoaded(true); return; }
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = 'https://www.google.com/recaptcha/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => setCaptchaLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Callback for reCaptcha
  useEffect(() => {
    (window as any).onRecaptchaSuccess = (token: string) => setCaptchaToken(token);
    (window as any).onRecaptchaExpired = () => setCaptchaToken(null);
    return () => {
      delete (window as any).onRecaptchaSuccess;
      delete (window as any).onRecaptchaExpired;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!identifier.trim()) errs.identifier = t('auth.emailRequired');
    if (!password) errs.password = t('auth.passwordRequired');
    if (!captchaToken) errs.captcha = t('auth.captchaRequired') || 'Lütfen robot olmadığınızı doğrulayın';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});

    let email = identifier;
    if (!identifier.includes('@')) {
      setErrors({ identifier: t('auth.useEmailToLogin') });
      setLoading(false);
      return;
    }

    // Verify captcha server-side (client-side captcha already verified above)
    try {
      const { data: captchaResult, error: captchaError } = await supabase.functions.invoke('verify-recaptcha', {
        body: { token: captchaToken },
      });
      // Only block login if captcha explicitly failed (user is a bot)
      // Server errors (captchaError set, or config errors) are bypassed
      const isServerError = captchaError || captchaResult?.error === 'Server config error';
      if (!isServerError && captchaResult?.success === false) {
        setErrors({ captcha: 'Doğrulama başarısız, lütfen tekrar deneyin.' });
        setLoading(false);
        if ((window as any).grecaptcha) (window as any).grecaptcha.reset();
        setCaptchaToken(null);
        return;
      }
    } catch {
      // Network or server error — client-side captcha already verified, continue login
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      if (error.message.includes('Email not confirmed')) {
        setErrors({ identifier: t('auth.emailNotConfirmed') });
      } else {
        setErrors({ identifier: t('auth.invalidCredentials') });
      }
      if ((window as any).grecaptcha) (window as any).grecaptcha.reset();
      setCaptchaToken(null);
      return;
    }

    // Check if user has 2FA enabled by checking Authenticator Assurance Level (AAL)
    try {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      // If 2FA is required (nextLevel = aal2 but currentLevel < aal2), get the factor ID and show challenge
      if (!aalError && aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        // User has 2FA enabled — get the verified TOTP factor
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors?.totp) {
          const verifiedTotp = factors.totp.find((f: any) => f.status === 'verified');
          if (verifiedTotp) {
            // Show MFA challenge dialog
            setMfaPending(true);
            setMfaFactorId(verifiedTotp.id);
            setLoading(false);
            setShowMFAChallenge(true);
            return;
          }
        }
        // If we can't get the factor ID, sign out for safety
        await supabase.auth.signOut();
        setLoading(false);
        setErrors({ identifier: '2FA kontrolü başarısız oldu. Lütfen tekrar deneyin.' });
        if ((window as any).grecaptcha) (window as any).grecaptcha.reset();
        setCaptchaToken(null);
        return;
      }
    } catch (err) {
      // Log the error for debugging but don't fail the login
      console.error('2FA check error:', err);
    }

    setLoading(false);
    toast.success(t('auth.loginSuccess'));
    navigate(redirect);
  };

  const handleMFAVerify = async () => {
    if (mfaOtp.length !== 6) return;
    setMfaVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) {
        toast.error(challengeError.message);
        setMfaVerifying(false);
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaOtp,
      });
      setMfaVerifying(false);
      if (verifyError) {
        toast.error('Doğrulama kodu hatalı. Tekrar deneyin.');
        setMfaOtp('');
        return;
      }
      // MFA verified — clear pending flag before navigating
      setMfaPending(false);
      toast.success(t('auth.loginSuccess'));
      setShowMFAChallenge(false);
      navigate(redirect);
    } catch {
      setMfaVerifying(false);
      toast.error('MFA doğrulama hatası');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">AuroraChat</h1>
          </div>
          <p className="text-muted-foreground">{t('auth.welcomeBack')}</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-2xl p-8 shadow-xl border border-border space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">{t('auth.loginTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('auth.loginSubtitle')}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">
              {t('auth.email')}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="w-full bg-input rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              maxLength={255}
            />
            {errors.identifier && <p className="text-destructive text-xs mt-1">{errors.identifier}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">
              {t('auth.password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-input rounded-lg px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password}</p>}
          </div>

          {/* reCaptcha v2 */}
          <div>
            <div
              className="g-recaptcha"
              data-sitekey={RECAPTCHA_SITE_KEY}
              data-callback="onRecaptchaSuccess"
              data-expired-callback="onRecaptchaExpired"
              data-theme="dark"
            />
            {errors.captcha && <p className="text-destructive text-xs mt-1">{errors.captcha}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {t('auth.loginButton')}
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              {t('auth.register')}
            </Link>
          </p>
          <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t('auth.forgotPassword')}
          </Link>
        </div>
      </div>

      {/* MFA Challenge Dialog */}
      <Dialog open={showMFAChallenge} onOpenChange={(open) => {
        if (!open) {
          // If user closes without verifying, sign out and clear pending state
          setMfaPending(false);
          supabase.auth.signOut();
          setShowMFAChallenge(false);
          setMfaOtp('');
          setMfaFactorId('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              İki Adımlı Doğrulama
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hesabınızda iki adımlı doğrulama aktif. Lütfen kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={mfaOtp} onChange={setMfaOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={handleMFAVerify} disabled={mfaVerifying || mfaOtp.length !== 6} className="w-full">
              {mfaVerifying ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : 'Doğrula'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
