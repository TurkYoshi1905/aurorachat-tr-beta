import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const REPORT_TYPES = [
  { id: 'spam', label: 'Spam', desc: 'İstenmeyen içerik veya tekrarlayan mesajlar' },
  { id: 'harassment', label: 'Taciz / Zorbalık', desc: 'Hakaret, küfür veya zorbalık içeriyor' },
  { id: 'hate_speech', label: 'Nefret Söylemi', desc: 'Ayrımcılık veya nefret içeriyor' },
  { id: 'nsfw', label: 'Uygunsuz İçerik', desc: 'Yetişkinlere yönelik veya müstehcen' },
  { id: 'misinformation', label: 'Yanlış Bilgi', desc: 'Yanıltıcı veya yanlış bilgi yayıyor' },
  { id: 'other', label: 'Diğer', desc: 'Başka bir neden' },
];

interface ReportMessageModalProps {
  open: boolean;
  onClose: () => void;
  messageId: string;
  messageContent?: string;
  reportedUserId?: string;
  channelId?: string;
  serverId?: string;
  dmConversationId?: string;
}

const ReportMessageModal = ({
  open,
  onClose,
  messageId,
  messageContent,
  reportedUserId,
  channelId,
  serverId,
  dmConversationId,
}: ReportMessageModalProps) => {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setSelectedType('');
    setReason('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedType || !user) return;
    setSubmitting(true);
    const { error } = await (supabase.from('message_reports') as any).insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId || null,
      message_id: messageId,
      message_content: messageContent?.slice(0, 500) || null,
      channel_id: channelId || null,
      server_id: serverId || null,
      dm_conversation_id: dmConversationId || null,
      report_type: selectedType,
      reason: reason.trim() || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) {
      toast.error('Bildirim gönderilemedi. Lütfen tekrar deneyin.');
    } else {
      toast.success('Mesaj bildirildi. Teşekkürler!');
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-border bg-gradient-to-br from-destructive/8 to-transparent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                <Flag className="w-4 h-4 text-destructive" />
              </div>
              Mesajı Bildir
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-1.5">
            Bu mesajı neden bildirdiğini seç. Bildirimler gizlidir.
          </p>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selectedType === type.id
                    ? 'border-destructive/60 bg-destructive/10'
                    : 'border-border bg-secondary/20 hover:bg-secondary/50'
                }`}
              >
                <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all ${
                  selectedType === type.id
                    ? 'border-destructive bg-destructive'
                    : 'border-muted-foreground'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {selectedType && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">
                Ek açıklama <span className="text-muted-foreground/60">(isteğe bağlı)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Neden bildiriyorsunuz? Ek bilgi yazabilirsiniz..."
                maxLength={500}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none resize-none focus:ring-1 focus:ring-primary/40 transition-shadow"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground/60 text-right mt-0.5">{reason.length}/500</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" className="flex-1" onClick={handleClose} disabled={submitting}>
              İptal
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              disabled={!selectedType || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                  Gönderiliyor...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" />
                  Bildir
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportMessageModal;
