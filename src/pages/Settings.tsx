import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, X, User, Shield, Megaphone, Camera, ExternalLink, Pencil, Check, XIcon, Calendar, Lock, Globe, Monitor, Sun, Moon as MoonIcon, QrCode, ShieldCheck, ArrowLeft, Crown, Star, Zap, Mic, Volume2, MessageCircle, Bell, Info, Gem, Activity, Laptop, Database, Palette, Video, Code2, Server, GitBranch, Sparkles, Download, CheckCircle2 } from 'lucide-react';
import ConnectedDevices from '@/components/ConnectedDevices';
import auroraIcon from '@/assets/logo.jpg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePresenceKeeper } from '@/hooks/usePresenceKeeper';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { changelogData } from '@/data/changelogData';
import { useTranslation } from '@/i18n';
import { LANGUAGES, type Language } from '@/i18n';
import AvatarCropModal from '@/components/AvatarCropModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const PasswordChangeSection = () => {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return; }
    if (newPassword !== confirmPassword) { toast.error('Şifreler eşleşmiyor'); return; }
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChanging(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Şifre başarıyla güncellendi');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Şifre Değiştir</p>
      </div>
      <p className="text-xs text-muted-foreground">Hesabınızın güvenliği için şifrenizi değiştirin.</p>
      <div className="space-y-2">
        <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Yeni şifre" className="bg-input border-border" />
        <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Yeni şifre (tekrar)" className="bg-input border-border" />
      </div>
      <Button size="sm" onClick={handleChangePassword} disabled={changing || !newPassword || !confirmPassword}>
        {changing ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : 'Şifreyi Güncelle'}
      </Button>
    </div>
  );
};

