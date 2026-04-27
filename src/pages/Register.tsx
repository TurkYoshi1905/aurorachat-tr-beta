import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Sparkles, Camera, SkipForward, Calendar, User2, Shield, CheckCircle2, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import EmailSentModal from '@/components/EmailSentModal';

type Step = 'names' | 'birthday' | 'avatar' | 'password' | 'terms' | 'email';

const MONTHS = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Erkek', emoji: '♂️' },
  { value: 'female', label: 'Kadın', emoji: '♀️' },
  { value: 'other', label: 'Diğer', emoji: '⚧' },
  { value: 'prefer_not_to_say', label: 'Belirtmek İstemiyorum', emoji: '🤐' },
];

const TERMS_CONTENT = `AuroraChat Kullanım Koşulları

Son güncelleme: 17 Nisan 2026

1. KABUL

AuroraChat'i kullanarak bu koşulları kabul etmiş olursunuz. Bu koşulları kabul etmiyorsanız uygulamayı kullanmayın.

2. KULLANIM KURALLARI

• 13 yaş altı kullanıcılar platforma kayıt olamaz.
• Başka kullanıcılara taciz, tehdit veya zarar verici davranışlar yasaktır.
• Nefret söylemi, ırkçılık, ayrımcılık içeren içerikler paylaşılamaz.
• Uygunsuz (NSFW) içerik, herkese açık kanallarda paylaşılamaz.
• Spam, yanıltıcı bilgi ve kimlik avı girişimleri kesinlikle yasaktır.
• Başka kullanıcıların hesaplarına yetkisiz erişim yasaktır.

3. GİZLİLİK

Kişisel verileriniz (e-posta, kullanıcı adı, doğum tarihi, cinsiyet) yalnızca hizmet sunumu için kullanılır. Verileriniz üçüncü taraflarla paylaşılmaz. Gizlilik Politikamızı inceleyin.

4. İÇERİK

AuroraChat'te paylaştığınız içeriklerden tamamen sorumlusunuz. Telif hakkı ihlali içeren materyaller paylaşmayın.

5. HESAP GÜVENLİĞİ

Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmayın. Şüpheli aktivite tespit ederseniz bize bildirin.

6. ASKIYA ALMA VE SONLANDIRMA

Kurallara uymayan hesaplar uyarısız askıya alınabilir veya kalıcı olarak kapatılabilir.

7. DEĞİŞİKLİKLER

Bu koşullar önceden bildirim yapılmaksızın güncellenebilir. Güncel koşullar her zaman uygulama içinde mevcuttur.

8. İLETİŞİM

Sorularınız için uygulama içi destek kanalını kullanabilirsiniz.

AuroraChat ekibi olarak güvenli ve eğlenceli bir ortam sunmak için çalışıyoruz.`;

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [emailSentOpen, setEmailSentOpen] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const termsScrollRef = useRef<HTMLDivElement>(null);
  const [termsScrolled, setTermsScrolled] = useState(false);

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

  const handleTermsScroll = () => {
    const el = termsScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (atBottom) setTermsScrolled(true);
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
      if (!gender) e.gender = 'Cinsiyet seçimi zorunludur';
    }
    if (step === 'password') {
      if (password.length < 8) e.password = 'Şifre en az 8 karakter olmalı';
      else if (!/[A-Z]/.test(password) && !/[0-9]/.test(password)) e.password = 'Şifre en az bir büyük harf veya rakam içermeli';
      if (password !== confirmPassword) e.confirmPassword = t('auth.passwordMismatch');
    }
    if (step === 'terms') {
      if (!termsAccepted) e.terms = 'Devam etmek için koşulları kabul etmelisiniz';
    }
    if (step === 'email') {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('auth.invalidEmail');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { strength: score, label: 'Çok Zayıf', color: 'bg-red-500' };
    if (score === 2) return { strength: score, label: 'Zayıf', color: 'bg-orange-500' };
    if (score === 3) return { strength: score, label: 'Orta', color: 'bg-yellow-500' };
    if (score === 4) return { strength: score, label: 'Güçlü', color: 'bg-green-500' };
    return { strength: score, label: 'Çok Güçlü', color: 'bg-emerald-500' };
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
      setStep('terms');
    } else if (step === 'terms') {
      setStep('email');
    } else if (step === 'email') {
      setLoading(true);
      try {
        const birthDate = birthDay && birthMonth && birthYear
          ? `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
          : null;

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName, username, gender, birth_date: birthDate },
          },
        });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('password') || msg.includes('şifre')) {
            setStep('password');
            setErrors({ password: error.message });
          } else {
            setErrors({ email: error.message });
          }
          setLoading(false);
          return;
        }

        if (signUpData.user) {
          await supabase.from('profiles').update({
            gender: gender || null,
            birth_date: birthDate,
          } as any).eq('id', signUpData.user.id);

          if (avatarFile) {
            const ext = avatarFile.name.split('.').pop();
            const path = `${signUpData.user.id}/avatar.${ext}`;
            await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
            await supabase.from('profiles').update({ avatar_url: urlData.publicUrl } as any).eq('id', signUpData.user.id);
          }
        }

        setSubmittedEmail(email);
        setEmailSentOpen(true);
      } catch {
        setErrors({ email: t('auth.genericError') });
      }
      setLoading(false);
    }
  };

  const goToLogin = () => {
    setEmailSentOpen(false);
    navigate(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login');
  };

  const handleBack = () => {
    const order: Step[] = ['names', 'birthday', 'avatar', 'password', 'terms', 'email'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const steps: Step[] = ['names', 'birthday', 'avatar', 'password', 'terms', 'email'];
  const currentIndex = steps.indexOf(step);
  const pwStrength = getPasswordStrength();

  const selectClass = "w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none border border-border/50 focus:border-primary/50";

  const stepTitles: Record<Step, { title: string; desc: string; icon: any }> = {
    names: { title: 'Kendini tanıt', desc: 'Diğer kullanıcıların seni göreceği isim', icon: User2 },
    birthday: { title: 'Kişisel Bilgiler', desc: 'Doğum tarihin ve cinsiyetin', icon: Calendar },
    avatar: { title: 'Profil Fotoğrafı', desc: 'Bir fotoğraf ekle (isteğe bağlı)', icon: Camera },
    password: { title: 'Şifreni Belirle', desc: 'Güçlü ve güvenli bir şifre seç', icon: Shield },
    terms: { title: 'Kullanım Koşulları', desc: 'Lütfen koşulları okuyun ve kabul edin', icon: ScrollText },
    email: { title: 'E-posta Adresin', desc: 'Doğrulama bağlantısı göndereceğiz', icon: CheckCircle2 },
  };

  const { title, desc, icon: StepIcon } = stepTitles[step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">AuroraChat</h1>
          </div>
          <p className="text-sm text-muted-foreground">Yeni hesap oluştur</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i < currentIndex ? 'bg-primary' :
                i === currentIndex ? 'bg-primary/70' :
                'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl border border-border/60 overflow-hidden">
          {/* Step header */}
          <div className="px-6 pt-6 pb-5 border-b border-border/40 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
              <StepIcon className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <span className="ml-auto text-xs text-muted-foreground font-medium">{currentIndex + 1}/{steps.length}</span>
          </div>

          <div className="p-6">
            {step === 'names' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t('auth.displayName')}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('auth.displayNamePlaceholder')}
                    className="w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border/50 focus:border-primary/50"
                    maxLength={50}
                  />
                  {errors.displayName && <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.displayName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t('auth.username')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder={t('auth.usernamePlaceholder')}
                      className="w-full bg-input rounded-xl pl-7 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border/50 focus:border-primary/50"
                      maxLength={30}
                    />
                  </div>
                  {errors.username && <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.username}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1.5">{t('auth.usernameHint')}</p>
                </div>
              </div>
            )}

            {step === 'birthday' && (
              <div className="space-y-5">
                {/* Birthday */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Doğum Tarihi
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1.5">{t('auth.day')}</label>
                      <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} className={selectClass}>
                        <option value="">{t('auth.day')}</option>
                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1.5">{t('auth.month')}</label>
                      <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} className={selectClass}>
                        <option value="">{t('auth.month')}</option>
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1.5">{t('auth.year')}</label>
                      <select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className={selectClass}>
                        <option value="">{t('auth.year')}</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  {errors.birthday && <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.birthday}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {t('auth.ageRestrictionHint')}
                  </p>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <User2 className="w-3.5 h-3.5" /> Cinsiyet
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGender(opt.value)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                          gender === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/50 bg-input text-foreground hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <span className="text-base">{opt.emoji}</span>
                        <span className="text-xs leading-tight">{opt.label}</span>
                        {gender === opt.value && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0 text-primary" />}
                      </button>
                    ))}
                  </div>
                  {errors.gender && <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.gender}</p>}
                </div>
              </div>
            )}

            {step === 'avatar' && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-28 h-28 rounded-full object-cover border-4 border-primary/30 shadow-lg shadow-primary/10" />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-secondary flex items-center justify-center border-4 border-border shadow-inner">
                        <Camera className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-7 h-7 text-white" />
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Profil fotoğrafı yükle</p>
                    <p className="text-xs text-muted-foreground mt-1">Desteklenen formatlar: JPG, PNG, GIF (maks. 5MB)</p>
                  </div>
                  {errors.avatar && <p className="text-destructive text-xs">{errors.avatar}</p>}
                </div>
              </div>
            )}

            {step === 'password' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t('auth.password')}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="En az 8 karakter"
                      className="w-full bg-input rounded-xl px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border/50 focus:border-primary/50"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength meter */}
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= pwStrength.strength ? pwStrength.color : 'bg-border'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-[11px] font-medium ${
                        pwStrength.strength <= 1 ? 'text-red-400' :
                        pwStrength.strength === 2 ? 'text-orange-400' :
                        pwStrength.strength === 3 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        Şifre güvenliği: {pwStrength.label}
                      </p>
                    </div>
                  )}
                  {errors.password && <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.password}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t('auth.confirmPassword')}</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Şifreni tekrarla"
                      className="w-full bg-input rounded-xl px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border/50 focus:border-primary/50"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Şifreler eşleşiyor</p>
                  )}
                  {errors.confirmPassword && <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.confirmPassword}</p>}
                </div>
                <div className="bg-secondary/30 rounded-xl p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">Güçlü bir şifre için:</p>
                  {[
                    { check: password.length >= 8, text: 'En az 8 karakter' },
                    { check: /[A-Z]/.test(password), text: 'En az bir büyük harf' },
                    { check: /[0-9]/.test(password), text: 'En az bir rakam' },
                    { check: /[^A-Za-z0-9]/.test(password), text: 'Özel karakter (!@#$...)' },
                  ].map(({ check, text }) => (
                    <div key={text} className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${check ? 'bg-green-400' : 'bg-border'}`} />
                      <span className={`text-[11px] ${check ? 'text-green-400' : 'text-muted-foreground/60'}`}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'terms' && (
              <div className="space-y-4">
                <div
                  ref={termsScrollRef}
                  onScroll={handleTermsScroll}
                  className="h-52 overflow-y-auto rounded-xl bg-secondary/30 border border-border/50 p-3 text-xs text-muted-foreground leading-relaxed space-y-2 whitespace-pre-line scroll-smooth"
                >
                  {TERMS_CONTENT}
                </div>
                {!termsScrolled && (
                  <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                    <ScrollText className="w-3 h-3" /> Devam edebilmek için koşulları aşağıya kaydırarak okuyun
                  </p>
                )}
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  termsAccepted ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-card hover:border-primary/20'
                } ${!termsScrolled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    termsAccepted ? 'border-primary bg-primary' : 'border-border'
                  }`}>
                    {termsAccepted && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={!termsScrolled}
                  />
                  <span className="text-xs text-foreground leading-relaxed">
                    <span className="font-medium">AuroraChat Kullanım Koşulları</span>'nı okudum ve kabul ediyorum.{' '}
                    <Link to="/privacy" target="_blank" className="text-primary hover:underline">Gizlilik Politikası</Link>'nı da kabul etmiş sayılırım.
                  </span>
                </label>
                {errors.terms && <p className="text-destructive text-xs flex items-center gap-1">⚠ {errors.terms}</p>}
              </div>
            )}

            {step === 'email' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t('auth.email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                    className="w-full bg-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border/50 focus:border-primary/50"
                    maxLength={255}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">⚠ {errors.email}</p>}
                </div>
                <div className="bg-secondary/30 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">Neredeyse bitti! 🎉</p>
                  <p>E-posta adresine bir doğrulama bağlantısı göndereceğiz. Lütfen spam klasörünü de kontrol et.</p>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center gap-3 mt-6">
              {step !== 'names' && (
                <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-secondary/50">
                  <ArrowLeft className="w-4 h-4" />
                  {t('auth.back')}
                </button>
              )}
              {step === 'avatar' && (
                <button onClick={() => setStep('password')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-secondary/50">
                  <SkipForward className="w-4 h-4" />
                  {t('auth.skipStep')}
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={loading || (step === 'terms' && !termsAccepted)}
                className="ml-auto flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {step === 'email' ? 'Kayıt Ol' : 'Devam Et'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('auth.hasAccount')}{' '}
          <Link to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} className="text-primary hover:underline font-semibold">
            {t('auth.login')}
          </Link>
        </p>
      </div>

      <EmailSentModal
        open={emailSentOpen}
        email={submittedEmail}
        onClose={() => setEmailSentOpen(false)}
        onGoToLogin={goToLogin}
      />
    </div>
  );
};

export default Register;
