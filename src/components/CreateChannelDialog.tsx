import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/i18n';

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
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader><DialogTitle className="text-foreground text-center">{t('channels.createChannel')}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">{t('channels.channelType')}</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as 'text' | 'voice')} className="mt-2 space-y-2">
              <div className="flex items-center space-x-2 bg-input rounded-lg px-3 py-2.5">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text" className="text-sm text-foreground cursor-pointer flex-1"><span className="font-medium">{t('channels.text')}</span><p className="text-xs text-muted-foreground">{t('channels.textDesc')}</p></Label>
              </div>
              <div className="flex items-center space-x-2 bg-input rounded-lg px-3 py-2.5">
                <RadioGroupItem value="voice" id="voice" />
                <Label htmlFor="voice" className="text-sm text-foreground cursor-pointer flex-1"><span className="font-medium">{t('channels.voice')}</span><p className="text-xs text-muted-foreground">{t('channels.voiceDesc')}</p></Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">{t('channels.channelName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('channels.channelNamePlaceholder')} className="mt-1.5 bg-input border-border" maxLength={50} />
          </div>
          <Button onClick={handleCreate} disabled={loading || !name.trim()} className="w-full">{loading ? t('channels.creating') : t('channels.createButton')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChannelDialog;
