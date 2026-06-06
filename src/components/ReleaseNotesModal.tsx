import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Wrench, Shield, ImagePlus, Mic, Smartphone } from 'lucide-react';
import { useTranslation } from '@/i18n';

const RELEASE_VERSION = '1.3.1';
const STORAGE_KEY = `aurorachat_release_seen_${RELEASE_VERSION}`;

interface Feature {
  icon: typeof Sparkles;
  iconBg: string;
  iconColor: string;
  label: string;
  badge: 'Yeni' | 'Düzeltme' | 'İyileştirme' | 'Teknik';
}

const features: Feature[] = [
  {
    icon: Smartphone,
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    label: 'Android Galeri Çekmecesi: Mobilde "+" butonuna basınca ekranın altından Android tarzı akıcı bir çekmece açılır; Resim Ekle ve GIF Gönder seçenekleri sunar.',
    badge: 'Yeni',
  },
  {
    icon: ImagePlus,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    label: 'Discord Tarzı Resim Önizleme: Mesaj göndermeden önce seçilen resimler gerçek küçük resimlerle şık kartlar halinde gösterilir; her birini ayrı ayrı kaldırabilirsin.',
    badge: 'Yeni',
  },
  {
    icon: Mic,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    label: 'Yüksek Kaliteli Ses Kayıtları: Sesli mesajlar artık 128 kbps, 48 kHz örnekleme hızı, gürültü engelleme ve eko iptali ile çok daha net iletilir.',
    badge: 'İyileştirme',
  },
  {
    icon: Shield,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    label: 'Depolama Altyapısı Güncellemesi: Medya yüklemelerinde RLS politikaları güçlendirildi; yüksek kaliteli ses ve görsel dosyalar sorunsuz iletilir.',
    badge: 'İyileştirme',
  },
  {
    icon: Wrench,
    iconBg: 'bg-secondary',
    iconColor: 'text-muted-foreground',
    label: 'Mobil giriş çubuğu emoji hizalaması düzeltildi; FileUploadPreview görsel önizleme ile tamamen yenilendi; VoiceRecorder codec seçim önceliği optimize edildi.',
    badge: 'Teknik',
  },
];

const badgeStyle: Record<Feature['badge'], string> = {
  'Yeni': 'bg-primary/15 text-primary',
  'Düzeltme': 'bg-red-500/15 text-red-400',
  'İyileştirme': 'bg-cyan-500/15 text-cyan-400',
  'Teknik': 'bg-secondary text-muted-foreground',
};

const ReleaseNotesModal = () => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md w-[calc(100%-1.5rem)] p-0 overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="font-bold">AuroraChat</span>
                <span className="text-muted-foreground font-normal"> v{RELEASE_VERSION}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-2">Bu sürümdeki yeni özellikler ve iyileştirmeler</p>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="space-y-1.5 p-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${f.iconBg}`}>
                  <f.icon className={`w-4 h-4 ${f.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${badgeStyle[f.badge]}`}>
                      {f.badge}
                    </span>
                  </div>
                  <span className="text-sm text-foreground leading-snug">{f.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
          <Button onClick={handleClose} className="w-full">
            {t('releaseNotes.understood')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReleaseNotesModal;
