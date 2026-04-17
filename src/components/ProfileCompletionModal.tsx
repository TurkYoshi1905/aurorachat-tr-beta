import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Cake, User2, ChevronRight, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Erkek', emoji: '👨' },
  { value: 'female', label: 'Kadın', emoji: '👩' },
  { value: 'other', label: 'Diğer', emoji: '🧑' },
  { value: 'prefer_not_to_say', label: 'Belirtmek İstemiyorum', emoji: '🤐' },
];

interface Props {
  userId: string;
}

const ProfileCompletionModal = ({ userId }: Props) => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<'gender' | 'birthday'>('gender');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const dismissed = localStorage.getItem(`profile_completion_dismissed_${userId}`);
    if (dismissed) return;

    const check = async () => {
      const { data } = await (supabase.from('profiles') as any)
        .select('gender, birth_date')
        .eq('id', userId)
        .single();
      if (data && (!data.gender || !data.birth_date)) {
        setShow(true);
      }
      setChecked(true);
    };
    check();
  }, [userId]);

  const handleDismiss = () => {
    localStorage.setItem(`profile_completion_dismissed_${userId}`, 'true');
    setShow(false);
  };

  const handleSave = async () => {
    if (step === 'gender') {
      if (!gender) { toast.error('Lütfen bir seçenek seçin.'); return; }
      setStep('birthday');
      return;
    }

    setSaving(true);
    const updateData: Record<string, string> = {};
    if (gender) updateData.gender = gender;
    if (birthDate) updateData.birth_date = birthDate;

    const { error } = await (supabase.from('profiles') as any)
      .update(updateData)
      .eq('id', userId);
    setSaving(false);

    if (error) {
      toast.error('Kaydedilemedi, tekrar dene.');
      return;
    }

    toast.success('✅ Profilin güncellendi!');
    localStorage.setItem(`profile_completion_dismissed_${userId}`, 'true');
    setShow(false);
  };

  const maxDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().split('T')[0];
  })();

  const minDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 120);
    return d.toISOString().split('T')[0];
  })();

  if (!checked || !show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header gradient bar */}
            <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-accent" />

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
              title="Şimdi değil"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="p-6">
              {/* Icon + Title */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground leading-tight">Profilini Tamamla</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step === 'gender' ? 'Cinsiyetini belirle (isteğe bağlı)' : 'Doğum tarihini ekle (isteğe bağlı)'}
                  </p>
                </div>
              </div>

              {/* Step indicator */}
              <div className="flex gap-1.5 mb-5">
                <div className={`h-1 flex-1 rounded-full transition-colors ${step === 'gender' || step === 'birthday' ? 'bg-primary' : 'bg-secondary'}`} />
                <div className={`h-1 flex-1 rounded-full transition-colors ${step === 'birthday' ? 'bg-primary' : 'bg-secondary'}`} />
              </div>

              {/* Step: Gender */}
              {step === 'gender' && (
                <motion.div
                  key="gender"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    <User2 className="w-3.5 h-3.5" />
                    Cinsiyet
                  </div>
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGender(opt.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                        gender === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/30 text-foreground hover:border-border/80 hover:bg-secondary/50'
                      }`}
                    >
                      <span className="text-lg">{opt.emoji}</span>
                      <span>{opt.label}</span>
                      {gender === opt.value && (
                        <span className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                        </span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* Step: Birthday */}
              {step === 'birthday' && (
                <motion.div
                  key="birthday"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    <Cake className="w-3.5 h-3.5" />
                    Doğum Tarihi
                  </div>
                  <div className="rounded-xl border border-border bg-input p-1">
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      min={minDate}
                      max={maxDate}
                      className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none [color-scheme:dark]"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/60">
                    13 yaşından küçükler kayıt olamaz. Doğum tarihin gizlilik ayarından kontrol edilebilir.
                  </p>
                  {/* Back button */}
                  <button
                    onClick={() => setStep('gender')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Geri dön
                  </button>
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl text-xs"
                  onClick={handleDismiss}
                >
                  Şimdi Değil
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-xl text-xs gap-1"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      {step === 'gender' ? 'Devam Et' : 'Kaydet'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileCompletionModal;