const TwoFactorSection = () => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableOtp, setDisableOtp] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [qrUri, setQrUri] = useState('');
  const [factorId, setFactorId] = useState('');
  // useRef keeps the factorId accessible in callbacks without stale closure
  const factorIdRef = useRef('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Helper: get all TOTP factors (verified + unverified) from listFactors response
  // Supabase sometimes puts unverified factors only in .all, not in .totp
  const getAllTotpFactors = (data: any) => {
    const fromAll = (data?.all ?? []).filter((f: any) => f.factor_type === 'totp' || f.type === 'totp');
    const fromTotp = data?.totp ?? [];
    const map = new Map<string, any>();
    [...fromAll, ...fromTotp].forEach((f: any) => map.set(f.id, f));
    return Array.from(map.values());
  };

  const setFactor = (id: string) => {
    factorIdRef.current = id;
    setFactorId(id);
  };

  useEffect(() => {
    const checkMFA = async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const allTotp = getAllTotpFactors(data);
      setIs2FAEnabled(allTotp.some((f: any) => f.status === 'verified'));
    };
    checkMFA();
  }, []);

  // Auto-verify enrollment when 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && showDialog && !verifying) {
      handleVerify(otp);
    }
  }, [otp, showDialog]);

  // Auto-verify disable when 6 digits are entered
  useEffect(() => {
    if (disableOtp.length === 6 && showDisableDialog && !disabling) {
      handleConfirmDisable(disableOtp);
    }
  }, [disableOtp, showDisableDialog]);

  // Unenroll a factor by ID — best effort, logs error
  const unenrollFactor = async (id: string) => {
    if (!id) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) console.warn('unenrollFactor error:', id, error.message);
    } catch (e) {
      console.warn('unenrollFactor exception:', e);
    }
  };

  // When enrollment dialog closes without completing — delete the pending unverified factor
  const handleEnrollDialogClose = async () => {
    setShowDialog(false);
    setQrUri('');
    setOtp('');
    setOtpError('');
    // Use ref to always get the current factorId (avoids stale closure)
    const pendingId = factorIdRef.current;
    if (pendingId) {
      factorIdRef.current = '';
      setFactorId('');
      await unenrollFactor(pendingId);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);

    // Step 1: Clean up ALL unverified TOTP factors visible via listFactors
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const allTotp = getAllTotpFactors(factors);
      const unverified = allTotp.filter((f: any) => f.status !== 'verified');
      for (const f of unverified) {
        await unenrollFactor(f.id);
      }
    } catch (err) {
      console.warn('MFA cleanup error:', err);
    }

    // Step 2: Enroll with a UNIQUE timestamp-based friendly name to guarantee no 422 conflict
    // Even if a previous unverified factor could not be cleaned up, the unique name avoids collision
    const uniqueName = `AC-${Date.now()}`;
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'AuroraChat',
      friendlyName: uniqueName,
    });
    setEnrolling(false);

    if (error) {
      toast.error('2FA etkinleştirilemedi: ' + error.message);
      console.error('MFA enroll error:', error);
      return;
    }

    if (data) {
      setQrUri(data.totp.uri);
      setFactor(data.id);  // updates both state and ref
      setOtp('');
      setOtpError('');
      setShowDialog(true);
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code ?? otp;
    if (otpCode.length !== 6 || verifying) return;
    // Use ref to ensure we always have the current factorId
    const currentFactorId = factorIdRef.current || factorId;
    if (!currentFactorId) return;
    setVerifying(true);
    setOtpError('');
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: currentFactorId });
    if (challengeError) {
      setOtpError(challengeError.message || 'Doğrulama başlatılamadı.');
      setVerifying(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: currentFactorId,
      challengeId: challenge.id,
      code: otpCode,
    });
    setVerifying(false);
    if (verifyError) {
      setOtpError('Doğrulama kodu hatalı veya süresi dolmuş. Tekrar deneyin.');
      setOtp('');
      return;
    }
    toast.success(t('settings.twoFactorEnabled'));
    setIs2FAEnabled(true);
    setShowDialog(false);
    factorIdRef.current = '';
    setFactorId('');
    setQrUri('');
    setOtp('');
    setOtpError('');
  };

  const handleUnenroll = () => {
    setDisableOtp('');
    setDisableError('');
    setShowDisableDialog(true);
  };

  const handleConfirmDisable = async (code?: string) => {
    const otpCode = code ?? disableOtp;
    if (otpCode.length !== 6 || disabling) return;
    setDisabling(true);
    setDisableError('');
    try {
      // Find verified TOTP factor — check both .totp and .all
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const allTotp = getAllTotpFactors(factors);
      const factor = allTotp.find((f: any) => f.status === 'verified');
      if (!factor) {
        setDisableError('2FA faktörü bulunamadı. Lütfen sayfayı yenileyin.');
        setDisabling(false);
        return;
      }

      // Challenge + verify to reach AAL2
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) {
        setDisableError(challengeError.message || 'Doğrulama başlatılamadı.');
        setDisabling(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: otpCode,
      });
      if (verifyError) {
        setDisableError('Doğrulama kodu hatalı veya süresi dolmuş. Tekrar deneyin.');
        setDisableOtp('');
        setDisabling(false);
        return;
      }

      // Now at AAL2 — unenroll
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) {
        setDisableError(unenrollError.message || '2FA kapatılamadı.');
        setDisabling(false);
        return;
      }

      toast.success(t('settings.twoFactorDisabled'));
      setIs2FAEnabled(false);
      setShowDisableDialog(false);
      setDisableOtp('');
    } catch {
      setDisableError('2FA kapatılırken beklenmeyen hata oluştu.');
    } finally {
      setDisabling(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{t('settings.twoFactor')}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.twoFactorDesc')}</p>
        {is2FAEnabled ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-status-online font-medium">
              <ShieldCheck className="w-4 h-4" />
              {t('settings.twoFactorActive')}
            </div>
            <Button variant="outline" size="sm" onClick={handleUnenroll}>{t('settings.twoFactorDisable')}</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={handleEnroll} disabled={enrolling}>
            {enrolling ? <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" /> : t('settings.twoFactorEnable')}
          </Button>
        )}
      </div>

      {/* 2FA Enrollment Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) handleEnrollDialogClose(); }}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              {t('settings.twoFactorSetup')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.twoFactorScanQR')}</p>
            {qrUri && (
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                  alt="TOTP QR Code"
                  className="w-48 h-48"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">{t('settings.twoFactorEnterCode')}</p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={verifying}>
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
            {otpError && (
              <p className="text-destructive text-xs text-center bg-destructive/10 rounded-lg px-3 py-2">{otpError}</p>
            )}
            <Button onClick={() => handleVerify()} disabled={verifying || otp.length !== 6} className="w-full">
              {verifying ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Doğrulanıyor...
                </div>
              ) : t('settings.twoFactorVerify')}
            </Button>
            <button
              onClick={handleEnrollDialogClose}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              İptal et
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={(open) => { if (!open) { setShowDisableDialog(false); setDisableOtp(''); setDisableError(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-destructive" />
              İki Faktörlü Doğrulamayı Kapat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              2FA'yı kapatmak için kimliğinizi doğrulamanız gerekiyor. Kimlik doğrulayıcı uygulamanızdan mevcut kodu girin.
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={disableOtp} onChange={setDisableOtp} disabled={disabling}>
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
            {disableError && (
              <p className="text-destructive text-xs text-center bg-destructive/10 rounded-lg px-3 py-2">{disableError}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDisableDialog(false); setDisableOtp(''); setDisableError(''); }}>
                İptal
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleConfirmDisable()} disabled={disabling || disableOtp.length !== 6}>
                {disabling ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                    İşleniyor...
                  </div>
                ) : '2FA\'yı Kapat'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const CustomStatusSection = () => {
  const { user } = useAuth();
  const [customStatus, setCustomStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('custom_status').eq('id', user.id).single().then(({ data }) => {
      if (data?.custom_status) setCustomStatus(data.custom_status);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ custom_status: customStatus || null } as any).eq('id', user.id);
    setSaving(false);
    toast.success('Özel durum güncellendi');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Özel Durum</p>
      </div>
      <p className="text-xs text-muted-foreground">Profilinizde görünecek özel durum mesajınız.</p>
      <div className="flex gap-2">
        <Input value={customStatus} onChange={e => setCustomStatus(e.target.value)} placeholder="Müzik dinliyor 🎵" className="bg-input border-border flex-1" maxLength={128} />
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Kaydet'}</Button>
      </div>
      {customStatus && (
        <Button variant="ghost" size="sm" onClick={async () => { setCustomStatus(''); if (user) { await supabase.from('profiles').update({ custom_status: null } as any).eq('id', user.id); toast.success('Özel durum kaldırıldı'); } }}>Temizle</Button>
      )}
    </div>
  );
};

const AudioDeviceSection = () => {
  const { user } = useAuth();
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState(() => localStorage.getItem('audio_input_device') || '');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('audio_output_device') || '');
  const [notifVolume, setNotifVolume] = useState(() => Number(localStorage.getItem('notif_volume') || '50'));
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));
      } catch { /* permission denied */ }
    };
    loadDevices();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadFromDb = async () => {
      const { data } = await supabase.from('profiles').select('audio_settings').eq('id', user.id).maybeSingle();
      const settings = (data as any)?.audio_settings;
      if (settings) {
        if (settings.audio_input_device !== undefined) { setSelectedInput(settings.audio_input_device); localStorage.setItem('audio_input_device', settings.audio_input_device); }
        if (settings.audio_output_device !== undefined) { setSelectedOutput(settings.audio_output_device); localStorage.setItem('audio_output_device', settings.audio_output_device); }
        if (settings.notif_volume !== undefined) { setNotifVolume(settings.notif_volume); localStorage.setItem('notif_volume', String(settings.notif_volume)); }
      }
    };
    loadFromDb();
  }, [user?.id]);

  const persistSettings = useCallback((input: string, output: string, volume: number) => {
    localStorage.setItem('audio_input_device', input);
    localStorage.setItem('audio_output_device', output);
    localStorage.setItem('notif_volume', String(volume));
    if (!user) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from('profiles').update({ audio_settings: { audio_input_device: input, audio_output_device: output, notif_volume: volume } } as any).eq('id', user.id);
      setSaving(false);
    }, 600);
  }, [user]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Ses Ayarları</p>
        {saving && <span className="text-[10px] text-muted-foreground ml-auto animate-pulse">Kaydediliyor...</span>}
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Giriş Cihazı (Mikrofon)</label>
          <select value={selectedInput} onChange={e => { setSelectedInput(e.target.value); persistSettings(e.target.value, selectedOutput, notifVolume); }} className="w-full text-sm bg-input border border-border rounded px-2 py-1.5 text-foreground mt-1">
            <option value="">Varsayılan</option>
            {audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Çıkış Cihazı (Hoparlör)</label>
          <select value={selectedOutput} onChange={e => { setSelectedOutput(e.target.value); persistSettings(selectedInput, e.target.value, notifVolume); }} className="w-full text-sm bg-input border border-border rounded px-2 py-1.5 text-foreground mt-1">
            <option value="">Varsayılan</option>
            {audioOutputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Hoparlör ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Bildirim Sesi: {notifVolume}%</label>
          </div>
          <input type="range" min={0} max={100} value={notifVolume} onChange={e => { const v = Number(e.target.value); setNotifVolume(v); persistSettings(selectedInput, selectedOutput, v); }} className="w-full mt-1 accent-primary" />
        </div>
      </div>
    </div>
  );
};

