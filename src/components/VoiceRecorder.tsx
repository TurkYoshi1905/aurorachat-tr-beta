import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Trash2, Send, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onVoiceNoteSend: (url: string, duration: number) => void;
  disabled?: boolean;
}

const BUCKET = 'voice-notes';

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

/** Bucket yoksa oluşturmayı dene (anon key ile çalışmayabilir — SQL fallback'e yönlendir) */
const ensureBucket = async (): Promise<boolean> => {
  try {
    // Önce bucket listesini kontrol et
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (!listErr && buckets?.some(b => b.id === BUCKET)) return true;

    // Bucket yok — oluşturmayı dene
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10485760,
      allowedMimeTypes: [
        'audio/webm', 'audio/mp4', 'audio/ogg',
        'audio/mpeg', 'audio/wav', 'audio/ogg;codecs=opus',
      ],
    });

    if (createErr) {
      // Service role olmadan oluşturulamaz — kullanıcıyı yönlendir
      toast.error(
        'Sesli mesaj deposu bulunamadı. Lütfen Supabase SQL Editor\'da voice_notes_migration.sql dosyasını çalıştırın.',
        { duration: 8000, icon: '🗄️' }
      );
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const VoiceRecorder = ({ onVoiceNoteSend, disabled }: VoiceRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [bucketReady, setBucketReady] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();

  // Bileşen mount olunca bucket varlığını kontrol et
  useEffect(() => {
    ensureBucket().then(setBucketReady);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startRecording = useCallback(async () => {
    // Bucket hazır değilse önce kontrol et
    if (bucketReady === false) {
      const ready = await ensureBucket();
      setBucketReady(ready);
      if (!ready) return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Tarayıcıya göre format seç
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
  }, [bucketReady]);

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
    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';

    const blob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }));
      mr.stream.getTracks().forEach(t => t.stop());
      mr.stop();
    });

    mediaRecorderRef.current = null;
    chunksRef.current = [];

    try {
      const path = `${user?.id ?? 'anon'}/voice_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: mimeType, upsert: false });

      if (error) {
        // Bucket bulunamadı hatası
        if (error.message?.toLowerCase().includes('bucket not found') ||
            (error as { statusCode?: string }).statusCode === '404') {
          // Tekrar oluşturmayı dene
          const ready = await ensureBucket();
          setBucketReady(ready);
          if (ready) {
            // Yeniden yükle
            const { data: retryData, error: retryErr } = await supabase.storage
              .from(BUCKET)
              .upload(path, blob, { contentType: mimeType, upsert: false });

            if (!retryErr && retryData) {
              const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(retryData.path);
              onVoiceNoteSend(publicUrl, duration);
            } else {
              toast.error('Ses dosyası yüklenemedi. Lütfen tekrar deneyin.');
            }
          }
        } else {
          toast.error('Ses dosyası yüklenirken hata oluştu: ' + error.message);
        }
      } else if (data) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
        onVoiceNoteSend(publicUrl, duration);
      }
    } catch {
      toast.error('Ses dosyası gönderilemedi. İnternet bağlantınızı kontrol edin.');
    }

    setUploading(false);
    setRecording(false);
    setSeconds(0);
  }, [seconds, user, onVoiceNoteSend]);

  // Bucket hazır değil — uyarı ikonu göster
  if (bucketReady === false) {
    return (
      <button
        onClick={() => ensureBucket().then(setBucketReady)}
        disabled={disabled}
        className="text-amber-400 hover:text-amber-300 transition-colors p-1 shrink-0"
        title="Sesli mesaj deposu bulunamadı — tıklayarak tekrar dene"
      >
        <AlertCircle className="w-5 h-5" />
      </button>
    );
  }

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
      disabled={disabled || bucketReady === null}
      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 p-1 shrink-0"
      title="Sesli mesaj kaydet"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
};

export default VoiceRecorder;
