import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Trash2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface VoiceRecorderProps {
  onVoiceNoteSend: (url: string, duration: number) => void;
  disabled?: boolean;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const VoiceRecorder = ({ onVoiceNoteSend, disabled }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      /* mikrofon izni reddedildi */
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stream.getTracks().forEach(t => t.stop());
      mr.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setSeconds(0);
  }, []);

  const sendRecording = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const duration = seconds;
    setUploading(true);

    const blob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
      mr.stream.getTracks().forEach(t => t.stop());
      mr.stop();
    });

    mediaRecorderRef.current = null;
    chunksRef.current = [];

    try {
      const path = `${user?.id ?? 'anon'}/voice_${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from('voice-notes')
        .upload(path, blob, { contentType: 'audio/webm', upsert: false });

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from('voice-notes')
          .getPublicUrl(data.path);
        onVoiceNoteSend(publicUrl, duration);
      }
    } catch { /* yükleme hatası */ }

    setUploading(false);
    setRecording(false);
    setSeconds(0);
  }, [seconds, user, onVoiceNoteSend]);

  if (recording) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/15 border border-destructive/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-red-400 tabular-nums select-none">{formatTime(seconds)}</span>
        </div>
        <button
          onClick={cancelRecording}
          className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="İptal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={sendRecording}
          disabled={uploading || seconds === 0}
          className="p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95"
          title="Gönder"
        >
          {uploading
            ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            : <Send className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 p-1 shrink-0"
      title="Sesli mesaj kaydet"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
};

export default VoiceRecorder;