const PremiumTab = ({ profile, refreshProfile, user }: { profile: any; refreshProfile: () => Promise<void>; user: any }) => {
  const now = new Date();
  const premiumExpires = profile?.premium_expires_at ? new Date(profile.premium_expires_at) : null;
  const basicExpires = profile?.basic_expires_at ? new Date(profile.basic_expires_at) : null;
  const isPremiumActive = profile?.is_premium && premiumExpires ? premiumExpires > now : profile?.is_premium;
  const isBasicActive = profile?.has_basic_badge && basicExpires ? basicExpires > now : profile?.has_basic_badge;
  const [claimingBasic, setClaimingBasic] = useState(false);
  const [claimingPremium, setClaimingPremium] = useState(false);

  const claimBasic = async () => {
    if (!user) return;
    if (isBasicActive) { toast.info('Basic üyeliğiniz zaten aktif.'); return; }
    setClaimingBasic(true);
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 1);
    const { error } = await supabase.from('profiles').update({
      has_basic_badge: true,
      basic_expires_at: expires.toISOString(),
    }).eq('id', user.id);
    setClaimingBasic(false);
    if (error) { toast.error('Bir hata oluştu.'); return; }
    await refreshProfile();
    toast.success('🌟 Basic üyelik 1 aylığına aktif edildi!');
  };

  const claimPremium = async () => {
    if (!user) return;
    if (isPremiumActive) { toast.info('Premium üyeliğiniz zaten aktif.'); return; }
    setClaimingPremium(true);
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 1);
    const { error } = await supabase.from('profiles').update({
      is_premium: true,
      has_premium_badge: true,
      has_basic_badge: true,
      premium_expires_at: expires.toISOString(),
      basic_expires_at: expires.toISOString(),
    }).eq('id', user.id);
    setClaimingPremium(false);
    if (error) { toast.error('Bir hata oluştu.'); return; }
    await refreshProfile();
    toast.success('⚡ Premium üyelik 1 aylığına aktif edildi!');
  };

  const basicFeatures = [
    { icon: Star,        text: 'Profil Basic rozeti' },
    { icon: Download,    text: '20 MB dosya yükleme limiti' },
    { icon: Palette,     text: 'Özel profil rengi' },
    { icon: MessageCircle, text: 'DM geçmişi sınırsız' },
  ];
  const premiumFeatures = [
    { icon: CheckCircle2, text: 'Tüm Basic özellikleri' },
    { icon: Zap,          text: 'Profil Premium rozeti' },
    { icon: Camera,       text: 'Animasyonlu avatar desteği' },
    { icon: Palette,      text: 'Özel profil banner' },
    { icon: Download,     text: '50 MB dosya yükleme limiti' },
    { icon: Activity,     text: 'Öncelikli destek' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Crown className="w-6 h-6 text-status-idle" />
          AuroraChat Premium
        </h2>
        <p className="text-sm text-muted-foreground mt-1">AuroraChat deneyiminizi bir üst seviyeye taşıyın.</p>
      </div>

      {/* Active badge */}
      {(isPremiumActive || isBasicActive) && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${isPremiumActive ? 'border-status-idle/40 bg-status-idle/10' : 'border-primary/30 bg-primary/10'}`}>
          {isPremiumActive
            ? <Zap className="w-5 h-5 text-status-idle shrink-0" />
            : <Star className="w-5 h-5 text-primary shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${isPremiumActive ? 'text-status-idle' : 'text-primary'}`}>
              {isPremiumActive ? 'Premium Aktif' : 'Basic Aktif'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPremiumActive && premiumExpires
                ? `Bitiş tarihi: ${premiumExpires.toLocaleDateString('tr-TR')}`
                : isBasicActive && basicExpires
                ? `Bitiş tarihi: ${basicExpires.toLocaleDateString('tr-TR')}`
                : 'Süresiz aktif'}
            </p>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${isPremiumActive ? 'bg-status-idle/20 text-status-idle' : 'bg-primary/20 text-primary'}`}>
            {isPremiumActive ? 'PREMIUM' : 'BASIC'}
          </span>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Plan */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/70 to-primary/20" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Star className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Basic</h3>
            </div>
            {isBasicActive && !isPremiumActive && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">Aktif</span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">Ücretsiz</span>
            <span className="text-sm text-muted-foreground">/ 1 ay deneme</span>
          </div>
          <ul className="space-y-2.5">
            {basicFeatures.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="w-4 h-4 text-primary shrink-0" /> {text}
              </li>
            ))}
          </ul>
          <Button
            className="w-full"
            variant={isBasicActive && !isPremiumActive ? 'secondary' : 'outline'}
            disabled={claimingBasic || (isBasicActive && !isPremiumActive)}
            onClick={claimBasic}
            data-testid="button-claim-basic"
          >
            {claimingBasic ? 'Aktif ediliyor…' : isBasicActive && !isPremiumActive ? '✓ Zaten Aktif' : 'Basic Al (Ücretsiz)'}
          </Button>
        </div>

        {/* Premium Plan */}
        <div className="rounded-xl border-2 border-status-idle/40 bg-card p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-status-idle to-primary" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-status-idle/15 border border-status-idle/25 flex items-center justify-center">
                <Zap className="w-4 h-4 text-status-idle" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Premium</h3>
            </div>
            {isPremiumActive
              ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-status-idle/15 text-status-idle border border-status-idle/25">Aktif</span>
              : <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-status-idle/10 text-status-idle">Popüler</span>}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">Ücretsiz</span>
            <span className="text-sm text-muted-foreground">/ 1 ay deneme</span>
          </div>
          <ul className="space-y-2.5">
            {premiumFeatures.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="w-4 h-4 text-status-idle shrink-0" /> {text}
              </li>
            ))}
          </ul>
          <Button
            className="w-full bg-status-idle hover:bg-status-idle/90 text-white"
            disabled={claimingPremium || isPremiumActive}
            onClick={claimPremium}
            data-testid="button-claim-premium"
          >
            {claimingPremium ? 'Aktif ediliyor…' : isPremiumActive ? '✓ Zaten Aktif' : 'Premium Al (Ücretsiz)'}
          </Button>
        </div>
      </div>

      {/* Comparison table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30">
          <p className="text-sm font-semibold text-foreground">Özellik Karşılaştırması</p>
        </div>
        <div className="divide-y divide-border">
          {[
            { feature: 'Dosya yükleme limiti', free: '10 MB', basic: '20 MB', premium: '50 MB' },
            { feature: 'Profil rozeti', free: '—', basic: 'Basic', premium: 'Premium' },
            { feature: 'Özel banner', free: '—', basic: '—', premium: '✓' },
            { feature: 'Animasyonlu avatar', free: '—', basic: '—', premium: '✓' },
            { feature: 'Öncelikli destek', free: '—', basic: '—', premium: '✓' },
          ].map(({ feature, free, basic, premium }) => (
            <div key={feature} className="grid grid-cols-4 px-5 py-2.5 text-sm">
              <span className="text-muted-foreground">{feature}</span>
              <span className="text-center text-muted-foreground">{free}</span>
              <span className="text-center text-primary font-medium">{basic}</span>
              <span className="text-center text-status-idle font-medium">{premium}</span>
            </div>
          ))}
          <div className="grid grid-cols-4 px-5 py-2 text-[11px] text-muted-foreground bg-secondary/20">
            <span />
            <span className="text-center font-bold">Ücretsiz</span>
            <span className="text-center text-primary font-bold">Basic</span>
            <span className="text-center text-status-idle font-bold">Premium</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Settings = () => {
  const { profile, signOut, user, refreshProfile } = useAuth();
  usePresenceKeeper(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const urlTab = new URLSearchParams(location.search).get('tab');
  const activeTab = urlTab || (window.innerWidth < 768 ? '__menu__' : 'account');

  const setActiveTab = (tab: string) => {
    navigate(`/settings?tab=${tab}`, { replace: false });
  };
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingField, setEditingField] = useState<'display_name' | 'username' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [privacyAllowDM, setPrivacyAllowDM] = useState<boolean>(true);
  const [privacyFriendRequests, setPrivacyFriendRequests] = useState<string>('everyone');
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const tabs = [
    { id: 'account', label: t('settings.account'), icon: User },
    { id: 'privacy', label: t('settings.privacy'), icon: Shield },
    { id: 'devices', label: 'Bağlı Cihazlar', icon: Laptop },
    { id: 'appearance', label: t('settings.appearance'), icon: Globe },
    { id: 'notifications', label: 'Bildirimler', icon: Bell },
    { id: 'premium', label: 'AuroraChat Premium', icon: Crown },
    { id: 'download', label: 'Uygulamayı İndir', icon: Download },
    { id: 'changelog', label: t('settings.changelog'), icon: Megaphone },
    { id: 'about', label: 'Hakkında', icon: Info },
  ];

  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    if (profile && !privacyLoaded) {
      const allowDms = (profile as any).allow_dms !== false;
      const friendReqSetting = (profile as any).friend_request_setting || 'everyone';
      setPrivacyAllowDM(allowDms);
      setPrivacyFriendRequests(friendReqSetting);
      setPrivacyLoaded(true);
    }
  }, [profile, privacyLoaded]);

  const handlePrivacyAllowDMChange = async (value: boolean) => {
    if (!user) return;
    setPrivacyAllowDM(value);
    setSavingPrivacy(true);
    const { error } = await supabase.from('profiles').update({ allow_dms: value } as any).eq('id', user.id);
    setSavingPrivacy(false);
    if (error) { toast.error('Ayar kaydedilemedi'); setPrivacyAllowDM(!value); }
    else { toast.success('Gizlilik ayarı kaydedildi'); }
  };

  const handlePrivacyFriendRequestChange = async (value: string) => {
    if (!user) return;
    setPrivacyFriendRequests(value);
    setSavingPrivacy(true);
    const { error } = await supabase.from('profiles').update({ friend_request_setting: value } as any).eq('id', user.id);
    setSavingPrivacy(false);
    if (error) { toast.error('Ayar kaydedilemedi'); }
    else { toast.success('Gizlilik ayarı kaydedildi'); }
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be reselected
    e.target.value = '';
    if (!file.type.startsWith('image/')) { toast.error(t('settings.selectImage')); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error(t('settings.fileTooLarge')); return; }
    setCropFile(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    // Always upload as JPEG with a fixed path to avoid extension/content-type issues
    const path = `${user.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) {
      toast.error(t('settings.uploadFailed'));
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: publicUrl } as any).eq('id', user.id);
    setAvatarUrl(publicUrl);
    toast.success(t('settings.avatarUpdated'));
    setUploading(false);
    setCropFile(null);
  };

  const startEdit = (field: 'display_name' | 'username') => {
    setEditingField(field);
    setEditValue(field === 'display_name' ? (profile?.display_name || '') : (profile?.username || ''));
  };
  const cancelEdit = () => { setEditingField(null); setEditValue(''); };
  const saveEdit = async () => {
    if (!user || !editingField || !editValue.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ [editingField]: editValue.trim() } as any).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error(t('settings.updateFailed')); }
    else {
      toast.success(editingField === 'display_name' ? t('settings.displayNameUpdated') : t('settings.usernameUpdated'));
      setEditingField(null);
    }
  };

  const handleLanguageChange = async (lang: Language) => {
    if (!user) return;
    setSavingLang(true);
    const { error } = await supabase.from('profiles').update({ language: lang } as any).eq('id', user.id);
    setSavingLang(false);
    if (error) { toast.error(t('settings.languageError')); return; }
    toast.success(t('settings.languageSaved'));
    setTimeout(() => window.location.reload(), 500);
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Apply theme
    const root = document.documentElement;
    if (newTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else if (newTheme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) { root.classList.add('dark'); root.classList.remove('light'); }
      else { root.classList.add('light'); root.classList.remove('dark'); }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Oturum bulunamadı'); setDeleting(false); return; }

      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) {
        toast.error('Hesap silme başarısız oldu');
        setDeleting(false);
        return;
      }

      toast.success('Hesabınız silindi');
      await signOut();
      navigate('/login');
    } catch {
      toast.error('Hesap silme başarısız oldu');
      setDeleting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { editingField ? cancelEdit() : navigate('/'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, editingField]);

  const handleSignOut = async () => { await signOut(); };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(profile?.language === 'en' ? 'en-US' : profile?.language === 'de' ? 'de-DE' : profile?.language === 'ja' ? 'ja-JP' : profile?.language === 'ru' ? 'ru-RU' : profile?.language === 'az' ? 'az-AZ' : 'tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const themeOptions = [
    { value: 'dark', label: 'Koyu', icon: MoonIcon },
    { value: 'light', label: 'Açık', icon: Sun },
    { value: 'system', label: 'Sistem', icon: Monitor },
  ];

  // Mobile: Discord-style vertical list + sub-page
  if (isMobile && activeTab === '__menu__') {
    return (
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <div className="flex items-center gap-3 px-4 pb-3 border-b border-border bg-sidebar shrink-0" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <button onClick={() => navigate('/')} className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">{t('settings.title')}</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
          <div className="border-t border-border my-2 mx-4" />
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('auth.logout')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background text-foreground overflow-hidden">
      {isMobile && (
        <div className="flex items-center gap-3 px-4 pb-3 border-b border-border bg-sidebar shrink-0" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-semibold text-foreground">{tabs.find(t => t.id === activeTab)?.label || ''}</h1>
        </div>
      )}

      {!isMobile && (
        <div className="w-56 bg-sidebar flex flex-col items-end py-10 pr-2 pl-4 overflow-y-auto shrink-0">
          <div className="w-full space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2">{t('settings.title')}</p>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <div className="border-t border-border my-2" />
            <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-4 h-4" />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-full max-w-2xl py-6 md:py-10 px-4 md:px-10 overflow-y-auto">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">{t('settings.myAccount')}</h2>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center text-xl md:text-2xl font-bold text-primary-foreground shrink-0">
                        {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {uploading ? <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFileSelect} className="hidden" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground truncate">{profile?.display_name || t('common.user')}</p>
                    <p className="text-sm text-muted-foreground truncate">@{profile?.username || 'user'}</p>
                  </div>
                </div>
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase text-muted-foreground font-semibold mb-1">{t('settings.displayName')}</p>
                      {editingField === 'display_name' ? (
                        <div className="flex items-center gap-2">
                          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8 bg-input border-border text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
                          <button onClick={saveEdit} disabled={saving} className="text-primary hover:text-primary/80 shrink-0"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground shrink-0"><XIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{profile?.display_name || '—'}</p>
                      )}
                    </div>
                    {editingField !== 'display_name' && (
                      <button onClick={() => startEdit('display_name')} className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase text-muted-foreground font-semibold mb-1">{t('settings.username')}</p>
                      {editingField === 'username' ? (
                        <div className="flex items-center gap-2">
                          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8 bg-input border-border text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
                          <button onClick={saveEdit} disabled={saving} className="text-primary hover:text-primary/80 shrink-0"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground shrink-0"><XIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">@{profile?.username || '—'}</p>
                      )}
                    </div>
                    {editingField !== 'username' && (
                      <button onClick={() => startEdit('username')} className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground font-semibold mb-1">{t('settings.emailLabel')}</p>
                    <p className="text-sm text-foreground">{user?.email || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {user?.created_at ? formatDate(user.created_at) : '—'} {t('settings.memberSince')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Password Change */}
              <PasswordChangeSection />

              {/* Premium / Basic Status Card */}
              {(profile?.is_premium || profile?.has_basic_badge) && (
                <div className={`rounded-xl border p-4 md:p-5 space-y-2 ${profile?.is_premium ? 'border-status-idle/40 bg-gradient-to-r from-status-idle/10 to-primary/5' : 'border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5'}`}>
                  <div className="flex items-center gap-2">
                    {profile?.is_premium
                      ? <Zap className="w-5 h-5 text-status-idle drop-shadow-[0_0_6px_hsl(var(--status-idle)/0.8)]" />
                      : <Star className="w-5 h-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />}
                    <p className={`text-sm font-bold ${profile?.is_premium ? 'text-status-idle' : 'text-primary'}`}>
                      {profile?.is_premium ? 'AuroraChat Premium Aktif' : 'AuroraChat Basic Aktif'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {profile?.is_premium
                      ? `Premium üyeliğiniz aktif.${profile.premium_expires_at ? ` Bitiş: ${new Date(profile.premium_expires_at).toLocaleDateString('tr-TR')}` : ''}`
                      : `Basic üyeliğiniz aktif.${profile.basic_expires_at ? ` Bitiş: ${new Date(profile.basic_expires_at).toLocaleDateString('tr-TR')}` : ''}`}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-destructive/30 bg-card p-4 md:p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">{t('settings.deleteAccount')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.deleteAccountDesc')}</p>
                <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>{t('settings.deleteAccountButton')}</Button>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">{t('settings.privacySecurity')}</h2>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('settings.allowDM')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('settings.allowDMDesc')}</p>
                  </div>
                  <Switch checked={privacyAllowDM} disabled={savingPrivacy} onCheckedChange={handlePrivacyAllowDMChange} />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">{t('settings.friendRequests')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.friendRequestsDesc')}</p>
                <RadioGroup value={privacyFriendRequests} onValueChange={handlePrivacyFriendRequestChange} className="space-y-2">
                  <div className="flex items-center gap-3"><RadioGroupItem value="everyone" id="fr-everyone" disabled={savingPrivacy} /><Label htmlFor="fr-everyone" className="text-sm cursor-pointer">{t('settings.everyone')}</Label></div>
                  <div className="flex items-center gap-3"><RadioGroupItem value="friends" id="fr-friends" disabled={savingPrivacy} /><Label htmlFor="fr-friends" className="text-sm cursor-pointer">{t('settings.mutualFriends')}</Label></div>
                  <div className="flex items-center gap-3"><RadioGroupItem value="none" id="fr-none" disabled={savingPrivacy} /><Label htmlFor="fr-none" className="text-sm cursor-pointer">{t('settings.nobody')}</Label></div>
                </RadioGroup>
              </div>
              <TwoFactorSection />
              <div className="rounded-xl border border-border bg-card p-4 md:p-5">
                <button onClick={() => navigate('/privacy')} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t('settings.viewPrivacyPolicy')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Laptop className="w-5 h-5" />
                  Bağlı Cihazlar
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Hesabınıza giriş yapmış tüm cihazları görün ve yönetin.</p>
              </div>
              <ConnectedDevices />
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">{t('settings.appearance')}</h2>

              {/* Custom Status */}
              <CustomStatusSection />

              {/* Audio Devices */}
              <AudioDeviceSection />

              {/* Theme Picker */}
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Tema</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Uygulamanın görünümünü özelleştir</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleThemeChange(opt.value)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        theme === opt.value
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <opt.icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('settings.languageTitle')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('settings.languageDesc')}</p>
                </div>
                <div className="space-y-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      disabled={savingLang}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        profile?.language === lang.code
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'text-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <span className="font-medium">{lang.label}</span>
                      {profile?.language === lang.code && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'premium' && (
            <PremiumTab profile={profile} refreshProfile={refreshProfile} user={user} />
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Bildirimler
              </h2>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Masaüstü Bildirimleri</p>
                <div className="space-y-3">
                  {[
                    { key: 'notif_desktop', label: 'Masaüstü bildirimleri etkinleştir', desc: 'Yeni mesajlarda tarayıcı bildirimi al' },
                    { key: 'notif_sound', label: 'Bildirim sesi', desc: 'Yeni mesaj geldiğinde ses çal' },
                    { key: 'notif_dm', label: 'DM bildirimleri', desc: 'Doğrudan mesajlar için bildirim al' },
                    { key: 'notif_mention', label: '@mention bildirimleri', desc: 'Etiketlendiğinde bildirim al' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        defaultChecked={localStorage.getItem(key) !== 'false'}
                        onCheckedChange={(v) => localStorage.setItem(key, String(v))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground">Sunucu Bildirimleri</p>
                <div className="space-y-3">
                  {[
                    { key: 'notif_all_messages', label: 'Tüm mesajlar', desc: 'Tüm mesajlar için bildirim al' },
                    { key: 'notif_only_mentions', label: 'Sadece etiketlenmeler', desc: '@mention ve @everyone için bildirim al' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        defaultChecked={localStorage.getItem(key) !== 'false'}
                        onCheckedChange={(v) => localStorage.setItem(key, String(v))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">Sessiz Saatler</p>
                <p className="text-xs text-muted-foreground">Belirtilen saatler arasında bildirimleri otomatik olarak sessize al.</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Başlangıç</label>
                    <input type="time" defaultValue={localStorage.getItem('notif_quiet_start') || '22:00'} onChange={e => localStorage.setItem('notif_quiet_start', e.target.value)} className="w-full mt-1 bg-input border border-border rounded px-2 py-1.5 text-sm text-foreground" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Bitiş</label>
                    <input type="time" defaultValue={localStorage.getItem('notif_quiet_end') || '08:00'} onChange={e => localStorage.setItem('notif_quiet_end', e.target.value)} className="w-full mt-1 bg-input border border-border rounded px-2 py-1.5 text-sm text-foreground" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'download' && (
            <div className="space-y-5">
              {/* Hero */}
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/8 to-transparent" />
                <div className="relative px-6 py-8 flex flex-col items-center text-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl scale-110" />
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-primary/40 shadow-xl">
                      <img src={auroraIcon} alt="AuroraChat" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">AuroraChat Desktop</h3>
                    <p className="text-sm text-muted-foreground">Masaüstü uygulaması — daha hızlı, daha güçlü</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Masaüstü Uygulama Avantajları
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    'Tarayıcı sekmesi olmadan doğrudan masaüstünde çalışır',
                    'Sistem bildirimleri daha güvenilir şekilde çalışır',
                    'Arka planda ses kanalına bağlı kalabilirsiniz',
                    'Otomatik başlatma ile her zaman hazır',
                    'Özel pencere — AuroraChat\'a odaklanın',
                  ].map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Windows Download */}
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" /> Windows
                </p>

                {/* 64-bit */}
                <div className="space-y-2">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-500/8 border border-blue-500/20">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Monitor className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">AuroraChat-Windows-x64.zip</p>
                      <p className="text-xs text-muted-foreground">Windows 10/11 · 64-bit · ~131MB · v0.6.3</p>
                    </div>
                  </div>
                  <a
                    href="https://github.com/TurkYoshi1905/aurorachat-tr-beta/releases/download/v0.6.3/AuroraChat-Windows-x64.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="button-download-x64"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Windows 64-bit İndir (.zip)
                  </a>
                </div>

                {/* 32-bit */}
                <div className="space-y-2">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-purple-500/8 border border-purple-500/20">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                      <Monitor className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">AuroraChat-Windows-ia32.zip</p>
                      <p className="text-xs text-muted-foreground">Windows 7/8/10/11 · 32-bit · ~112MB · v0.6.3</p>
                    </div>
                  </div>
                  <a
                    href="https://github.com/TurkYoshi1905/aurorachat-tr-beta/releases/download/v0.6.3/AuroraChat-Windows-ia32.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="button-download-ia32"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Windows 32-bit İndir (.zip)
                  </a>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  ZIP'i açın, AuroraChat.exe dosyasını çalıştırın — kurulum gerekmez, taşınabilir uygulama.
                </p>
              </div>

              {/* System Requirements */}
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" /> Sistem Gereksinimleri
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {[
                    { label: 'İşletim Sistemi', value: 'Windows 7/8/10/11 (32/64-bit)' },
                    { label: 'RAM', value: 'En az 4 GB' },
                    { label: 'Disk', value: 'En az 300 MB' },
                    { label: 'İnternet', value: 'Aktif bağlantı gerekli' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-secondary/50 p-2">
                      <p className="font-medium text-foreground">{label}</p>
                      <p>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'changelog' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t('settings.changelog')}</h2>
                <button onClick={() => navigate('/changelog')} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  {t('settings.viewAll')} <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              {changelogData.slice(0, 3).map((release) => (
                <div key={release.version} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold">v{release.version}</span>
                    <span className="text-sm text-muted-foreground">{release.date}</span>
                  </div>
                  {release.sections.map((section) => (
                    <div key={section.title} className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <section.icon className={`w-4 h-4 ${section.color}`} />
                        <p className="text-sm font-semibold text-foreground">{section.title}</p>
                      </div>
                      <ul className="space-y-1.5 ml-6">
                        {section.items.map((item, i) => (<li key={i} className="text-sm text-muted-foreground list-disc">{item}</li>))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-5">
              {/* Hero Card */}
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/8 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--primary-rgb,99,102,241),0.15),transparent_70%)]" />
                <div className="relative px-6 py-8 flex flex-col items-center text-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl scale-110" />
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-primary/40 shadow-xl">
                      <img src={auroraIcon} alt="AuroraChat" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">AuroraChat</h3>
                    <div className="flex items-center justify-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
                        <Sparkles className="w-3 h-3" /> v0.7.8
                      </span>
                      <span className="text-xs text-muted-foreground">7 Nisan 2026</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                    Discord'dan esinlenerek geliştirilen gerçek zamanlı sohbet platformu. Sunucular, kanallar, doğrudan mesajlar, sesli/görüntülü odalar ve daha fazlası.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Tüm sistemler aktif</span>
                  </div>
                </div>
              </div>

              {/* Tech Stack */}
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" /> Teknoloji Yığını
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Code2, label: 'Frontend', value: 'React 19 + TypeScript', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: Database, label: 'Veritabanı', value: 'Supabase PostgreSQL', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { icon: Server, label: 'Realtime', value: 'Supabase Realtime', color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { icon: ShieldCheck, label: 'Auth', value: 'Supabase Auth + MFA', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                    { icon: Video, label: 'Ses / Video', value: 'LiveKit WebRTC', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { icon: Palette, label: 'Arayüz', value: 'Tailwind + Radix UI', color: 'text-pink-400', bg: 'bg-pink-500/10' },
                  ].map(({ icon: Icon, label, value, color, bg }) => (
                    <div key={label} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary/30 border border-border/50">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
                        <p className="text-xs text-foreground font-semibold truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Versions Timeline */}
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" /> Son Güncellemeler
                  </p>
                  <button onClick={() => setActiveTab('changelog')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    Tümünü gör <ExternalLink className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
                <div className="relative space-y-0">
                  {changelogData.slice(0, 4).map((r, i) => (
                    <div key={r.version} className="flex gap-3 pb-3 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${i === 0 ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb,99,102,241),0.6)]' : 'bg-border'}`} />
                        {i < changelogData.slice(0, 4).length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${i === 0 ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                            v{r.version}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{r.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{r.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer info */}
              <div className="rounded-xl border border-border bg-card/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Build</span>
                  <span className="text-xs font-mono font-semibold text-foreground">2026.04.06</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Supabase · Sydney</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {!isMobile && (
          <div className="py-10 pr-6 shrink-0">
            <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-1">ESC</p>
          </div>
        )}
      </div>

      {/* Delete Account Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hesabı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Hesabınız kalıcı olarak silinecek, mesajlarınız anonim olarak korunacaktır. Sahip olduğunuz sunucular silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Siliniyor...' : 'Hesabı Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avatar Crop Modal */}
      <AvatarCropModal
        file={cropFile}
        onClose={() => setCropFile(null)}
        onConfirm={handleCropConfirm}
        uploading={uploading}
      />
    </div>
  );
};

export default Settings;
