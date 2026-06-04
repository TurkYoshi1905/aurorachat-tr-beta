import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Trash2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onVoiceNoteSend: (url: string, duration: number) => void;
  disabled?: boolean;
}

const SUPABASE_URL = 'https://ktittqaubkaylprxnoya.supabase.co';
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/upload-voice-note`;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Ses dosyasını Edge Function üzerinden yükler.
 * Service role key ile RLS tamamen bypass edilir — bucket politikası gerekmez.
 */
const uploadViaEdgeFunction = async (
  blob: Blob,
  userId: string,
  mimeType: string,
  accessToken: string
): Promise<string> => {
  const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
  const path = `${userId}/voice_${Date.now()}.${ext}`;
  const baseMime = mimeType.split(';')[0].trim();

  const form = new FormData();
  form.append('audio', blob, `voice.${ext}`);
  form.append('path', path);
  form.append('mime', baseMime);

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Yükleme başarısız');
  }

  const { url } = await res.json();
  return url as string;
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

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus';

      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast.error('Mikrofon izni reddedildi. Tarayıcı ayarlarından izin verin.');
      } else {
        toast.error('Mikrofona erişilemiyor. Başka bir uygulama kullanıyor olabilir.');
      }
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

    const mimeType = mr.mimeType || 'audio/webm';

    const blob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }));
      mr.stream.getTracks().forEach(t => t.stop());
      mr.stop();
    });

    mediaRecorderRef.current = null;
    chunksRef.current = [];

    try {
      // Oturum token'ını al
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
        setUploading(false);
        setRecording(false);
        setSeconds(0);
        return;
      }

      const publicUrl = await uploadViaEdgeFunction(
        blob,
        user?.id ?? 'anon',
        mimeType,
        session.access_token
      );

      onVoiceNoteSend(publicUrl, duration);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      toast.error(`Ses dosyası gönderilemedi: ${msg}`);
    }

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
