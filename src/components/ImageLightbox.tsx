import { ChevronLeft, ChevronRight, Download, ExternalLink, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useEffect, useCallback, useState, useRef } from 'react';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}

const ImageLightbox = ({ images, currentIndex, open, onOpenChange, onIndexChange }: ImageLightboxProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [animatingOut, setAnimatingOut] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(currentIndex);
  const prevIndex = useRef(currentIndex);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const lastPinchDist = useRef(0);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Open / close native dialog (renders in top-layer — above everything)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  // Close when dialog's native close event fires (Escape key, etc.)
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onOpenChange(false);
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onOpenChange]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const goPrev = useCallback(() => {
    if (hasPrev && scale === 1) { onIndexChange(currentIndex - 1); resetZoom(); }
  }, [hasPrev, currentIndex, onIndexChange, scale, resetZoom]);

  const goNext = useCallback(() => {
    if (hasNext && scale === 1) { onIndexChange(currentIndex + 1); resetZoom(); }
  }, [hasNext, currentIndex, onIndexChange, scale, resetZoom]);

  useEffect(() => {
    resetZoom();
    if (prevIndex.current !== currentIndex) {
      setAnimatingOut(true);
      const t = setTimeout(() => {
        setDisplayIndex(currentIndex);
        requestAnimationFrame(() => setAnimatingOut(false));
      }, 150);
      prevIndex.current = currentIndex;
      return () => clearTimeout(t);
    } else {
      setDisplayIndex(currentIndex);
    }
  }, [currentIndex, open, resetZoom]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.5, 5));
      else if (e.key === '-') setScale(s => { const ns = Math.max(s - 0.5, 1); if (ns === 1) setPosition({ x: 0, y: 0 }); return ns; });
      else if (e.key === '0') resetZoom();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, goPrev, goNext, resetZoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setScale(s => { const ns = Math.min(Math.max(s + delta, 1), 5); if (ns === 1) setPosition({ x: 0, y: 0 }); return ns; });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: posStart.current.x + (e.clientX - dragStart.current.x), y: posStart.current.y + (e.clientY - dragStart.current.y) });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) resetZoom(); else setScale(2.5);
  }, [scale, resetZoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
      if (scale > 1) {
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        posStart.current = { ...position };
        setIsDragging(true);
      }
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current > 0) {
        const pinchScale = dist / lastPinchDist.current;
        setScale(s => { const ns = Math.min(Math.max(s * pinchScale, 1), 5); if (ns === 1) setPosition({ x: 0, y: 0 }); return ns; });
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({ x: posStart.current.x + (e.touches[0].clientX - dragStart.current.x), y: posStart.current.y + (e.touches[0].clientY - dragStart.current.y) });
    }
  }, [isDragging, scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setIsDragging(false);
    lastPinchDist.current = 0;
    if (scale === 1 && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dt = Date.now() - touchStart.current.time;
      if (dt < 400 && Math.abs(dx) > 50) { if (dx > 0) goPrev(); else goNext(); }
    }
  }, [scale, goPrev, goNext]);

  const handleDownload = async () => {
    const url = images[currentIndex];
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = url.split('/').pop()?.split('?')[0] || 'image';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch { window.open(url, '_blank'); }
  };

  return (
    <>
      {/* Global style for the dialog element */}
      <style>{`
        dialog.image-lightbox {
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
        dialog.image-lightbox::backdrop {
          background: rgba(0, 0, 0, 0.92);
        }
        dialog.image-lightbox:not([open]) {
          display: none;
        }
      `}</style>

      <dialog
        ref={dialogRef}
        className="image-lightbox"
        onClick={(e) => { if (e.target === dialogRef.current) onOpenChange(false); }}
      >
        {/* Inner wrapper — full size, flex column, black bg */}
        <div
          style={{
            width: '100dvw',
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(0,0,0,0.92)',
            overflow: 'hidden',
          }}
        >
          {/* ── TOP BAR ── */}
          <div
            style={{ flexShrink: 0, position: 'relative', zIndex: 10 }}
            className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent"
          >
            <div className="flex items-center gap-2">
              {images.length > 1 && (
                <span className="text-sm text-white/70 font-medium">{currentIndex + 1} / {images.length}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setScale(s => Math.min(s + 0.5, 5))} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => { const ns = Math.max(scale - 0.5, 1); setScale(ns); if (ns === 1) setPosition({ x: 0, y: 0 }); }}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              {scale > 1 && (
                <button onClick={resetZoom} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── IMAGE AREA ── */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: 'relative',
              zIndex: 1,
              overflow: 'hidden',
              isolation: 'isolate',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              touchAction: 'none',
              userSelect: 'none',
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Prev arrow */}
            {hasPrev && scale === 1 && (
              <button
                onClick={goPrev}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 3, touchAction: 'manipulation' }}
                className="p-2.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {/* Next arrow */}
            {hasNext && scale === 1 && (
              <button
                onClick={goNext}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 3, touchAction: 'manipulation' }}
                className="p-2.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Image */}
            <img
              src={images[displayIndex]}
              alt=""
              style={{
                maxWidth: '95vw',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.15s ease-in-out',
                opacity: animatingOut ? 0 : 1,
                pointerEvents: 'none',
                display: 'block',
              }}
              draggable={false}
            />
          </div>

          {/* ── BOTTOM BAR ── */}
          <div
            style={{
              flexShrink: 0,
              position: 'relative',
              zIndex: 10,
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
            }}
            className="flex items-center justify-center gap-3 px-4 pt-3 bg-gradient-to-t from-black/60 to-transparent"
          >
            {images.length > 1 && (
              <div className="flex gap-1.5 mr-4">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { onIndexChange(i); resetZoom(); }}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            )}
            <button
              onClick={() => window.open(images[currentIndex], '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Orijinali Aç</span>
            </button>
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

export default ImageLightbox;
