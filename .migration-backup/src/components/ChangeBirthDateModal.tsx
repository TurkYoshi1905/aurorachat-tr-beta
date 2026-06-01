import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Cake, ShieldAlert, Clock, Info, AlertTriangle, Calendar } from 'lucide-react';

interface ChangeBirthDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue: string | null;
  onSaved: () => void;
}

const ChangeBirthDateModal = ({ open, onOpenChange, currentValue, onSaved }: ChangeBirthDateModalProps) => {
  const { user } = useAuth();
  const [value, setValue] = useState<string>('');
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
      .eq('field', 'birth_date')
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
      setValue(currentValue ? currentValue.slice(0, 10) : '');
      setErr(null);
      fetchUsage();
    }
  }, [open, currentValue]);

  const today = new Date();
  const maxDate = today.toISOString().slice(0, 10);
  const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate()).toISOString().slice(0, 10);

  const previewAge = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    const a = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.floor(a);
  }, [value]);

  const previewFormatted = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [value]);

  const handleSave = async () => {
    if (!user || !value) return;
    setErr(null);
    if (previewAge === null) { setErr('Geçersiz tarih.'); return; }
    if (previewAge < 13) { setErr("AuroraChat'i kullanmak için en az 13 yaşında olmalısın."); return; }
    if (previewAge > 120) { setErr('Lütfen geçerli bir yaş aralığı gir (13-120).'); return; }
    setSaving(true);
    const { error } = await (supabase.rpc as any)('change_birth_date', { p_value: value });
    setSaving(false);
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('weekly_limit') || msg.includes('limit')) {
        setErr('Bu hafta için değişiklik limitinize ulaştınız (haftada en fazla 2).');
        await fetchUsage();
      } else if (msg.includes('invalid')) {
        setErr('Geçersiz tarih. Yaş 13-120 arasında olmalıdır.');
      } else {
        setErr(error.message || 'Bir hata oluştu.');
      }
      return;
    }
    toast.success('Doğum tarihi güncellendi.');
    onOpenChange(false);
    onSaved();
  };

  const formatReset = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const isUnchanged = value === (currentValue ? currentValue.slice(0, 10) : '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background border-border">
        {/* Hero */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Cake className="w-6 h-6 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogHeader className="space-y-1.5 text-left">
                <DialogTitle className="text-lg font-bold tracking-tight">Doğru Doğum Tarihinizi Girin</DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                  Profilinde gösterilecek doğum tarihini gir. AuroraChat yaş bazlı kısıtlamalar için bu bilgiyi kullanır; lütfen <span className="text-foreground font-semibold">gerçek</span> doğum tarihini gir.
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

          {/* Date input */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Doğum Tarihi</Label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={value}
                min={minDate}
                max={maxDate}
                disabled={!canChange}
                onChange={(e) => setValue(e.target.value)}
                className="pl-9 h-11 text-sm bg-input border-border"
              />
            </div>

            {/* Live preview */}
            <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Cake className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Önizleme</p>
                {previewFormatted && previewAge !== null ? (
                  <p className="text-sm font-semibold text-foreground">
                    {previewFormatted} <span className="text-muted-foreground font-normal">· {previewAge} yaşında</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Henüz tarih seçilmedi</p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" /> Bilmen gerekenler
            </p>
            <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-1 list-disc pl-4">
              <li>Doğum tarihini haftada en fazla <span className="text-foreground font-medium">2 kez</span> değiştirebilirsin.</li>
              <li>Sayaç son değişikliğinden 7 gün sonra otomatik sıfırlanır.</li>
              <li>13 yaşından küçükler AuroraChat&apos;i kullanamaz; 13-120 yaş aralığında bir tarih girmen gerekir.</li>
              <li>Kim görebilir? Gizlilik sayfasındaki "Doğum tarihinizi kimler görebilir?" ayarından kontrol edersin.</li>
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

export default ChangeBirthDateModal;
