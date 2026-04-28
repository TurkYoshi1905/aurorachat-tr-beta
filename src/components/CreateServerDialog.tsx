import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n';
import { Camera, ChevronLeft, Gamepad2, GraduationCap, Heart, Megaphone, Music, Users, Palette, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CreateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServerCreated: (serverId: string) => void;
}

const SERVER_TEMPLATES = [
  {
    id: 'gaming',
    label: 'Oyun',
    icon: Gamepad2,
    color: 'from-green-500 to-emerald-600',
    channels: ['genel', 'oyun-sohbet', 'lfg', 'duyurular'],
    description: 'Oyun arkadaşlarınla oynamak için',
  },
  {
    id: 'study',
    label: 'Eğitim',
    icon: GraduationCap,
    color: 'from-blue-500 to-indigo-600',
    channels: ['genel', 'ders-notlari', 'sorular', 'duyurular'],
    description: 'Birlikte öğrenmek ve büyümek için',
  },
  {
    id: 'friends',
    label: 'Arkadaşlar',
    icon: Heart,
    color: 'from-pink-500 to-rose-600',
    channels: ['genel', 'gundem', 'eğlence', 'muzik'],
    description: 'Arkadaşlarınla takılmak için',
  },
  {
    id: 'community',
    label: 'Topluluk',
    icon: Megaphone,
    color: 'from-orange-500 to-amber-600',
    channels: ['genel', 'duyurular', 'etkinlikler', 'destek'],
    description: 'Büyük bir topluluk oluşturmak için',
  },
  {
    id: 'music',
    label: 'Müzik',
    icon: Music,
    color: 'from-purple-500 to-violet-600',
    channels: ['genel', 'muzik-oneriler', 'playlist', 'konser'],
    description: 'Müzik tutkunu bir topluluk için',
  },
  {
    id: 'art',
    label: 'Sanat',
    icon: Palette,
    color: 'from-yellow-500 to-orange-600',
    channels: ['genel', 'eserler', 'geri-bildirim', 'ilham'],
    description: 'Sanat ve yaratıcılık için',
  },
  {
    id: 'custom',
    label: 'Özel',
    icon: Users,
    color: 'from-[#5865f2] to-[#4752c4]',
    channels: ['genel'],
    description: 'Sıfırdan oluştur',
  },
];

