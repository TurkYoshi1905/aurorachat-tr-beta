import { useRef, useEffect, useCallback, useState } from 'react';
import {
  X, Download, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, PictureInPicture2
} from 'lucide-react';

interface VideoLightboxProps {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName?: string;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const VideoLightbox = ({ url, open, onOpenChange, fileName }: VideoLightboxProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [pip, setPip] = useState(false);

  // Dialog open/close
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setShowControls(true);
    } else {
      videoRef.current?.pause();
      if (el.open) el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => { videoRef.current?.pause(); onOpenChange(false); };
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onOpenChange]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      switch (e.key) {
        case 'Escape': videoRef.current?.pause(); onOpenChange(false); break;
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 5); break;
        case 'j': v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'l': v.currentTime = Math.min(v.duration, v.currentTime + 10); break;
        case 'm': toggleMute(); break;
        case 'f': toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Fullscreen change
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // PiP change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const enter = () => setPip(true);
    const leave = () => setPip(false);
    v.addEventListener('enterpictureinpicture', enter);
    v.addEventListener('leavepictureinpicture', leave);
    return () => { v.removeEventListener('enterpictureinpicture', enter); v.removeEventListener('leavepictureinpicture', leave); };
  }, [open]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch { /* tarayıcı desteklemiyorsa */ }
  }, []);

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
    } catch { window.open(url, '_blank'); }
  }, [url, fileName]);

  const handleClose = useCallback(() => {
    videoRef.current?.pause();
    onOpenChange(false);
  }, [onOpenChange]);

  // Seek bar calculation helper
  const getSeekPosition = useCallback((e: React.MouseEvent | MouseEvent): number => {
    const bar = seekBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleSeekClick = useCallback((e: React.MouseEvent) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    const pos = getSeekPosition(e);
    v.currentTime = pos * v.duration;
    setCurrentTime(v.currentTime);
  }, [getSeekPosition]);

  const handleSeekMouseDown = useCallback((e: React.MouseEvent) => {
    setSeeking(true);
    handleSeekClick(e);

    const onMove = (ev: MouseEvent) => {
      const v = videoRef.current;
      if (!v || !isFinite(v.duration)) return;
      const pos = getSeekPosition(ev);
      v.currentTime = pos * v.duration;
      setCurrentTime(v.currentTime);
    };
    const onUp = () => {
      setSeeking(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [handleSeekClick, getSeekPosition]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const displayMuted = muted || volume === 0;

  const hasPip = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && (document as any).pictureInPictureEnabled;

  return (
    <>
      <style>{`
        dialog.vl-dialog {
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
        dialog.vl-dialog::backdrop {
          background: #000;
        }
        dialog.vl-dialog:not([open]) { display: none; }

        .vl-controls-fade {
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .vl-controls-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateY(8px);
        }
        .vl-topbar-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateY(-8px);
        }

        .vl-seek-bar {
          position: relative;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.2);
          cursor: pointer;
          transition: height 0.15s ease;
        }
        .vl-seek-bar:hover {
          height: 6px;
        }
        .vl-seek-thumb {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%) scale(0);
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.3);
          transition: transform 0.15s ease;
          pointer-events: none;
        }
        .vl-seek-bar:hover .vl-seek-thumb,
        .vl-seeking .vl-seek-thumb {
          transform: translate(-50%, -50%) scale(1);
        }

        .vl-vol-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 80px;
          height: 4px;
          border-radius: 9999px;
          background: linear-gradient(to right, #fff var(--vol), rgba(255,255,255,0.25) var(--vol));
          outline: none;
          cursor: pointer;
        }
        .vl-vol-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          box-shadow: 0 0 4px rgba(0,0,0,0.4);
        }
        .vl-vol-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 4px rgba(0,0,0,0.4);
        }

        .vl-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: rgba(255,255,255,0.85);
          transition: color 0.15s, background 0.15s;
          cursor: pointer;
          background: transparent;
          border: none;
          padding: 0;
          flex-shrink: 0;
        }
        .vl-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.12);
        }
        .vl-btn-lg {
          width: 56px;
          height: 56px;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(8px);
        }
        .vl-btn-lg:hover {
          background: rgba(255,255,255,0.22);
          transform: scale(1.05);
        }
        .vl-btn-lg:active {
          transform: scale(0.97);
        }
      `}</style>

      <dialog
        ref={dialogRef}
        className="vl-dialog"
        onClick={(e) => { if (e.target === dialogRef.current) handleClose(); }}
      >
        <div
          ref={containerRef}
          style={{ width: '100dvw', height: '100dvh', position: 'relative', background: '#000', overflow: 'hidden' }}
          onMouseMove={resetHideTimer}
          onMouseLeave={() => { if (videoRef.current && !videoRef.current.paused) setShowControls(false); }}
        >
          {/* ─── Video ─────────────────────────────────── */}
          <video
            ref={videoRef}
            src={url}
            autoPlay
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background: '#000',
              outline: 'none',
              cursor: showControls ? 'default' : 'none',
            }}
            onClick={togglePlay}
            onPlay={() => { setPlaying(true); resetHideTimer(); }}
            onPause={() => { setPlaying(false); setShowControls(true); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (!v || seeking) return;
              setCurrentTime(v.currentTime);
              if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
            }}
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (v) setDuration(v.duration);
            }}
            onVolumeChange={() => {
              const v = videoRef.current;
              if (v) { setVolume(v.volume); setMuted(v.muted); }
            }}
            onEnded={() => { setPlaying(false); setShowControls(true); }}
          />

          {/* ─── Top Bar ───────────────────────────────── */}
          <div
            className={`vl-controls-fade ${showControls ? '' : 'vl-topbar-hidden'}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '12px 16px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 20,
            }}
          >
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || 'Video'}
            </span>
            <button className="vl-btn" onClick={handleDownload} title="İndir">
              <Download style={{ width: 18, height: 18 }} />
            </button>
            <button className="vl-btn" onClick={handleClose} title="Kapat (Esc)">
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* ─── Center Play/Pause Ripple ──────────────── */}
          {!playing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
                }}
              >
                <Play style={{ width: 32, height: 32, color: '#fff', marginLeft: 4 }} />
              </div>
            </div>
          )}

          {/* ─── Bottom Controls ───────────────────────── */}
          <div
            className={`vl-controls-fade ${showControls ? '' : 'vl-controls-hidden'}`}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '0 16px',
              paddingBottom: `max(16px, env(safe-area-inset-bottom, 16px))`,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
              zIndex: 20,
            }}
          >
            {/* Seek bar */}
            <div style={{ paddingTop: 24, paddingBottom: 10 }}>
              <div
                ref={seekBarRef}
                className={`vl-seek-bar ${seeking ? 'vl-seeking' : ''}`}
                onClick={handleSeekClick}
                onMouseDown={handleSeekMouseDown}
              >
                {/* Buffered */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${bufferedPct}%`,
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: 9999,
                  pointerEvents: 'none',
                }} />
                {/* Progress */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${progress}%`,
                  background: 'linear-gradient(to right, #a855f7, #818cf8)',
                  borderRadius: 9999,
                  pointerEvents: 'none',
                }} />
                {/* Thumb */}
                <div className="vl-seek-thumb" style={{ left: `${progress}%` }} />
              </div>
            </div>

            {/* Control row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Skip back 10s */}
              <button
                className="vl-btn"
                title="10 saniye geri (J)"
                onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10); }}
              >
                <SkipBack style={{ width: 18, height: 18 }} />
              </button>

              {/* Play / Pause */}
              <button className="vl-btn vl-btn-lg" onClick={togglePlay} title={playing ? 'Duraklat (K)' : 'Oynat (K)'}>
                {playing
                  ? <Pause style={{ width: 24, height: 24, color: '#fff' }} />
                  : <Play style={{ width: 24, height: 24, color: '#fff', marginLeft: 3 }} />}
              </button>

              {/* Skip forward 10s */}
              <button
                className="vl-btn"
                title="10 saniye ileri (L)"
                onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10); }}
              >
                <SkipForward style={{ width: 18, height: 18 }} />
              </button>

              {/* Volume */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button className="vl-btn" onClick={toggleMute} title="Sessiz (M)">
                  {displayMuted
                    ? <VolumeX style={{ width: 18, height: 18 }} />
                    : <Volume2 style={{ width: 18, height: 18 }} />}
                </button>
                <div style={{
                  overflow: 'hidden',
                  maxWidth: showVolumeSlider ? 90 : 0,
                  transition: 'max-width 0.2s ease, opacity 0.2s ease',
                  opacity: showVolumeSlider ? 1 : 0,
                }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={displayMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="vl-vol-slider"
                    style={{ '--vol': `${(displayMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
                  />
                </div>
              </div>

              {/* Time */}
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                letterSpacing: '0.03em',
                marginLeft: 4,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div style={{ flex: 1 }} />

              {/* PiP */}
              {hasPip && (
                <button className="vl-btn" onClick={togglePip} title="Resim içinde resim">
                  <PictureInPicture2 style={{ width: 17, height: 17, opacity: pip ? 1 : 0.75 }} />
                </button>
              )}

              {/* Download */}
              <button className="vl-btn" onClick={handleDownload} title="İndir">
                <Download style={{ width: 17, height: 17 }} />
              </button>

              {/* Fullscreen */}
              <button className="vl-btn" onClick={toggleFullscreen} title="Tam ekran (F)">
                {isFullscreen
                  ? <Minimize style={{ width: 17, height: 17 }} />
                  : <Maximize style={{ width: 17, height: 17 }} />}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
};

export default VideoLightbox;
