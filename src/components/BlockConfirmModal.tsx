import { ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';

interface BlockConfirmModalProps {
  open: boolean;
  displayName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const BlockConfirmModal = ({ open, displayName, onConfirm, onCancel }: BlockConfirmModalProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm bg-[#1e1f22] border-[#2b2d31] text-foreground p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{t('block.title', { name: displayName })}</DialogTitle>

        <div className="flex flex-col items-center pt-8 pb-5 px-6">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full bg-[#5865F2] flex items-center justify-center">
              <ShieldAlert className="w-9 h-9 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-destructive flex items-center justify-center border-2 border-[#1e1f22]">
              <span className="text-white text-xs font-bold">✕</span>
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground text-center mb-1">
            {t('block.title', { name: displayName })}
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            {t('block.subtitle')}
          </p>
        </div>

        <div className="px-6 space-y-3 pb-4">
          <div className="flex gap-3 items-start">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t('block.stopDM')}</p>
              <p className="text-xs text-muted-foreground">{t('block.stopDMDesc')}</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t('block.limitProfile')}</p>
              <p className="text-xs text-muted-foreground">{t('block.limitProfileDesc')}</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t('block.serverWarning')}</p>
              <p className="text-xs text-muted-foreground">{t('block.serverWarningDesc')}</p>
            </div>
          </div>
        </div>

        <div className="mx-6 border-t border-border my-1" />

        <div className="px-6 py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">{t('block.tooMuch')}</p>
          <div className="bg-secondary/50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">{t('block.ignoreAlt')}</p>
              <p className="text-xs text-muted-foreground">{t('block.ignoreAltDesc')}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 pb-6 pt-2">
          <Button variant="ghost" onClick={onCancel} className="text-foreground hover:bg-secondary/60">
            {t('block.cancel')}
          </Button>
          <Button onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold">
            {t('block.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockConfirmModal;
