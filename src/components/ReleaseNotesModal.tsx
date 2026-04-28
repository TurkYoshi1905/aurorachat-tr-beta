import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Wrench, Bug, Bell, ShieldAlert, Trash2, Mail, RefreshCw, KeyRound, Gavel, Filter, MessageSquare, Lock, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/i18n';

const RELEASE_VERSION = '1.0.4';
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
    icon: Gavel,
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    label: 'Yeni "Kurallar" sayfası: topluluk kuralları, ihlal türleri ve uygulanan ban süreleri (uyarı, 1 gün, 7 gün, 30 gün, kalıcı) modern bir tabloyla listeleniyor. Gizlilik sayfasından erişilebilir.',
    badge: 'Yeni',
  },
  {
    icon: Lock,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    label: 'Giriş ekranında ban modali: banlı bir hesapla giriş denenince ban sebebi, ban tarihi ve itiraz yönergesini içeren profesyonel modal açılır.',
    badge: 'Yeni',
  },
  {
    icon: Search,
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    label: 'Sunucu Ayarları > Kelime Filtresi > Muaf Roller bölümüne arama çubuğu eklendi. Çok rolü olan sunucularda istediğin rolü hızlıca bulup muaf yapabilirsin.',
    badge: 'Yeni',
  },
  {
    icon: MessageSquare,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    label: 'Mesaj render performansı Discord seviyesine çıkarıldı: üye lookup\'ı O(n) → O(1) hash map, optimistik gönderim ve grup hesaplaması memoize edildi. Binlerce mesajlı kanallarda akıcılık belirgin arttı.',
    badge: 'İyileştirme',
  },
  {
    icon: ShieldAlert,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    label: 'Tüm rol izinleri tam aktif: send_messages (mesaj gönder), attach_files (dosya ekle), pin_messages (mesaj sabitle), manage_messages (mesaj yönet) artık ChatArea içinde gerçek zamanlı uygulanıyor.',
    badge: 'Düzeltme',
  },
  {
    icon: RefreshCw,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    label: 'Rol rengi gerçek zamanlı yansıma: bir rol için renk değiştirildiğinde, o role sahip tüm üyelerin chat\'teki adı (hatta gradient!) anlık olarak güncellenir.',
    badge: 'Düzeltme',
  },
  {
    icon: Filter,
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    label: 'Bildirilerim ekranında durum güncellemeleri (Beklemede → İnceleniyor → Çözüldü/Reddedildi) artık ek bir refetch katmanıyla gerçek zamanlı garanti ediliyor.',
    badge: 'Düzeltme',
  },
  {
    icon: Wrench,
    iconBg: 'bg-secondary/40',
    iconColor: 'text-muted-foreground',
    label: 'Gizlilik Politikası modernize edildi (KVKK uyumu, veri saklama süreleri, kullanıcı hakları detaylandı).',
    badge: 'İyileştirme',
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

        <ScrollArea className="max-h-[420px]">
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
