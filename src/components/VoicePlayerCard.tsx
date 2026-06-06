import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoicePlayerCardProps {
  url: string;
  duration: number;
  isOwn?: boolean;
}

const BAR_COUNT = 32;

const generateBars = (seed: string): number[] => {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) & 0xffffffff;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1664525 + 1013904223) & 0xffffffff;
    const raw = 12 + Math.abs(h % 68);
    const edge = Math.min(i, BAR_COUNT - 1 - i);
    return Math.max(8, raw * Math.min(1, edge / 4));
  });
};

const formatTime = (s: number) => {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export const parseVoiceNote = (content: string): { url: string; dur: number } | null => {
  try {
    if (!content.startsWith('{"__vn"')) return null;
    const p = JSON.parse(content);
    if (p.__vn === 1 && typeof p.url === 'string') return { url: p.url, dur: typeof p.dur === 'number' ? p.dur : 0 };
  } catch { /* not a voice note */ }
  return null;
};

const VoicePlayerCard = ({ url, duration, isOwn }: VoicePlayerCardProps) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = generateBars(url);
  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  const activeBars = Math.floor(progress * BAR_COUNT);

  useEffect(() => {
    let mounted = true;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => { if (mounted && isFinite(audio.duration)) setTotalDuration(audio.duration); };
    audio.ontimeupdate = () => { if (mounted) setCurrentTime(audio.currentTime); };
    audio.onended = () => { if (mounted) { setPlaying(false); setCurrentTime(0); } };
    audio.load();
    return () => {
      mounted = false;
      audio.onloadedmetadata = null;
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      try { audio.pause(); } catch { /* ignore */ }
      try { audio.src = ''; } catch { /* ignore */ }
      audioRef.current = null;
    };
  }, [url]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().catch(() => {}); setPlaying(true); }
  }, [playing]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * totalDuration;
    setCurrentTime(ratio * totalDuration);
  }, [totalDuration]);

  const primaryColor = isOwn ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.72)';
  const dimColor = isOwn ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--foreground) / 0.16)';
  const bgClass = isOwn
    ? 'bg-primary/12 border-primary/20'
    : 'bg-secondary/70 border-border/40';

  return (
    <div className={`inline-flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border ${bgClass} backdrop-blur-sm max-w-[272px] w-full`}>
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
          isOwn
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90'
            : 'bg-foreground/10 text-foreground hover:bg-foreground/18'
        }`}
        title={playing ? 'Durdur' : 'Oynat'}
      >
        {playing
          ? <Pause className="w-3.5 h-3.5" />
          : <Play className="w-3.5 h-3.5 translate-x-px" />
        }
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div
          className="flex items-center gap-[2px] h-7 cursor-pointer"
          onClick={handleSeek}
          title="Seste ileri/geri git"
        >
          {bars.map((height, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-75"
              style={{
                height: `${height}%`,
                backgroundColor: i < activeBars ? primaryColor : dimColor,
              }}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground block">
          {playing ? formatTime(currentTime) : formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
};

export default VoicePlayerCard;
