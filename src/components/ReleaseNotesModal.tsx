import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Wrench, PhoneCall, PhoneOff, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/i18n';

const RELEASE_VERSION = '0.6.2';
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
    icon: PhoneCall,
    iconBg: 'bg-green-500/15',
    iconColor: 'text-green-400',
    label: 'DM Sesli Arama sistemi aktif edildi — arkadaşlar listesindeki 3 nokta menüsünden "Sesli Arama"ya tıklayarak arama başlatabilirsiniz',
    badge: 'Yeni',
  },
  {
    icon: Sparkles,
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    label: 'Tam ekran arama overlay\'i: "[Kullanıcı] Aranıyor..." yazısı ve dönen yükleme ikonu ile çağrı beklerken net görsel geri bildirim',
    badge: 'Yeni',
  },
  {
    icon: PhoneOff,
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    label: 'Anında iptal butonu: arama ekranında beklerken "İptal Et" butonuyla WebSocket bağlantısı hemen sonlandırılır ve ekran kapanır',
    badge: 'Yeni',
  },
  {
    icon: X,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    label: 'Arama akışı iyileştirildi: "Sesli Arama" tıklandığında önce overlay açılır, karşı taraf kabul edince DM sohbeti ve sesli oda başlatılır',
    badge: 'İyileştirme',
  },
  {
    icon: Wrench,
    iconBg: 'bg-secondary',
    iconColor: 'text-muted-foreground',
    label: '30 saniyelik zaman aşımı: yanıtsız kalan aramalar otomatik kapanır ve bildirim gösterilir',
    badge: 'İyileştirme',
  },
];

const badgeStyle: Record<Feature['badge'], string> = {
  'Yeni': 'bg-primary/15 text-primary',
  'Düzeltme': 'bg-green-500/15 text-green-400',
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
          <p className="text-xs text-muted-foreground mt-2">Bu sürümdeki yenilikler ve iyileştirmeler</p>
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
