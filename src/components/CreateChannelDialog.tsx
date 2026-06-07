import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/i18n';
import { Hash, Volume2, Sparkles } from 'lucide-react';

interface CreateChannelDialogProps { open: boolean; onOpenChange: (open: boolean) => void; serverId: string; defaultType?: 'text' | 'voice'; existingCount: number; onChannelCreated: () => void; }

const CreateChannelDialog = ({ open, onOpenChange, serverId, defaultType = 'text', existingCount, onChannelCreated }: CreateChannelDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice'>(defaultType);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('channels').insert({ id: crypto.randomUUID(), name: name.trim().toLowerCase().replace(/\s+/g, '-'), type, server_id: serverId, position: existingCount });
    if (error) { console.error('Channel creation error:', error); setLoading(false); return; }
    setName(''); setType(defaultType); setLoading(false); onOpenChange(false); onChannelCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border p-0 overflow-hidden rounded-2xl">
        {/* Header gradient band */}
        <div className="relative h-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-violet-600/30 to-cyan-600/20" />
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.9) 1px, transparent 1px), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '28px 28px, 20px 20px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          <div className="absolute bottom-3 left-5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">{t('channels.createChannel')}</DialogTitle>
          </div>
        </div>

        <div className="space-y-5 px-5 pb-5 pt-4">
          {/* Channel type */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('channels.channelType')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {/* Text option */}
              <button
                type="button"
                onClick={() => setType('text')}
                className={`relative flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                  type === 'text'
                    ? 'border-primary bg-primary/8 shadow-[0_0_0_1px_rgba(var(--primary)/0.2)] ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80 hover:bg-secondary/30'
                }`}
              >
                {type === 'text' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                  </div>
                )}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  type === 'text' ? 'bg-primary/20' : 'bg-secondary'
                }`}>
                  <Hash className={`w-5 h-5 ${type === 'text' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold leading-tight ${type === 'text' ? 'text-primary' : 'text-foreground'}`}>{t('channels.text')}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t('channels.textDesc')}</p>
                </div>
              </button>

              {/* Voice option */}
              <button
                type="button"
                onClick={() => setType('voice')}
                className={`relative flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                  type === 'voice'
                    ? 'border-emerald-500/60 bg-emerald-500/8 shadow-[0_0_0_1px_rgba(52,211,153,0.15)] ring-1 ring-emerald-500/20'
                    : 'border-border bg-card hover:border-border/80 hover:bg-secondary/30'
                }`}
              >
                {type === 'voice' && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  type === 'voice' ? 'bg-emerald-500/20' : 'bg-secondary'
                }`}>
                  <Volume2 className={`w-5 h-5 ${type === 'voice' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold leading-tight ${type === 'voice' ? 'text-emerald-400' : 'text-foreground'}`}>{t('channels.voice')}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t('channels.voiceDesc')}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Channel name */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('channels.channelName')}</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                {type === 'text' ? <Hash className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && name.trim() && handleCreate()}
                placeholder={t('channels.channelNamePlaceholder')}
                className="pl-9 bg-input border-border focus:border-primary/60 transition-colors"
                maxLength={50}
              />
            </div>
          </div>

          {/* Create button */}
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full h-10 font-semibold"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {t('channels.creating')}
              </span>
            ) : t('channels.createButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChannelDialog;
