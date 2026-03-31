import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Upload } from 'lucide-react';

interface AvatarCropModalProps {
  file: File | null;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
  uploading?: boolean;
}

const CANVAS_SIZE = 280;

export default function AvatarCropModal({ file, onClose, onConfirm, uploading }: AvatarCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Load image when file changes
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      // Reset position
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [file]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw image
    const scale = zoom * Math.min(CANVAS_SIZE / imgEl.width, CANVAS_SIZE / imgEl.height);
    const w = imgEl.width * scale;
    const h = imgEl.height * scale;
    const x = CANVAS_SIZE / 2 - w / 2 + offset.x;
    const y = CANVAS_SIZE / 2 - h / 2 + offset.y;

    ctx.save();
    ctx.drawImage(imgEl, x, y, w, h);
    ctx.restore();

    // Draw dark overlay outside circle
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw circle border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [imgEl, zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse/touch drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = () => { dragging.current = false; };

  const handleReset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const handleConfirm = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    if (!imgEl) return;

    // Draw circular clipped image at 256×256
    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.clip();

    const ratio = 256 / CANVAS_SIZE;
    const scale = zoom * Math.min(CANVAS_SIZE / imgEl.width, CANVAS_SIZE / imgEl.height);
    const w = imgEl.width * scale * ratio;
    const h = imgEl.height * scale * ratio;
    const x = 128 - w / 2 + offset.x * ratio;
    const y = 128 - h / 2 + offset.y * ratio;

    ctx.drawImage(imgEl, x, y, w, h);
    ctx.restore();

    canvas.toBlob(blob => {
      if (blob) onConfirm(blob);
    }, 'image/jpeg', 0.92);
  };

  if (!file) return null;

  return (
    <Dialog open={!!file} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-semibold">Profil Fotoğrafını Düzenle</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Sürükleyerek taşı, kaydırarak yakınlaştır</p>
        </DialogHeader>

        {/* Canvas preview */}
        <div className="px-6 pt-6 pb-2">
          <div className="relative mx-auto rounded-3xl overflow-hidden bg-secondary/20 border border-primary/20 shadow-lg"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="cursor-grab active:cursor-grabbing select-none touch-none w-full h-full"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              data-testid="canvas-avatar-crop"
            />
          </div>
        </div>

        {/* Zoom control */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={0.5}
              max={3}
              step={0.01}
              className="flex-1"
              data-testid="slider-avatar-zoom"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2 font-medium">{Math.round(zoom * 100)}%</p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-4 flex items-center gap-2 border-t border-border">
          <button
            onClick={handleReset}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            title="Sıfırla"
            data-testid="button-avatar-reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-avatar-cancel">
            İptal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={uploading || !imgEl}
            className="flex-1 gap-2"
            data-testid="button-avatar-upload"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Yükle
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
