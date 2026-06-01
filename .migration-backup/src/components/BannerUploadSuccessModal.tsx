import { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface BannerUploadSuccessModalProps {
  open: boolean;
  bannerUrl: string | null;
  onClose: () => void;
}

const BannerUploadSuccessModal = ({ open, bannerUrl, onClose }: BannerUploadSuccessModalProps) => {
  useEffect(() => {
    if (open) {
      const timer = setTimeout(onClose, 4500);
      return () => clearTimeout(timer);
    }
  }, [open, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-2xl fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -8 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              className="relative"
            >
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Banner preview */}
              <div className="h-36 w-full overflow-hidden relative">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt="Yeni banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/40 via-primary/20 to-accent/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card/90" />
              </div>

              {/* Content */}
              <div className="px-6 pb-6 pt-2 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.12, type: 'spring', damping: 14 }}
                  className="flex justify-center -mt-8 relative z-10"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 shadow-lg flex items-center justify-center backdrop-blur-sm">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-lg font-bold text-foreground">Banner Güncellendi!</h3>
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Profil bannerın başarıyla yüklendi.<br />
                    Tüm kullanıcılara gerçek zamanlı yansıtıldı.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button onClick={onClose} className="w-full gap-2" size="sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Harika!
                  </Button>
                </motion.div>
              </div>

              {/* Auto-close progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4.5, ease: 'linear' }}
                style={{ transformOrigin: 'left' }}
                className="h-0.5 bg-primary absolute bottom-0 left-0 right-0"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default BannerUploadSuccessModal;