const CreateServerDialog = ({ open, onOpenChange, onServerCreated }: CreateServerDialogProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<'template' | 'customize'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof SERVER_TEMPLATES[0] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = (v: boolean) => {
    if (!v) {
      setStep('template');
      setSelectedTemplate(null);
      setName('');
      setDescription('');
      setIconFile(null);
      setIconPreview(null);
    }
    onOpenChange(v);
  };

  const handleTemplateSelect = (template: typeof SERVER_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    if (!name) setName('');
    setStep('customize');
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Lütfen bir resim dosyası seçin'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Dosya 5MB\'dan küçük olmalı'); return; }
    setIconFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setIconPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!name.trim() || !user || !selectedTemplate) return;
    setLoading(true);

    try {
      const serverId = crypto.randomUUID();
      let iconUrl: string | null = null;

      if (iconFile) {
        const ext = iconFile.name.split('.').pop();
        const path = `server-icons/${serverId}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, iconFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          iconUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        }
      }

      const icon = name.trim().charAt(0).toUpperCase();
      const { error: serverError } = await supabase.from('servers').insert({
        id: serverId,
        name: name.trim(),
        icon,
        owner_id: user.id,
        ...(iconUrl ? { icon_url: iconUrl } : {}),
      } as any);

      if (serverError) {
        toast.error('Sunucu oluşturulurken hata oluştu');
        setLoading(false);
        return;
      }

      // Create channels based on template
      // Skip 'genel' since the database trigger automatically creates it on server insert
      const templateChannels = selectedTemplate.channels.filter(ch => ch !== 'genel');
      if (templateChannels.length > 0) {
        const channelInserts = templateChannels.map((channelName, idx) => ({
          id: crypto.randomUUID(),
          name: channelName,
          type: 'text' as const,
          server_id: serverId,
          position: idx + 1,
        }));
        await supabase.from('channels').insert(channelInserts);
      }

      toast.success(`"${name.trim()}" sunucusu oluşturuldu!`);
      handleClose(false);
      onServerCreated(serverId);
    } catch {
      toast.error('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-[#313338] border-[#1e1f22] text-white p-0 overflow-hidden">
        {step === 'template' ? (
          <>
            <div className="px-6 pt-6 pb-4 text-center">
              <DialogTitle className="text-xl font-bold text-white mb-1">Sunucunu Oluştur</DialogTitle>
              <p className="text-sm text-[#b5bac1]">Sunucunuz arkadaşlarınızla takılacağınız bir yer. Kendininkini oluşturun ve konuşmaya başlayın.</p>
            </div>

            <div className="px-4 pb-6 space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] px-2 mb-3">Bir Şablon Seç</p>
              {SERVER_TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleTemplateSelect(tmpl)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-[#2b2d31] hover:bg-[#393c43] border border-[#3f4147] hover:border-[#5865f2]/50 transition-all group text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tmpl.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{tmpl.label}</p>
                      <p className="text-xs text-[#b5bac1] truncate">{tmpl.description}</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-[#6d6f78] group-hover:text-[#b5bac1] rotate-180 transition-colors flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-6 pb-4 text-center relative">
              <button
                onClick={() => setStep('template')}
                className="absolute left-4 top-6 w-8 h-8 rounded-full flex items-center justify-center text-[#b5bac1] hover:text-white hover:bg-[#393c43] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <DialogTitle className="text-xl font-bold text-white mb-1">Sunucunu Özelleştir</DialogTitle>
              <p className="text-sm text-[#b5bac1]">İsim ve simge belirleyerek sunucunuzu kişiselleştirin.</p>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {/* Icon upload */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-[#5865f2] hover:border-[#4752c4] bg-[#2b2d31] transition-colors group flex items-center justify-center"
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="Icon" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${selectedTemplate?.color || 'from-[#5865f2] to-[#4752c4]'}`}>
                      <span className="text-2xl font-bold text-white">{name ? name.charAt(0).toUpperCase() : (selectedTemplate?.label?.charAt(0) || 'S')}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
                <p className="text-xs text-[#b5bac1] mt-2">Sunucu simgesi yükle</p>
              </div>

              {/* Template badge */}
              {selectedTemplate && (
                <div className="flex items-center justify-center">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${selectedTemplate.color} bg-opacity-20 text-white text-xs font-semibold`}>
                    <Check className="w-3.5 h-3.5" />
                    {selectedTemplate.label} şablonu
                  </div>
                </div>
              )}

              {/* Server Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#b5bac1]">Sunucu Adı</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Harika bir isim gir..."
                  className="bg-[#1e1f22] border-[#3f4147] text-white placeholder:text-[#6d6f78] focus-visible:ring-[#5865f2]/50 focus-visible:border-[#5865f2]"
                  maxLength={50}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <p className="text-xs text-[#6d6f78]">{name.length}/50</p>
              </div>

              {/* Preview channels */}
              {selectedTemplate && selectedTemplate.channels.length > 1 && (
                <div className="rounded-xl bg-[#2b2d31] border border-[#3f4147] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d6f78] mb-2">Oluşturulacak Kanallar</p>
                  <div className="space-y-1">
                    {selectedTemplate.channels.map((ch) => (
                      <div key={ch} className="flex items-center gap-2 text-xs text-[#b5bac1]">
                        <span className="text-[#6d6f78]">#</span>
                        <span>{ch}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold h-11 rounded-xl"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Sunucuyu Oluştur'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateServerDialog;
