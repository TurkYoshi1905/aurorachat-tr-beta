import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, Keyboard } from 'lucide-react';

interface DeleteMessageConfirmModalProps {
  open: boolean;
  preview?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteMessageConfirmModal = ({ open, preview, onCancel, onConfirm }: DeleteMessageConfirmModalProps) => {
  const [working, setWorking] = useState(false);
  useEffect(() => { if (!open) setWorking(false); }, [open]);

  const handleConfirm = () => {
    if (working) return;
    setWorking(true);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">Mesajı silmek istiyor musun?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Bu işlem geri alınamaz. Mesaj kalıcı olarak kaldırılır.</p>
            </div>
          </div>
        </div>

        {preview && preview.trim().length > 0 && (
          <div className="px-6 pt-4">
            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground italic line-clamp-3 break-words">"{preview}"</p>
            </div>
          </div>
        )}

        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Keyboard className="w-3.5 h-3.5" />
            <span><span className="px-1.5 py-0.5 rounded bg-secondary text-foreground/80 font-mono text-[10px]">Shift</span> tuşuyla silersen bu pencere bir daha çıkmaz.</span>
          </div>
        </div>

        <div className="px-4 pb-4 pt-4 mt-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={working}>
            Vazgeç
          </Button>
          <Button
            className="flex-1 bg-red-500 hover:bg-red-500/90 text-white"
            onClick={handleConfirm}
            disabled={working}
          >
            <Trash2 className="w-4 h-4" />
            {working ? 'Siliniyor...' : 'Sil'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteMessageConfirmModal;
