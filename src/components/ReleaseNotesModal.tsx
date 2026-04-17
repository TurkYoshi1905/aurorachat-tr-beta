import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Wrench, Shield, Flag, Crown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/i18n';

const RELEASE_VERSION = '0.8.8';
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
    icon: Shield,
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    label: 'AuroraChat Moderasyon Paneli — Kurucular ve adminler için gerçek zamanlı bildirim yönetimi, kullanıcı arama ve admin yetkilendirme sayfası eklendi.',
    badge: 'Yeni',
  },
  {
    icon: Flag,
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    label: 'Mesaj Bildirme — Mesajların üzerine gelinince kırmızı bayrak butonu beliriyor; tür seçimi ve açıklama girişi içeren bir modal açılıyor.',
    badge: 'Yeni',
  },
  {
    icon: Flag,
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    label: 'Mobil Mesaj Bildirme — Uzun basınca açılan mobil mesaj menüsüne "Mesajı Bildir" seçeneği eklendi.',
    badge: 'Yeni',
  },
  {
    icon: Crown,
    iconBg: 'bg-accent/15',
    iconColor: 'text-accent',
    label: 'Premium RGB Animasyon — Kullanıcı Ayarları\'ndaki Premium aktif kartı artık canlı RGB (rainbow) kenarlık animasyonuyla parlıyor.',
    badge: 'İyileştirme',
  },
  {
    icon: Sparkles,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    label: 'Moderasyon Erişimi — Admin ve kurucular Kullanıcı Ayarları\'ndan direkt Moderasyon Paneli\'ne ulaşabiliyor; normal kullanıcılara gösterilmiyor.',
    badge: 'İyileştirme',
  },
  {
    icon: Wrench,
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    label: 'Sürüm v0.8.8 yayınlandı. Değişiklik Günlüğü\'nde tüm detayları inceleyebilirsin.',
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
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border">
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

        <ScrollArea className="max-h-[380px]">
          <div className="space-y-1.5 p-4">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-colors"
              >
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
        </ScrollArea>

        <div className="px-4 pb-4 pt-2 border-t border-border">
          <Button onClick={handleClose} className="w-full">
            {t('releaseNotes.understood')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReleaseNotesModal;
