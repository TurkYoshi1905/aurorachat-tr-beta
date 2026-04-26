import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User2, User, Users, CircleHelp, ShieldAlert, Clock, Info, AlertTriangle, Check } from 'lucide-react';

interface ChangeGenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue: string | null;
  onSaved: () => void;
}

type GenderKey = 'male' | 'female' | 'other' | 'prefer_not_to_say';

const OPTIONS: { key: GenderKey; label: string; description: string; icon: typeof User2; tone: string }[] = [
  { key: 'male', label: 'Erkek', description: 'Erkek olarak görüneceksin.', icon: User, tone: 'text-blue-400' },
  { key: 'female', label: 'Kadın', description: 'Kadın olarak görüneceksin.', icon: Users, tone: 'text-pink-400' },
  { key: 'other', label: 'Diğer', description: 'Diğer / belirtilmemiş bir cinsiyet.', icon: User2, tone: 'text-purple-400' },
  { key: 'prefer_not_to_say', label: 'Belirtmek istemiyorum', description: 'Profilinde cinsiyet gösterilmeyecek.', icon: CircleHelp, tone: 'text-muted-foreground' },
];

const ChangeGenderModal = ({ open, onOpenChange, currentValue, onSaved }: ChangeGenderModalProps) => {
  const { user } = useAuth();
  const [value, setValue] = useState<GenderKey | ''>('');
  const [count, setCount] = useState(0);
  const [nextResetAt, setNextResetAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const remaining = Math.max(0, 2 - count);
  const canChange = remaining > 0;

  const fetchUsage = async () => {
    if (!user) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: c, data } = await (supabase.from('profile_change_log') as any)
      .select('changed_at', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('field', 'gender')
      .gte('changed_at', since)
      .order('changed_at', { ascending: true });
    setCount(c || 0);
    if (data && data.length > 0 && (c || 0) >= 2) {
      const oldest = new Date(data[0].changed_at);
      setNextResetAt(new Date(oldest.getTime() + 7 * 24 * 60 * 60 * 1000));
    } else {
      setNextResetAt(null);
    }
  };

  useEffect(() => {
    if (open) {
      setValue((currentValue as GenderKey) || '');
      setErr(null);
      fetchUsage();
    }
  }, [open, currentValue]);

  const handleSave = async () => {
    if (!user || !value) return;
    setErr(null);
    setSaving(true);
    const { error } = await (supabase.rpc as any)('change_gender', { p_value: value });
    setSaving(false);
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('weekly_limit') || msg.includes('limit')) {
        setErr('Bu hafta için değişiklik limitinize ulaştınız (haftada en fazla 2).');
        await fetchUsage();
      } else if (msg.includes('invalid')) {
        setErr('Geçerli bir cinsiyet seçiniz.');
      } else {
        setErr(error.message || 'Bir hata oluştu.');
      }
      return;
    }
    toast.success('Cinsiyet güncellendi.');
    onOpenChange(false);
    onSaved();
  };

  const formatReset = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const isUnchanged = value === (currentValue || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background border-border">
        {/* Hero */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-pink-500/15 via-purple-500/10 to-transparent border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
              <User2 className="w-6 h-6 text-pink-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogHeader className="space-y-1.5 text-left">
                <DialogTitle className="text-lg font-bold tracking-tight">Doğru Cinsiyetinizi Girin</DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                  Profilinde görünecek cinsiyeti seç. Bu bilgi gizlilik ayarına göre başkalarına gösterilebilir; yanlış girilmesi başka kullanıcılarda kafa karışıklığı yaratabilir.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Quota banner */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${canChange ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/8 border-amber-500/30 text-amber-400'}`}>
            <Clock className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">
                {canChange ? `Bu hafta ${remaining}/2 değişiklik hakkın kaldı.` : 'Bu hafta için limitin doldu.'}
              </p>
              {!canChange && nextResetAt && (
                <p className="text-[11px] opacity-80">Sıfırlanma: {formatReset(nextResetAt)}</p>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Seçenekler</Label>
            <div className="grid grid-cols-1 gap-2">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = value === opt.key;
                return (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => canChange && setValue(opt.key)}
                    disabled={!canChange}
                    className={`group flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                      selected
                        ? 'bg-primary/12 border-primary/50 ring-1 ring-primary/40 shadow-sm'
                        : 'bg-card hover:bg-secondary/50 border-border'
                    } ${!canChange ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-primary/20' : 'bg-secondary/60'}`}>
                      <Icon className={`w-4.5 h-4.5 ${opt.tone}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{opt.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-primary bg-primary' : 'border-border'}`}>
                      {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" /> Bilmen gerekenler
            </p>
            <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-1 list-disc pl-4">
              <li>Cinsiyetini haftada en fazla <span className="text-foreground font-medium">2 kez</span> değiştirebilirsin.</li>
              <li>Sayaç son değişikliğinden 7 gün sonra otomatik sıfırlanır.</li>
              <li>Kim görebilir? Gizlilik sayfasındaki "Cinsiyetinizi kimler görebilir?" ayarından kontrol edersin.</li>
            </ul>
          </div>

          {err && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          {!canChange && !err && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Yeni değişiklik için sayaç sıfırlanana kadar beklemen gerekiyor.</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-secondary/20">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>İptal</Button>
          <Button onClick={handleSave} disabled={saving || !value || !canChange || isUnchanged}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeGenderModal;
