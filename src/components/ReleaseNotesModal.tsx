import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Wrench, Bug, Shield, Crown, Timer, Users, Bot, Search, Globe, Lock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/i18n';

const RELEASE_VERSION = '1.2.4';
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
    icon: Users,
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    label: 'Moderasyon paneli: kullanıcı kartlarından inline genişleme kaldırıldı, ⚙️ butonu açık ve kompakt Dialog modal ile değiştirildi.',
    badge: 'İyileştirme',
  },
  {
    icon: Bot,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    label: 'Bot değişkenleri düzeltildi: {dayOfWeek}, {greeting}, {serverAge}, {8ball}, {lucky}, {botVersion} artık gerçek değerleri döndürüyor.',
    badge: 'Düzeltme',
  },
  {
    icon: Sparkles,
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    label: '5 yeni bot değişkeni: {weather} hava durumu, {motivate} motivasyon, {tip} günlük ipucu, {mood} ruh hali, {horoscope} burç.',
    badge: 'Yeni',
  },
  {
    icon: Lock,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    label: 'Bot avatar sohbette görünüyor: send_bot_response RPC\'ye p_bot_id eklendi, FK join ile bot avatar ve adı mesajda gösteriliyor.',
    badge: 'Düzeltme',
  },
  {
    icon: Timer,
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    label: 'Cooldown engeli: cooldown alan kullanıcı mesaj gönderemez ve sunucu oluşturamaz. Kalan süre sayacı ile açıklayıcı modal gösterilir.',
    badge: 'İyileştirme',
  },
  {
    icon: Wrench,
    iconBg: 'bg-secondary',
    iconColor: 'text-muted-foreground',
    label: 'SQL migration v1.2.4: send_bot_response p_bot_id parametresi, bots tablosu public okuma politikası, bot FK index, get_my_active_cooldown RPC.',
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

        <ScrollArea className="max-h-[420px] sm:max-h-[420px] flex-1 min-h-0">
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
