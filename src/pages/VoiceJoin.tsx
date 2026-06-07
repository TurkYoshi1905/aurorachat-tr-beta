import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Room, RoomEvent,
  createLocalVideoTrack, LocalVideoTrack,
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  RotateCcw, Users, Loader2, AlertCircle, Sparkles,
} from 'lucide-react';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://aurorachat-5x5vqe5n.livekit.cloud';
const callNativeVoiceBridge = (action: 'start' | 'stop') => {
  const w = window as any;
  const bridges = [w.AuroraVoiceBridge, w.Android, w.SketchwareBridge].filter(Boolean);
  for (const bridge of bridges) {
    try {
      bridge.setMediaPlaybackRequiresUserGesture?.(false);
      bridge.setMediaPlaybackRequiresUserGestureFalse?.();
      if (action === 'start') {
        bridge.startForegroundService?.('AuroraChat kamera yayını aktif');
        bridge.startVoiceForegroundService?.();
        bridge.keepAudioAlive?.(true);
      } else {
        bridge.stopForegroundService?.();
        bridge.stopVoiceForegroundService?.();
        bridge.keepAudioAlive?.(false);
      }
    } catch {}
  }
};

const VoiceJoin = () => {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const channelId   = params.get('channelId')   || '';
  const channelName = params.get('channelName') || 'Ses Kanalı';
  const serverId    = params.get('serverId')    || '';

  const [room]          = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    videoCaptureDefaults: { resolution: { width: 1920, height: 1080, frameRate: 60 } } as any,
  }));
  const [connected,     setConnected]     = useState(false);
  const [connecting,    setConnecting]    = useState(false);
  const [micOn,         setMicOn]         = useState(true);
  const [cameraOn,      setCameraOn]      = useState(false);
  const [facingMode,    setFacingMode]    = useState<'user' | 'environment'>('user');
  const [participantCount, setParticipantCount] = useState(1);
  const [error,         setError]         = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);

  const updateCount = useCallback(() => {
    setParticipantCount(room.remoteParticipants.size + 1);
  }, [room]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (!channelId) { setError('Kanal bilgisi eksik. QR kodu tekrar okutun.'); return; }

    let cancelled = false;

    const connect = async () => {
      try {
        setConnecting(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) throw new Error('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        const { data, error: tokenErr } = await supabase.functions.invoke('livekit-token', {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          body: {
            roomName: channelId,
            participantIdentity: `${user.id}-mobile`,
            participantName: `📱 ${(profile as any)?.display_name || (profile as any)?.username || 'Mobil Kullanıcı'}`,
            metadata: JSON.stringify({
              displayName: (profile as any)?.display_name || (profile as any)?.username,
              avatarUrl: (profile as any)?.avatar_url || null,
            }),
          },
        });

        if (tokenErr || !data?.token) throw new Error('Token alınamadı. Sunucu hatası.');

        await room.connect(LIVEKIT_URL, data.token, { autoSubscribe: true });
        if (cancelled) { room.disconnect(); return; }
        callNativeVoiceBridge('start');

        await room.localParticipant.setMicrophoneEnabled(true);
        if (serverId) {
          const { error: upsertError } = await (supabase as any).from('voice_channel_members').upsert({
            channel_id: channelId,
            server_id: serverId,
            user_id: user.id,
            display_name: (profile as any)?.display_name || (profile as any)?.username || 'Mobil Kullanıcı',
            avatar_url: (profile as any)?.avatar_url || null,
            mic_muted: false,
            camera_enabled: false,
            screen_sharing: false,
            joined_at: new Date().toISOString(),
          }, { onConflict: 'channel_id,user_id' });
          if (upsertError) {
            await (supabase as any).from('voice_channel_members').upsert({
              channel_id: channelId,
              server_id: serverId,
              user_id: user.id,
              display_name: (profile as any)?.display_name || (profile as any)?.username || 'Mobil Kullanıcı',
              avatar_url: (profile as any)?.avatar_url || null,
              mic_muted: false,
              joined_at: new Date().toISOString(),
            }, { onConflict: 'channel_id,user_id' });
          }
        }

        room.on(RoomEvent.ParticipantConnected,    updateCount);
        room.on(RoomEvent.ParticipantDisconnected, updateCount);
        room.on(RoomEvent.Disconnected, () => { if (!cancelled) setConnected(false); });

        setConnected(true);
        updateCount();
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Bağlantı kurulamadı.');
      } finally {
        if (!cancelled) setConnecting(false);
      }
    };

    connect();
    return () => {
      cancelled = true;
      room.off(RoomEvent.ParticipantConnected,    updateCount);
      room.off(RoomEvent.ParticipantDisconnected, updateCount);
      room.disconnect();
      callNativeVoiceBridge('stop');
    };
  }, [user, authLoading, channelId, serverId]);

  const toggleMic = async () => {
    await room.localParticipant.setMicrophoneEnabled(!micOn);
    const next = !micOn;
    setMicOn(next);
    if (serverId && user) {
      await (supabase as any).from('voice_channel_members').update({ mic_muted: !next }).eq('channel_id', channelId).eq('user_id', user.id);
    }
  };

  const startCamera = async (facing: 'user' | 'environment') => {
    const track = await createLocalVideoTrack({
      facingMode: facing,
      resolution: { width: 1920, height: 1080, frameRate: 60 },
    });
    videoTrackRef.current = track;
    await room.localParticipant.publishTrack(track, { videoEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 }, simulcast: false } as any);
    if (localVideoRef.current) track.attach(localVideoRef.current);
    setCameraOn(true);
    if (serverId && user) {
      await (supabase as any).from('voice_channel_members').update({ camera_enabled: true }).eq('channel_id', channelId).eq('user_id', user.id);
    }
  };

  const stopCamera = async () => {
    if (videoTrackRef.current) {
      await room.localParticipant.unpublishTrack(videoTrackRef.current);
      videoTrackRef.current.stop();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        videoTrackRef.current.detach(localVideoRef.current);
      }
      videoTrackRef.current = null;
    }
    setCameraOn(false);
    if (serverId && user) {
      await (supabase as any).from('voice_channel_members').update({ camera_enabled: false }).eq('channel_id', channelId).eq('user_id', user.id);
    }
  };

  const toggleCamera = async () => {
    if (!cameraOn) {
      setFacingMode('user');
      await startCamera('user');
      return;
    }
    await flipCamera();
  };

  const flipCamera = async () => {
    const newMode: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (cameraOn) {
      await stopCamera();
      await startCamera(newMode);
    }
  };

  const handleLeave = async () => {
    await stopCamera();
    await room.disconnect();
    callNativeVoiceBridge('stop');
    if (serverId && user) {
      await (supabase as any).from('voice_channel_members').delete().eq('channel_id', channelId).eq('user_id', user.id);
    }
    navigate('/');
  };

  if (authLoading || connecting) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0f0f0f] gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-xl font-bold text-white">AuroraChat</span>
        </div>
        <Loader2 className="w-8 h-8 text-primary animate-spin mt-4" />
        <p className="text-white/50 text-sm">#{channelName} kanalına bağlanılıyor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0f0f0f] gap-4 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-white font-semibold">Bağlantı Hatası</p>
        <p className="text-white/50 text-sm">{error}</p>
        <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f0f] overflow-hidden select-none">
      {/* Top bar */}
      <div className="shrink-0 h-12 flex items-center px-4 gap-3 border-b border-white/8"
        style={{ background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-white/80 truncate">AuroraChat</span>
          <span className="text-white/20">·</span>
          <span className="text-sm text-white/40 truncate">#{channelName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white/40"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <Users className="w-3 h-3" />
            {participantCount}
          </div>
          {connected && (
            <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Bağlı
            </span>
          )}
        </div>
      </div>

      {/* Camera preview */}
      <div className="flex-1 relative overflow-hidden bg-[#111]">
        {cameraOn ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <VideoOff className="w-16 h-16 text-white/20" />
            <p className="text-white/30 text-sm">Kamera kapalı</p>
            <p className="text-white/20 text-xs">Ses kanalındasınız — diğerleri sizi duyuyor</p>
          </div>
        )}

        {/* Flip camera overlay button — only when camera is on */}
        {cameraOn && (
          <button
            onClick={flipCamera}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            data-testid="button-flip-camera"
          >
            <RotateCcw className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* ─── Controls bar ─── */}
      <div
        className="shrink-0 border-t border-white/5"
        style={{ background: 'rgba(10,10,10,0.98)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center justify-between px-4 py-4 gap-2">

          {/* Mic */}
          <button
            onClick={toggleMic}
            data-testid="button-toggle-mic"
            className="flex flex-col items-center gap-1.5 flex-1"
          >
            <div
              className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
                micOn ? 'bg-white/10' : 'bg-red-500/20'
              }`}
              style={micOn
                ? { boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }
                : { boxShadow: '0 0 0 1px rgba(239,68,68,0.45), 0 0 16px rgba(239,68,68,0.25)' }}
            >
              {micOn
                ? <Mic className="w-6 h-6 text-white/80" />
                : <MicOff className="w-6 h-6 text-red-400" />}
              {!micOn && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-black flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
            </div>
            <span className={`text-[10px] font-semibold ${micOn ? 'text-white/50' : 'text-red-400'}`}>
              {micOn ? 'Mikrofon' : 'Susturuldu'}
            </span>
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            data-testid="button-toggle-camera"
            className="flex flex-col items-center gap-1.5 flex-1"
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
                cameraOn ? 'bg-emerald-500/25' : 'bg-white/10'
              }`}
              style={cameraOn
                ? { boxShadow: '0 0 0 1px rgba(52,211,153,0.4), 0 0 16px rgba(52,211,153,0.2)' }
                : { boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
            >
              {cameraOn
                ? <Video className="w-6 h-6 text-emerald-400" />
                : <VideoOff className="w-6 h-6 text-white/40" />}
            </div>
            <span className={`text-[10px] font-semibold ${cameraOn ? 'text-emerald-400' : 'text-white/50'}`}>
              Kamera
            </span>
          </button>

          {/* Flip */}
          <button
            onClick={flipCamera}
            data-testid="button-flip-camera-bar"
            className="flex flex-col items-center gap-1.5 flex-1"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 bg-white/10"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
            >
              <RotateCcw className="w-5 h-5 text-white/60" />
            </div>
            <span className="text-[10px] font-semibold text-white/50">
              {facingMode === 'user' ? 'Ön Kam.' : 'Arka Kam.'}
            </span>
          </button>

          {/* Leave */}
          <button
            onClick={handleLeave}
            data-testid="button-leave-voice"
            className="flex flex-col items-center gap-1.5 flex-1"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95"
              style={{
                background: 'rgba(239,68,68,0.18)',
                boxShadow: '0 0 0 1.5px rgba(239,68,68,0.5), 0 0 18px rgba(239,68,68,0.2)',
              }}
            >
              <PhoneOff className="w-6 h-6 text-red-400" />
            </div>
            <span className="text-[10px] font-bold text-red-400">Ayrıl</span>
          </button>
        </div>

        {/* Safe-area bottom for mobile notch */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

export default VoiceJoin;
