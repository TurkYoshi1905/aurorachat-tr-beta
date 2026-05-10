import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Upload, Move } from 'lucide-react';

interface AvatarCropModalProps {
  file: File | null;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
  uploading?: boolean;
}

const CANVAS_SIZE = 300;
const CIRCLE_RADIUS = CANVAS_SIZE / 2 - 8;

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
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [file]);

  // Draw canvas — fixed: use evenodd to darken OUTSIDE circle only
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext('2d')!;
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 1. Draw the image (full brightness — no overlay on image)
    const scale = zoom * Math.min(CANVAS_SIZE / imgEl.width, CANVAS_SIZE / imgEl.height);
    const w = imgEl.width * scale;
    const h = imgEl.height * scale;
    const x = cx - w / 2 + offset.x;
    const y = cy - h / 2 + offset.y;
    ctx.drawImage(imgEl, x, y, w, h);

    // 2. Draw dark overlay ONLY outside the circle using evenodd rule
    //    rect (clockwise) + arc (counterclockwise) = evenodd fills the region between them
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2, true); // true = counterclockwise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fill('evenodd');
    ctx.restore();

    // 3. Draw crisp circle border
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [imgEl, zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  // Pointer drag handlers
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
    if (!imgEl) return;
    const out = document.createElement('canvas');
    out.width = 256;
    out.height = 256;
    const ctx = out.getContext('2d')!;

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

    out.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
  };

  if (!file) return null;

  return (
    <Dialog open={!!file} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[360px] p-0 overflow-hidden bg-[#1e1f22] border-[#2e2f35]">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#2e2f35]">
          <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <Upload className="w-3.5 h-3.5 text-primary" />
            </div>
            Profil Fotoğrafını Düzenle
          </DialogTitle>
          <p className="text-xs text-[#949ba4] mt-0.5 flex items-center gap-1.5">
            <Move className="w-3 h-3" />
            Sürükleyerek taşı · Kaydırarak yakınlaştır
          </p>
        </DialogHeader>

        {/* Canvas preview */}
        <div className="px-5 pt-4 pb-3 flex justify-center">
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, background: 'linear-gradient(135deg, #111214 0%, #1a1b1e 100%)' }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="cursor-grab active:cursor-grabbing select-none touch-none block"
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
        <div className="px-5 pb-3">
          <div className="bg-[#2b2d31] rounded-xl px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2.5">
              <ZoomOut className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={0.5}
                max={3}
                step={0.01}
                className="flex-1"
                data-testid="slider-avatar-zoom"
              />
              <ZoomIn className="w-3.5 h-3.5 text-[#949ba4] shrink-0" />
            </div>
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] text-[#5d6169]">Yakınlaştır</span>
              <span className="text-[11px] font-semibold text-[#b5bac1] tabular-nums">{Math.round(zoom * 100)}%</span>
              <span className="text-[10px] text-[#5d6169]">Max ×3</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center gap-2 border-t border-[#2e2f35] pt-3">
          <button
            onClick={handleReset}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#949ba4] hover:text-white hover:bg-[#2b2d31] transition-all shrink-0"
            title="Sıfırla"
            data-testid="button-avatar-reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 bg-transparent border-[#3f4147] text-[#b5bac1] hover:bg-[#2b2d31] hover:text-white hover:border-[#5d6169]"
            data-testid="button-avatar-cancel"
          >
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
