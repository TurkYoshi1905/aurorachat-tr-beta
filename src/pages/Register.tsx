import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Sparkles, Camera, SkipForward, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';

type Step = 'names' | 'birthday' | 'avatar' | 'password' | 'email';

const MONTHS = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
];

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get('redirect') || '';
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('names');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Birthday
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const calculateAge = (): number => {
    if (!birthDay || !birthMonth || !birthYear) return 0;
    const birth = new Date(Number(birthYear), Number(birthMonth) - 1, Number(birthDay));
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErrors({ avatar: t('settings.selectImage') }); return; }
    if (file.size > 5 * 1024 * 1024) { setErrors({ avatar: t('settings.fileTooLarge') }); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setErrors({});
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 'names') {
      if (!displayName.trim()) e.displayName = t('auth.displayNameRequired');
      if (!username.trim()) e.username = t('auth.usernameRequired');
      else if (username !== username.toLowerCase()) e.username = t('auth.usernameLowercase');
      else if (username.length < 3) e.username = t('auth.usernameMinLength');
      else if (!/^[a-z0-9_]+$/.test(username)) e.username = t('auth.usernamePattern');
    }
    if (step === 'birthday') {
      if (!birthDay || !birthMonth || !birthYear) e.birthday = t('auth.birthdayRequired');
      else if (calculateAge() < 13) e.birthday = t('auth.ageRestriction');
    }
    if (step === 'password') {
      if (password.length < 6) e.password = t('auth.passwordMinLength');
      if (password !== confirmPassword) e.confirmPassword = t('auth.passwordMismatch');
    }
    if (step === 'email') {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('auth.invalidEmail');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;

    if (step === 'names') {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      setLoading(false);
      if (data) {
        setErrors({ username: t('auth.usernameTaken') });
        return;
      }
      setStep('birthday');
    } else if (step === 'birthday') {
      setStep('avatar');
    } else if (step === 'avatar') {
      setStep('password');
    } else if (step === 'password') {
      setStep('email');
    } else if (step === 'email') {
      setLoading(true);
      try {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName, username },
          },
        });
        if (error) {
          setErrors({ email: error.message });
          setLoading(false);
          return;
        }

        // Upload avatar if selected
        if (avatarFile && signUpData.user) {
          const ext = avatarFile.name.split('.').pop();
          const path = `${signUpData.user.id}/avatar.${ext}`;
          await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          await supabase.from('profiles').update({ avatar_url: urlData.publicUrl } as any).eq('id', signUpData.user.id);
        }

        toast.success(t('auth.verificationSent'));
        navigate(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login');
      } catch {
        setErrors({ email: t('auth.genericError') });
      }
      setLoading(false);
    }
  };

  const handleBack = () => {
    const order: Step[] = ['names', 'birthday', 'avatar', 'password', 'email'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const steps: Step[] = ['names', 'birthday', 'avatar', 'password', 'email'];
  const currentIndex = steps.indexOf(step);

  const selectClass = "w-full bg-input rounded-lg px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">AuroraChat</h1>
          </div>
          <p className="text-muted-foreground">{t('auth.createAccount')}</p>
        </div>

        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= currentIndex ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-xl border border-border">
          {step === 'names' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">{t('auth.stepNames')}</h2>
                <p className="text-sm text-muted-foreground">{t('auth.stepNamesDesc')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.displayName')}</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('auth.displayNamePlaceholder')} className="w-full bg-input rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all" maxLength={50} />
                {errors.displayName && <p className="text-destructive text-xs mt-1">{errors.displayName}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.username')}</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder={t('auth.usernamePlaceholder')} className="w-full bg-input rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all" maxLength={30} />
                {errors.username && <p className="text-destructive text-xs mt-1">{errors.username}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">{t('auth.usernameHint')}</p>
              </div>
            </div>
          )}

          {step === 'birthday' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">{t('auth.stepBirthday')}</h2>
                <p className="text-sm text-muted-foreground">{t('auth.stepBirthdayDesc')}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.day')}</label>
                  <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className={selectClass}>
                    <option value="">{t('auth.day')}</option>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.month')}</label>
                  <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className={selectClass}>
                    <option value="">{t('auth.month')}</option>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.year')}</label>
                  <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className={selectClass}>
                    <option value="">{t('auth.year')}</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              {errors.birthday && <p className="text-destructive text-xs mt-1">{errors.birthday}</p>}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {t('auth.ageRestrictionHint')}
              </p>
            </div>
          )}

          {step === 'avatar' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">{t('auth.stepAvatar')}</h2>
                <p className="text-sm text-muted-foreground">{t('auth.stepAvatarDesc')}</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-28 h-28 rounded-full object-cover border-4 border-primary/20" />
                  ) : (
                    <div className="w-28 h-28 rounded-full bg-secondary flex items-center justify-center border-4 border-border">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
                <p className="text-xs text-muted-foreground">{t('auth.avatarHint')}</p>
                {errors.avatar && <p className="text-destructive text-xs">{errors.avatar}</p>}
              </div>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">{t('auth.stepPassword')}</h2>
                <p className="text-sm text-muted-foreground">{t('auth.stepPasswordDesc')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.password')}</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-input rounded-lg px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-destructive text-xs mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-input rounded-lg px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-destructive text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>
          )}

          {step === 'email' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">{t('auth.stepEmail')}</h2>
                <p className="text-sm text-muted-foreground">{t('auth.stepEmailDesc')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">{t('auth.email')}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="w-full bg-input rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all" maxLength={255} />
                {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-8">
            {step !== 'names' && (
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                {t('auth.back')}
              </button>
            )}
            {step === 'avatar' && (
              <button onClick={() => setStep('password')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward className="w-4 h-4" />
                {t('auth.skipStep')}
              </button>
            )}
            <button onClick={handleNext} disabled={loading} className="ml-auto flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {step === 'email' ? t('auth.registerButton') : t('auth.continueButton')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('auth.hasAccount')}{' '}
          <Link to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} className="text-primary hover:underline font-medium">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
