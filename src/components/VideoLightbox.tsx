import { useRef, useEffect, useCallback } from 'react';
import { X, Download } from 'lucide-react';

interface VideoLightboxProps {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName?: string;
}

const VideoLightbox = ({ url, open, onOpenChange, fileName }: VideoLightboxProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      videoRef.current?.pause();
      if (el.open) el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => {
      videoRef.current?.pause();
      onOpenChange(false);
    };
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { videoRef.current?.pause(); onOpenChange(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const handleDownload = useCallback(async () => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || url.split('/').pop()?.split('?')[0] || 'video';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  }, [url, fileName]);

  const handleClose = useCallback(() => {
    videoRef.current?.pause();
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      <style>{`
        dialog.video-lightbox {
          border: none;
          padding: 0;
          margin: 0;
          background: transparent;
          width: 100dvw;
          height: 100dvh;
          max-width: 100dvw;
          max-height: 100dvh;
          overflow: hidden;
          outline: none;
        }
        dialog.video-lightbox::backdrop {
          background: rgba(0, 0, 0, 0.92);
        }
        dialog.video-lightbox:not([open]) {
          display: none;
        }
      `}</style>

      <dialog
        ref={dialogRef}
        className="video-lightbox"
        onClick={(e) => { if (e.target === dialogRef.current) handleClose(); }}
      >
        <div
          style={{
            width: '100dvw',
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(0,0,0,0.92)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent"
            style={{ flexShrink: 0, zIndex: 10, position: 'relative' }}
          >
            <span className="text-sm text-white/70 font-medium truncate max-w-[60vw]">
              {fileName || 'Video'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleDownload}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="İndir"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
            }}
          >
            <video
              ref={videoRef}
              src={url}
              controls
              autoPlay
              style={{
                maxWidth: '95vw',
                maxHeight: '80vh',
                borderRadius: '10px',
                outline: 'none',
                backgroundColor: '#000',
              }}
            />
          </div>

          <div
            className="flex items-center justify-center gap-3 px-4 pt-3 bg-gradient-to-t from-black/60 to-transparent"
            style={{
              flexShrink: 0,
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
              zIndex: 10,
              position: 'relative',
            }}
          >
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>İndir</span>
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
};

export default VideoLightbox;
