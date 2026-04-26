import { useState, useEffect, useRef } from 'react';
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

  // MFA Challenge state
  const [showMFAChallenge, setShowMFAChallenge] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  // useRef: always has the latest factorId regardless of closure age
  const mfaFactorIdRef = useRef('');
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

  const setMfaFactor = (id: string) => {
    mfaFactorIdRef.current = id;
    setMfaFactorId(id);
  };

  // Load reCaptcha script
  useEffect(() => {
    if (document.getElementById('recaptcha-script')) return;
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = 'https://www.google.com/recaptcha/api.js';
    script.async = true;
    script.defer = true;
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

  // Auto-verify when all 6 digits are entered
  useEffect(() => {
    if (mfaOtp.length === 6 && showMFAChallenge && !mfaVerifying) {
      handleMFAVerify(mfaOtp);
    }
  }, [mfaOtp, showMFAChallenge]);

  const resetCaptcha = () => {
    if ((window as any).grecaptcha) (window as any).grecaptcha.reset();
    setCaptchaToken(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('banned') === '1') {
      const reason = localStorage.getItem('aurorachat_account_ban_reason') || 'Sebep belirtilmedi';
      setErrors({ identifier: `Hesabınız banlandı. Sebep: ${reason}` });
      localStorage.removeItem('aurorachat_account_ban_reason');
    }
  }, [location.search]);

  const checkActiveAccountBan = async (userId: string) => {
    const { data } = await (supabase.from('account_bans') as any)
      .select('reason')
      .eq('banned_user_id', userId)
      .eq('active', true)
      .maybeSingle();
    return data as { reason?: string | null } | null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!identifier.trim()) errs.identifier = t('auth.emailRequired');
    if (!password) errs.password = t('auth.passwordRequired');
    if (!captchaToken) errs.captcha = t('auth.captchaRequired') || 'Lütfen robot olmadığınızı doğrulayın';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (!identifier.includes('@')) {
      setErrors({ identifier: t('auth.useEmailToLogin') });
      return;
    }

    setLoading(true);
    setErrors({});
    // Set mfaPending=true BEFORE signInWithPassword to prevent PublicRoute redirect
    // while we check MFA factors. Will be reset to false if no MFA or after verification.
    setMfaPending(true);

    // Verify captcha server-side
    try {
      const { data: captchaResult, error: captchaError } = await supabase.functions.invoke('verify-recaptcha', {
        body: { token: captchaToken },
      });
      const isServerError = captchaError || captchaResult?.error === 'Server config error';
      if (!isServerError && captchaResult?.success === false) {
        setMfaPending(false);
        setErrors({ captcha: 'Doğrulama başarısız, lütfen tekrar deneyin.' });
        setLoading(false);
        resetCaptcha();
        return;
      }
    } catch {
      // Network error — client-side captcha already verified, continue
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: identifier, password });

    if (error) {
      setMfaPending(false);
      setLoading(false);
      if (error.message.includes('Email not confirmed')) {
        setErrors({ identifier: t('auth.emailNotConfirmed') });
      } else {
        setErrors({ identifier: t('auth.invalidCredentials') });
      }
      resetCaptcha();
      return;
    }

    if (signInData.user?.id) {
      const activeBan = await checkActiveAccountBan(signInData.user.id);
      if (activeBan) {
        await supabase.auth.signOut();
        setMfaPending(false);
        setLoading(false);
        setErrors({ identifier: `Hesabınız banlandı. Sebep: ${activeBan.reason || 'Sebep belirtilmedi'}` });
        resetCaptcha();
        return;
      }
    }

    // --- MFA Check ---
    // Use listFactors() as primary check — more reliable than getAuthenticatorAssuranceLevel()
    // which can sometimes return stale data right after signIn.
    let verifiedFactorId: string | null = null;
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        // listFactors failed — sign out and show error (don't silently bypass MFA)
        console.error('MFA listFactors error:', factorsError);
        await supabase.auth.signOut();
        setMfaPending(false);
        setLoading(false);
        setErrors({ identifier: 'Güvenlik kontrolü sırasında hata oluştu. Lütfen tekrar deneyin.' });
        resetCaptcha();
        return;
      }

      // Find any verified TOTP factor
      const totpFactors = factorsData?.totp ?? [];
      const verified = totpFactors.find((f: any) => f.status === 'verified');
      if (verified) {
        verifiedFactorId = verified.id;
      }
    } catch (err) {
      console.error('MFA check exception:', err);
      // On unexpected error — sign out, do NOT bypass MFA silently
      await supabase.auth.signOut();
      setMfaPending(false);
      setLoading(false);
      setErrors({ identifier: 'Güvenlik kontrolü sırasında beklenmeyen hata. Lütfen tekrar deneyin.' });
      resetCaptcha();
      return;
    }

    if (verifiedFactorId) {
      // Get or create a stable device session key
      let sessionKey = localStorage.getItem('aurora_session_key');
      if (!sessionKey) { sessionKey = crypto.randomUUID(); localStorage.setItem('aurora_session_key', sessionKey); }

      // 1) Check localStorage (fast, offline-safe)
      let locallyTrusted = false;
      const trustKey = `mfa_trusted_${verifiedFactorId}`;
      const trustData = localStorage.getItem(trustKey);
      if (trustData) {
        try {
          const { expiry } = JSON.parse(trustData);
          if (expiry && Date.now() < expiry) {
            locallyTrusted = true;
          } else {
            localStorage.removeItem(trustKey);
          }
        } catch {
          localStorage.removeItem(trustKey);
        }
      }

      // 2) If not found locally, check Supabase (server-authoritative)
      if (!locallyTrusted) {
        try {
          const { data: dbTrust } = await (supabase.from('mfa_trusted_devices') as any)
            .select('id, expires_at')
            .eq('factor_id', verifiedFactorId)
            .eq('session_key', sessionKey)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          if (dbTrust) {
            locallyTrusted = true;
            // Restore local cache
            const expiry = new Date(dbTrust.expires_at).getTime();
            localStorage.setItem(trustKey, JSON.stringify({ expiry }));
          }
        } catch { /* Network error — fall through to MFA challenge */ }
      }

      if (locallyTrusted) {
        setMfaPending(false);
        setLoading(false);
        toast.success(t('auth.loginSuccess'));
        navigate(redirect);
        return;
      }

      // Double-check AAL level — show challenge if not yet at aal2
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal || aal.currentLevel !== 'aal2') {
        setMfaPending(true);
        setMfaFactor(verifiedFactorId);  // sets both state and ref
        setMfaOtp('');
        setMfaError('');
        setTrustDevice(false);
        setLoading(false);
        setShowMFAChallenge(true);
        return;
      }
    }

    // No MFA or already at aal2
    setMfaPending(false);
    setLoading(false);
    toast.success(t('auth.loginSuccess'));
    navigate(redirect);
  };

  const handleMFAVerify = async (code?: string) => {
    const otpCode = code ?? mfaOtp;
    if (otpCode.length !== 6 || mfaVerifying) return;
    // Always use ref — guaranteed to have latest value even in stale closures
    const currentFactorId = mfaFactorIdRef.current || mfaFactorId;
    if (!currentFactorId) {
      setMfaError('Doğrulama faktörü bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    setMfaVerifying(true);
    setMfaError('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: currentFactorId });
      if (challengeError) {
        setMfaError(challengeError.message || 'Doğrulama başlatılamadı. Tekrar deneyin.');
        setMfaVerifying(false);
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: currentFactorId,
        challengeId: challenge.id,
        code: otpCode,
      });
      setMfaVerifying(false);
      if (verifyError) {
        setMfaError('Doğrulama kodu hatalı veya süresi dolmuş. Tekrar deneyin.');
        setMfaOtp('');
        return;
      }
      // MFA verified successfully
      if (trustDevice) {
        const trustKey = `mfa_trusted_${currentFactorId}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
        const expiry = expiresAt.getTime();
        // localStorage (hızlı erişim)
        localStorage.setItem(trustKey, JSON.stringify({ expiry, trustedAt: new Date().toISOString() }));
        // Supabase (sunucu taraflı kalıcı kayıt)
        const sessionKey = localStorage.getItem('aurora_session_key') || crypto.randomUUID();
        localStorage.setItem('aurora_session_key', sessionKey);
        (supabase.from('mfa_trusted_devices') as any).insert({
          factor_id: currentFactorId,
          session_key: sessionKey,
          expires_at: expiresAt.toISOString(),
        }).then(() => {}).catch(() => {});
      }
      setMfaPending(false);
      setShowMFAChallenge(false);
      toast.success(t('auth.loginSuccess'));
      navigate(redirect);
    } catch {
      setMfaVerifying(false);
      setMfaError('Doğrulama sırasında hata oluştu. Tekrar deneyin.');
    }
  };

  const handleMFAClose = async () => {
    // User dismissed dialog without verifying — sign out for security
    setMfaPending(false);
    await supabase.auth.signOut();
    setShowMFAChallenge(false);
    setMfaOtp('');
    setMfaFactorId('');
    setMfaError('');
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
              data-testid="input-email"
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
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-password"
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
            data-testid="button-login"
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
      <Dialog open={showMFAChallenge} onOpenChange={(open) => { if (!open) handleMFAClose(); }}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              İki Adımlı Doğrulama
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/8 border border-primary/20 px-4 py-3">
              <p className="text-sm text-foreground font-medium">Kimlik doğrulayıcı uygulamanızdan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Google Authenticator, Authy veya benzeri bir uygulamayı açın ve AuroraChat için gösterilen 6 haneli kodu girin.
              </p>
            </div>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={mfaOtp}
                onChange={setMfaOtp}
                disabled={mfaVerifying}
                data-testid="input-mfa-otp"
              >
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

            {mfaError && (
              <p className="text-destructive text-xs text-center bg-destructive/10 rounded-lg px-3 py-2">
                {mfaError}
              </p>
            )}

            <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="label-trust-device">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                data-testid="checkbox-trust-device"
              />
              <span className="text-xs text-muted-foreground">
                1 aylığına bu cihaza güven
              </span>
            </label>

            <Button
              onClick={() => handleMFAVerify()}
              disabled={mfaVerifying || mfaOtp.length !== 6}
              className="w-full"
              data-testid="button-mfa-verify"
            >
              {mfaVerifying ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Doğrulanıyor...
                </div>
              ) : 'Doğrula'}
            </Button>

            <button
              onClick={handleMFAClose}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              data-testid="button-mfa-cancel"
            >
              İptal et ve çıkış yap
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
