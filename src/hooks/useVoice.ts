import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  ConnectionQuality,
  type RemoteParticipant,
  type LocalParticipant,
  type Participant,
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface VoiceParticipant {
  identity: string;
  displayName: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  micMuted: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
}

export interface VoiceState {
  connected: boolean;
  connecting: boolean;
  voiceChannelId: string | null;
  voiceChannelName: string;
  participants: VoiceParticipant[];
  micMuted: boolean;
  deafened: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  systemAudioEnabled: boolean;
  outputVolume: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  room: Room | null;
  joinVoice: (channelId: string, channelName: string, serverId?: string | null) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  flipCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleSystemAudio: () => Promise<void>;
  setOutputVolume: (volume: number) => void;
}

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://aurorachat-5x5vqe5n.livekit.cloud';
const AURORA_AUDIO_CAPTURE_DEFAULTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: false },
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
};
const AURORA_VIDEO_CAPTURE_DEFAULTS = {
  facingMode: 'user',
  resolution: { width: 1920, height: 1080, frameRate: 60 },
};
const AURORA_VIDEO_PUBLISH_OPTIONS = {
  videoEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
  simulcast: false,
};

const getParticipantCamera = (p: Participant): boolean => {
  const pub = p.getTrackPublication(Track.Source.Camera);
  return !!(pub && pub.isEnabled && !pub.isMuted);
};

const getParticipantScreen = (p: Participant): boolean => {
  const pub = p.getTrackPublication(Track.Source.ScreenShare);
  return !!(pub && pub.isEnabled);
};

// ─── Mobile / WebView helpers ───────────────────────────────────────────────
const isMobileUA = (): boolean =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const isAndroidWebView = (): boolean =>
  /Android/i.test(navigator.userAgent) &&
  (/wv\b/.test(navigator.userAgent) || /Version\/\d+\.\d+/.test(navigator.userAgent));

const callNativeVoiceBridge = (action: 'start' | 'stop') => {
  const w = window as any;
  const bridges = [w.AuroraVoiceBridge, w.Android, w.SketchwareBridge].filter(Boolean);
  for (const bridge of bridges) {
    try {
      bridge.setMediaPlaybackRequiresUserGesture?.(false);
      bridge.setMediaPlaybackRequiresUserGestureFalse?.();
      if (action === 'start') {
        bridge.startForegroundService?.('AuroraChat sesli sohbet aktif');
        bridge.startVoiceForegroundService?.();
        bridge.keepAudioAlive?.(true);
      } else {
        bridge.stopForegroundService?.();
        bridge.stopVoiceForegroundService?.();
        bridge.keepAudioAlive?.(false);
      }
    } catch { /* native bridge unavailable */ }
  }
};

// Build getDisplayMedia constraints based on platform.
// Lower framerate/resolution on mobile to reduce CPU load and bandwidth (was causing lag).
const buildDisplayMediaConstraints = (): MediaStreamConstraints => {
  const mobile = isMobileUA();
  if (mobile) {
    return {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 24, max: 30 },
      } as MediaTrackConstraints,
      audio: false,
    };
  }
  return {
    video: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
    } as MediaTrackConstraints,
    audio: true,
  };
};

export const useVoice = (): VoiceState => {
  const { user, profile } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const tabIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const voiceServerIdRef = useRef<string | null>(null);
  const outputVolumeRef = useRef(1);
  const deafenedRef = useRef(false);
  const silentAudioCtxRef = useRef<AudioContext | null>(null);
  const keepAliveWorkerRef = useRef<Worker | null>(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [voiceChannelName, setVoiceChannelName] = useState('');
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [screenSharing, setScreenSharing] = useState(false);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
  const [outputVolume, setOutputVolumeState] = useState(1);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');
  const speakingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    outputVolumeRef.current = outputVolume;
    audioElementsRef.current.forEach((el) => {
      el.volume = outputVolume;
    });
  }, [outputVolume]);

  useEffect(() => {
    deafenedRef.current = deafened;
  }, [deafened]);

  // ── WakeLock helpers (prevents Android from suspending during screen share) ─
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch { /* device doesn't support or user denied */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // ── Desktop background-tab keep-alive ────────────────────────────────────────
  // When the tab goes to the background on desktop, Chrome throttles JS timers
  // which kills the LiveKit WebRTC keep-alive pings → server drops the connection.
  // Fix 1: Silent AudioContext — browsers never throttle tabs with active audio.
  // Fix 2: Web Worker timer — worker intervals are NOT throttled in background tabs.
  const startKeepAlive = useCallback(() => {
    // Silent AudioContext — prevents Chrome from throttling the tab
    if (!silentAudioCtxRef.current) {
      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.0001; // effectively silent but non-zero so browser counts it
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        silentAudioCtxRef.current = ctx;
      } catch { /* AudioContext not available */ }
    }
    // Web Worker timer — fires every 10 s regardless of tab visibility
    if (!keepAliveWorkerRef.current && typeof Worker !== 'undefined') {
      try {
        const worker = new Worker('/voice-keepalive-worker.js');
        worker.onmessage = () => {
          // Each ping confirms the JS thread is active; re-resume AudioContext if needed
          if (silentAudioCtxRef.current?.state === 'suspended') {
            silentAudioCtxRef.current.resume().catch(() => {});
          }
        };
        worker.postMessage('start');
        keepAliveWorkerRef.current = worker;
      } catch { /* Worker not available */ }
    }
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (silentAudioCtxRef.current) {
      silentAudioCtxRef.current.close().catch(() => {});
      silentAudioCtxRef.current = null;
    }
    if (keepAliveWorkerRef.current) {
      keepAliveWorkerRef.current.postMessage('stop');
      keepAliveWorkerRef.current.terminate();
      keepAliveWorkerRef.current = null;
    }
  }, []);

  // Re-acquire WakeLock and resume AudioContext when tab comes back to foreground
  useEffect(() => {
    const handleVisibility = async () => {
      if (!document.hidden) {
        // Re-acquire WakeLock (Android may release it)
        if (screenSharing && !wakeLockRef.current) {
          await acquireWakeLock();
        }
        // Resume silent AudioContext if browser suspended it
        if (silentAudioCtxRef.current?.state === 'suspended') {
          silentAudioCtxRef.current.resume().catch(() => {});
        }
        // If LiveKit dropped due to background throttle, it will auto-reconnect
        // via reconnectPolicy — just ensure keep-alive is still running
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          // Re-start keep-alive in case it was lost
          startKeepAlive();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [screenSharing, acquireWakeLock, startKeepAlive]);

  const cleanupAudio = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current = [];
  }, []);

  // Resume audio elements when app comes back from background (mobile)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && audioElementsRef.current.length > 0) {
        audioElementsRef.current.forEach((el) => {
          if (el.paused) el.play().catch(() => {});
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Disconnect from voice when user closes/refreshes the tab or backgrounds WebView/mobile
  useEffect(() => {
    const cleanupVoiceRow = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const apikey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
        if (!user || !token) return;
        const url = `${(import.meta as any).env?.VITE_SUPABASE_URL}/rest/v1/voice_channel_members?user_id=eq.${user.id}`;
        // fetch with keepalive: true survives page unload on Chrome/Safari/WebView
        await fetch(url, {
          method: 'DELETE',
          keepalive: true,
          headers: {
            apikey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {});
      } catch { /* ignore */ }
    };

    const handleUnload = () => {
      if (roomRef.current) {
        try { roomRef.current.disconnect(); } catch { /* ignore */ }
        roomRef.current = null;
      }
      cleanupVoiceRow();
    };

    // Mobile WebView/browser: when app goes background AND likely killed, try to clean up.
    // We use 'pagehide' (most reliable on mobile Safari/Android) plus 'beforeunload' (desktop).
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [user]);

  // Heartbeat: update joined_at every 30s while in voice — helps detect stale WebView sessions
  useEffect(() => {
    if (!voiceChannelId || !user) return;
    const tick = () => {
      (supabase as any).from('voice_channel_members')
        .update({
          joined_at: new Date().toISOString(),
          mic_muted: micMuted,
          camera_enabled: cameraEnabled,
          screen_sharing: screenSharing,
        })
        .eq('user_id', user.id)
        .eq('channel_id', voiceChannelId)
        .then(({ error }: any) => {
          if (!error) return;
          (supabase as any).from('voice_channel_members')
            .update({
              joined_at: new Date().toISOString(),
              mic_muted: micMuted,
            })
            .eq('user_id', user.id)
            .eq('channel_id', voiceChannelId)
            .then(() => {});
        });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [voiceChannelId, user, micMuted, cameraEnabled, screenSharing]);

  const buildParticipants = useCallback((room: Room) => {
    const parts: VoiceParticipant[] = [];
    const seenIdentities = new Set<string>();

    const local = room.localParticipant;
    let localMeta: { displayName?: string; avatarUrl?: string | null } = {};
    try { localMeta = JSON.parse(local.metadata || '{}'); } catch { /* empty */ }
    parts.push({
      identity: local.identity,
      displayName: localMeta.displayName || local.name || local.identity,
      avatarUrl: localMeta.avatarUrl ?? null,
      isSpeaking: speakingRef.current.has(local.identity),
      micMuted: local.isMicrophoneEnabled === false,
      cameraEnabled: getParticipantCamera(local),
      screenSharing: getParticipantScreen(local),
    });
    seenIdentities.add(local.identity);

    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      if (seenIdentities.has(p.identity)) return;
      seenIdentities.add(p.identity);
      let meta: { displayName?: string; avatarUrl?: string | null } = {};
      try { meta = JSON.parse(p.metadata || '{}'); } catch { /* empty */ }
      const micPub = p.getTrackPublication(Track.Source.Microphone);
      parts.push({
        identity: p.identity,
        displayName: meta.displayName || p.name || p.identity,
        avatarUrl: meta.avatarUrl ?? null,
        isSpeaking: speakingRef.current.has(p.identity),
        micMuted: !micPub || micPub.isMuted,
        cameraEnabled: getParticipantCamera(p),
        screenSharing: getParticipantScreen(p),
      });
    });

    setParticipants(parts);
  }, []);

  const joinVoice = useCallback(async (channelId: string, channelName: string, serverId?: string | null) => {
    if (!user || !profile) { toast.error('Oturum açmanız gerekiyor.'); return; }
    if (serverId) voiceServerIdRef.current = serverId;

    if (voiceChannelId === channelId && connected) return;

    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    cleanupAudio();

    setConnecting(true);
    setVoiceChannelId(channelId);
    setVoiceChannelName(channelName);
    setParticipants([]);
    speakingRef.current.clear();

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
      }

      const { data, error } = await supabase.functions.invoke('livekit-token', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          roomName: channelId,
          participantIdentity: user.id,
          participantName: profile.display_name || profile.username || 'Kullanıcı',
          metadata: JSON.stringify({
            displayName: profile.display_name || profile.username || 'Kullanıcı',
            avatarUrl: profile.avatar_url || null,
          }),
        },
      });

      if (error || !data?.token) {
        throw new Error(error?.message || 'Token alınamadı');
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: AURORA_AUDIO_CAPTURE_DEFAULTS as any,
        videoCaptureDefaults: AURORA_VIDEO_CAPTURE_DEFAULTS as any,
        screenShareCaptureDefaults: {
          resolution: { width: 1920, height: 1080, frameRate: 60 },
          audio: true,
        },
        // Aggressive reconnect so background-tab drops recover automatically
        reconnectPolicy: {
          maxRetries: 20,
          nextRetryDelayInMs: (context: { retryCount: number }) =>
            Math.min(500 * Math.pow(1.5, context.retryCount), 15000),
        } as any,
      });
      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected, (p) => {
          toast.info(`${p.name || p.identity} sese katıldı`);
          buildParticipants(room);
        })
        .on(RoomEvent.ParticipantDisconnected, (p) => {
          toast.info(`${p.name || p.identity} sesten ayrıldı`);
          speakingRef.current.delete(p.identity);
          buildParticipants(room);
        })
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          speakingRef.current.clear();
          speakers.forEach((s) => speakingRef.current.add(s.identity));
          buildParticipants(room);
        })
        .on(RoomEvent.TrackMuted, () => buildParticipants(room))
        .on(RoomEvent.TrackUnmuted, () => buildParticipants(room))
        .on(RoomEvent.LocalTrackPublished, () => buildParticipants(room))
        .on(RoomEvent.LocalTrackUnpublished, () => buildParticipants(room))
        .on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
          if (track.kind === Track.Kind.Audio) {
            const audioEl = track.attach() as HTMLAudioElement;
            audioEl.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;';
            audioEl.volume = outputVolumeRef.current;
            audioEl.muted = deafenedRef.current;
            document.body.appendChild(audioEl);
            audioEl.play().catch(() => {});
            audioElementsRef.current.push(audioEl);
          }
          buildParticipants(room);
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          const detached = track.detach();
          detached.forEach((el) => {
            el.pause();
            (el as HTMLAudioElement).srcObject = null;
            el.remove();
          });
          audioElementsRef.current = audioElementsRef.current.filter((el) => !detached.includes(el));
          buildParticipants(room);
        })
        .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
          // Only track local participant's quality for the status indicator
          if (participant.identity === room.localParticipant.identity) {
            if (quality === ConnectionQuality.Excellent) setConnectionQuality('excellent');
            else if (quality === ConnectionQuality.Good) setConnectionQuality('good');
            else if (quality === ConnectionQuality.Poor) setConnectionQuality('poor');
            else setConnectionQuality('unknown');
          }
        })
        .on(RoomEvent.Reconnecting, () => {
          setConnectionQuality('poor');
          toast.warning('Ses kanalı yeniden bağlanıyor...', { id: 'voice-reconnect', duration: 30000 });
        })
        .on(RoomEvent.Reconnected, () => {
          setConnectionQuality('good');
          toast.success('Ses kanalına yeniden bağlandı', { id: 'voice-reconnect' });
          buildParticipants(room);
          // Re-resume AudioContext if it was suspended during background
          if (silentAudioCtxRef.current?.state === 'suspended') {
            silentAudioCtxRef.current.resume().catch(() => {});
          }
        })
        .on(RoomEvent.Disconnected, () => {
          cleanupAudio();
          releaseWakeLock();
          stopKeepAlive();
          setConnectionQuality('unknown');
          if ('mediaSession' in navigator) {
            try { navigator.mediaSession.setActionHandler('stop', null); } catch { /* ignore */ }
          }
          screenAudioTrackRef.current?.stop();
          screenAudioTrackRef.current = null;
          setConnected(false);
          setConnecting(false);
          setVoiceChannelId(null);
          setVoiceChannelName('');
          setParticipants([]);
          setCameraEnabled(false);
          setScreenSharing(false);
          setSystemAudioEnabled(false);
          speakingRef.current.clear();
          roomRef.current = null;
          if (user) {
            (supabase as any).from('voice_channel_members').delete().eq('user_id', user.id).then(() => {});
          }
          voiceServerIdRef.current = null;
        });

      await room.connect(LIVEKIT_URL, data.token);
      callNativeVoiceBridge('start');

      let micEnabled = true;
      try {
        await room.localParticipant.setMicrophoneEnabled(true, AURORA_AUDIO_CAPTURE_DEFAULTS as any);
      } catch (micErr: any) {
        micEnabled = false;
        if (micErr?.name === 'NotReadableError' || micErr?.name === 'AudioContext') {
          toast.warning('Mikrofona erişilemiyor. Başka bir uygulama mikrofonu kullanıyor olabilir. Sessiz olarak bağlandın.', { duration: 6000 });
        } else if (micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError') {
          toast.warning('Mikrofon izni verilmedi. Sessiz olarak bağlandın.', { duration: 6000 });
        } else {
          toast.warning(`Mikrofon açılamadı: ${micErr?.message || 'Bilinmeyen hata'}. Sessiz olarak bağlandın.`, { duration: 6000 });
        }
      }

      buildParticipants(room);
      setConnected(true);
      setConnecting(false);
      setMicMuted(!micEnabled);
      setDeafened(false);
      setCameraEnabled(false);
      setScreenSharing(false);
      setSystemAudioEnabled(false);
      toast.success(`#${channelName} ses kanalına bağlandı`);

      // Start desktop background-tab keep-alive immediately on connect
      startKeepAlive();

      if (voiceServerIdRef.current) {
        (supabase as any).from('voice_channel_members').upsert({
          channel_id: channelId,
          server_id: voiceServerIdRef.current,
          user_id: user.id,
          display_name: profile.display_name || profile.username || 'Kullanıcı',
          avatar_url: profile.avatar_url || null,
          mic_muted: false,
          camera_enabled: false,
          screen_sharing: false,
          joined_at: new Date().toISOString(),
        }, { onConflict: 'channel_id,user_id' }).then(({ error }: any) => {
          if (!error) return;
          (supabase as any).from('voice_channel_members').upsert({
            channel_id: channelId,
            server_id: voiceServerIdRef.current,
            user_id: user.id,
            display_name: profile.display_name || profile.username || 'Kullanıcı',
            avatar_url: profile.avatar_url || null,
            mic_muted: false,
            joined_at: new Date().toISOString(),
          }, { onConflict: 'channel_id,user_id' }).then(() => {});
        });
      }

      // Echo detection: detect same-device multi-session and auto-mute the NEW joiner
      // Only the second tab (the new joiner) mutes itself; the established tab stays active
      if ('BroadcastChannel' in window) {
        broadcastChannelRef.current?.close();
        const bc = new BroadcastChannel('aurorachat_voice');
        broadcastChannelRef.current = bc;
        bc.onmessage = (e) => {
          if (e.data?.tabId === tabIdRef.current) return;
          // Received a response to our query — someone else is already in this room
          // We are the new joiner, so we mute ourselves to prevent echo
          if (e.data?.type === 'voice_response' && e.data?.channelId === channelId) {
            toast.warning('Aynı cihazda başka bir oturum bu ses kanalında! Yankı önlemek için mikrofonun kapatıldı.', { duration: 7000 });
            if (roomRef.current) {
              roomRef.current.localParticipant.setMicrophoneEnabled(false, AURORA_AUDIO_CAPTURE_DEFAULTS as any);
              setMicMuted(true);
            }
          }
          // Someone joined and is asking if anyone is here — respond with our channel
          if (e.data?.type === 'voice_query') {
            bc.postMessage({ type: 'voice_response', channelId, tabId: tabIdRef.current });
          }
        };
        // Ask if anyone is already in a voice channel (we are the new joiner)
        bc.postMessage({ type: 'voice_query', tabId: tabIdRef.current });
      }
      } catch (err: any) {
      console.error('Voice join error:', err);
      if (!String(err?.message || '').includes('Client initiated disconnect')) {
        toast.error(`Ses kanalına bağlanılamadı: ${err.message}`);
      }
      setConnecting(false);
      setVoiceChannelId(null);
      setVoiceChannelName('');
      roomRef.current = null;
      cleanupAudio();
    }
  }, [user, profile, voiceChannelId, connected, buildParticipants, cleanupAudio, startKeepAlive]);

  const disconnect = useCallback(async () => {
    broadcastChannelRef.current?.close();
    broadcastChannelRef.current = null;
    releaseWakeLock();
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.setActionHandler('stop', null); } catch { /* ignore */ }
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    cleanupAudio();
    stopKeepAlive();
    callNativeVoiceBridge('stop');
    screenAudioTrackRef.current?.stop();
    screenAudioTrackRef.current = null;
    setConnected(false);
    setConnecting(false);
    setVoiceChannelId(null);
    setVoiceChannelName('');
    setParticipants([]);
    setMicMuted(false);
    setDeafened(false);
    setCameraEnabled(false);
    setScreenSharing(false);
    setSystemAudioEnabled(false);
    speakingRef.current.clear();
    if (user) {
      (supabase as any).from('voice_channel_members').delete().eq('user_id', user.id).then(() => {});
    }
    voiceServerIdRef.current = null;
  }, [cleanupAudio, releaseWakeLock, stopKeepAlive, user]);

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return;
    if (deafenedRef.current && micMuted) {
      toast.info('Mikrofonu açmak için önce sağırlaştırmayı kapat.');
      return;
    }
    const newMuted = !micMuted;
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted, AURORA_AUDIO_CAPTURE_DEFAULTS as any);
      setMicMuted(newMuted);
      if (user) {
        (supabase as any).from('voice_channel_members').update({ mic_muted: newMuted }).eq('user_id', user.id).then(() => {});
      }
      buildParticipants(roomRef.current);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'Mikrofon izni verilmedi. Tarayıcı izinlerinden mikrofonu açman gerekiyor.'
        : `Mikrofon değiştirilemedi: ${err?.message || 'Bilinmeyen hata'}`;
      toast.error(msg);
      buildParticipants(roomRef.current);
    }
  }, [micMuted, buildParticipants, user]);

  const toggleDeafen = useCallback(() => {
    if (!roomRef.current) return;
    const newDeafened = !deafened;

    roomRef.current.remoteParticipants.forEach((p: RemoteParticipant) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.audioTrack?.mediaStreamTrack) {
          pub.audioTrack.mediaStreamTrack.enabled = !newDeafened;
        }
      });
    });

    audioElementsRef.current.forEach((el) => {
      el.muted = newDeafened;
    });

    if (newDeafened && !micMuted) {
      roomRef.current.localParticipant.setMicrophoneEnabled(false, AURORA_AUDIO_CAPTURE_DEFAULTS as any).catch(() => {});
      setMicMuted(true);
      if (user) {
        (supabase as any).from('voice_channel_members').update({ mic_muted: true }).eq('user_id', user.id).then(() => {});
      }
    }

    setDeafened(newDeafened);
  }, [deafened, micMuted, user]);

  const setOutputVolume = useCallback((volume: number) => {
    const next = Math.max(0, Math.min(1, volume));
    outputVolumeRef.current = next;
    setOutputVolumeState(next);
    audioElementsRef.current.forEach((el) => {
      el.volume = next;
    });
  }, []);

  const flipCamera = useCallback(async () => {
    if (!roomRef.current || !cameraEnabled) return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const lp = roomRef.current.localParticipant;
      // Disable current camera, then re-enable with opposite facingMode constraint.
      // This is the most reliable method for Android WebView (Sketchware) since
      // enumerateDevices() often returns empty deviceIds there.
      await lp.setCameraEnabled(false);
      await lp.setCameraEnabled(
        true,
        { facingMode: newMode, resolution: { width: 1920, height: 1080, frameRate: 60 } } as any,
        AURORA_VIDEO_PUBLISH_OPTIONS as any
      );
      setFacingMode(newMode);
      if (user) {
        (supabase as any).from('voice_channel_members').update({ camera_enabled: true }).eq('user_id', user.id).then(() => {});
      }
      buildParticipants(roomRef.current);
    } catch (err: any) {
      // Fallback: try switching via room-level device switch
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
        if (videoDevices.length >= 2) {
          const pub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Camera);
          const currentId = (pub?.track as any)?.mediaStreamTrack?.getSettings()?.deviceId ?? '';
          const next = videoDevices.find((d) => d.deviceId !== currentId) ?? videoDevices[0];
          await roomRef.current.switchActiveDevice('videoinput', next.deviceId);
          setFacingMode(newMode);
          buildParticipants(roomRef.current);
        } else {
          toast.info('Yalnızca bir kamera mevcut');
        }
      } catch {
        toast.error('Kamera çevrilemedi: ' + err.message);
      }
    }
  }, [cameraEnabled, facingMode, buildParticipants, user]);

  const toggleCamera = useCallback(async () => {
    if (!roomRef.current) return;
    try {
      if (!cameraEnabled) {
        await roomRef.current.localParticipant.setCameraEnabled(
          true,
          { facingMode: 'user', resolution: { width: 1920, height: 1080, frameRate: 60 } } as any,
          AURORA_VIDEO_PUBLISH_OPTIONS as any
        );
        setFacingMode('user');
        setCameraEnabled(true);
        if (user) {
          (supabase as any).from('voice_channel_members').update({ camera_enabled: true }).eq('user_id', user.id).then(() => {});
        }
      } else if (isMobileUA() || isAndroidWebView()) {
        await flipCamera();
        return;
      } else {
        await roomRef.current.localParticipant.setCameraEnabled(false);
        setCameraEnabled(false);
        if (user) {
          (supabase as any).from('voice_channel_members').update({ camera_enabled: false }).eq('user_id', user.id).then(() => {});
        }
      }
      buildParticipants(roomRef.current);
    } catch (err: any) {
      toast.error('Kamera açılamadı: ' + err.message);
    }
  }, [cameraEnabled, buildParticipants, user, flipCamera]);

  // ── Shared screen-stop cleanup (called from onended and from manual stop) ──
  // ── Foreground Service helper (Android Chrome) ──────────────────────────────
  // Shows a persistent notification while screen sharing so Android won't kill the tab.
  const showForegroundNotification = useCallback(async () => {
    if (!isMobileUA()) return;
    if (!('Notification' in window)) return;
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;
      if ('serviceWorker' in navigator) {
        const sw = await navigator.serviceWorker?.ready;
        if (sw?.showNotification) {
          await sw.showNotification('AuroraChat — Ekran Paylaşımı Aktif', {
            body: 'Ekran paylaşımı devam ediyor. Durdurmak için uygulamaya dönün.',
            icon: '/aurora-bot-avatar.jpg',
            tag: 'screen-share-fg',
            renotify: false,
            silent: true,
            requireInteraction: true,
          } as NotificationOptions);
        }
      }
    } catch { /* Notification API not supported */ }
  }, []);

  const closeForegroundNotification = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const sw = await navigator.serviceWorker?.ready;
      if (sw?.getNotifications) {
        const notifications = await sw.getNotifications({ tag: 'screen-share-fg' });
        notifications.forEach((n) => n.close());
      }
    } catch { /* ignore */ }
  }, []);

  const stopScreenShareCleanup = useCallback(async () => {
    releaseWakeLock();
    closeForegroundNotification();
    // Reset MediaSession capture state if supported
    if ('mediaSession' in navigator) {
      try { (navigator.mediaSession as any).setCaptureHandleConfig?.({ exposeOrigin: false }); } catch { /* ignore */ }
    }
    setScreenSharing(false);
    setSystemAudioEnabled(false);
    screenAudioTrackRef.current = null;
    if (user) {
      (supabase as any).from('voice_channel_members').update({ screen_sharing: false }).eq('user_id', user.id).then(() => {});
    }
    if (roomRef.current) {
      try {
        const local = roomRef.current.localParticipant;
        const screenPub = local.getTrackPublication(Track.Source.ScreenShare);
        const screenAudioPub = local.getTrackPublication(Track.Source.ScreenShareAudio);
        if (screenPub?.track) await local.unpublishTrack(screenPub.track);
        if (screenAudioPub?.track) await local.unpublishTrack(screenAudioPub.track);
      } catch { /* already stopped */ }
      buildParticipants(roomRef.current);
    }
  }, [releaseWakeLock, closeForegroundNotification, buildParticipants, user]);

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return;
    const newState = !screenSharing;

    try {
      if (newState) {
        // ── Check API availability ───────────────────────────────────────
        if (!navigator.mediaDevices?.getDisplayMedia) {
          const webView = isAndroidWebView();
          toast.error('Ekran paylaşımı desteklenmiyor', {
            description: webView
              ? 'WebView ekran paylaşımı için Chrome (Android 12+) gerektirir. Uygulamanızın WebView sürümünü güncelleyin.'
              : 'Tarayıcınız ekran paylaşımını desteklemiyor. Chrome veya Edge deneyin.',
          });
          return;
        }

        // ── Get display stream with platform-specific constraints ────────
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia(
            buildDisplayMediaConstraints() as any
          );
        } catch (firstErr: any) {
          // Fallback: ultra-minimal constraints for older WebViews
          if (firstErr.name === 'OverconstrainedError' || firstErr.name === 'ConstraintNotSatisfiedError') {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false } as any);
          } else {
            throw firstErr;
          }
        }

        if (!stream) return;

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0] || null;
        if (!videoTrack) return;

        // ── WakeLock — prevents Android from suspending the app ──────────
        await acquireWakeLock();

        // ── Foreground Service (Android) — persistent notification keeps app alive ─
        await showForegroundNotification();

        // ── MediaSession — signals OS that active capture is in progress ─
        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: 'Ekran Paylaşımı',
              artist: 'AuroraChat',
            });
            // Handle stop action from OS notification / headset button
            navigator.mediaSession.setActionHandler('stop', () => {
              videoTrack.stop();
            });
          } catch { /* MediaSession not fully supported */ }
        }

        // ── track.onended — fires when user stops from browser/OS UI ────
        videoTrack.addEventListener('ended', async () => {
          await stopScreenShareCleanup();
        });
        if (audioTrack) {
          audioTrack.addEventListener('ended', () => {
            screenAudioTrackRef.current = null;
            setSystemAudioEnabled(false);
          });
        }

        // ── Publish to LiveKit ───────────────────────────────────────────
        // Lower bitrate/framerate for smoother playback on receivers (mobile + slow connections).
        // Was 8 Mbps @ 60fps which caused stutters; 3 Mbps @ 30fps is plenty for screen content.
        const isMob = isMobileUA();
        await roomRef.current.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.ScreenShare,
          simulcast: false,
          videoEncoding: {
            maxBitrate: isMob ? 1_500_000 : 3_000_000,
            maxFramerate: 30,
          },
        });

        if (audioTrack) {
          screenAudioTrackRef.current = audioTrack;
          await roomRef.current.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.ScreenShareAudio,
          });
          setSystemAudioEnabled(true);
        } else {
          setSystemAudioEnabled(false);
        }

        setScreenSharing(true);
        if (user) {
          (supabase as any).from('voice_channel_members').update({ screen_sharing: true }).eq('user_id', user.id).then(() => {});
        }
        buildParticipants(roomRef.current);
      } else {
        // ── Manual stop via UI button ────────────────────────────────────
        const local = roomRef.current.localParticipant;
        const screenPub = local.getTrackPublication(Track.Source.ScreenShare);
        const screenAudioPub = local.getTrackPublication(Track.Source.ScreenShareAudio);

        // Stop the underlying MediaStreamTrack first so the browser/OS
        // recording indicator disappears immediately
        screenPub?.track?.mediaStreamTrack?.stop();
        screenAudioPub?.track?.mediaStreamTrack?.stop();
        screenAudioTrackRef.current?.stop();

        if (screenPub?.track) await local.unpublishTrack(screenPub.track);
        if (screenAudioPub?.track) await local.unpublishTrack(screenAudioPub.track);

        screenAudioTrackRef.current = null;
        releaseWakeLock();

        // Clear MediaSession handlers
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.setActionHandler('stop', null); } catch { /* ignore */ }
        }

        setSystemAudioEnabled(false);
        setScreenSharing(false);
        if (user) {
          (supabase as any).from('voice_channel_members').update({ screen_sharing: false }).eq('user_id', user.id).then(() => {});
        }
        buildParticipants(roomRef.current);
      }
    } catch (err: any) {
      releaseWakeLock();
      // Classify errors with specific Turkish messages
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        toast.error('Ekran paylaşımı izni reddedildi', {
          description: 'Android\'de sistem iletişim kutusunda "Şimdi başlat"a dokunun.',
        });
      } else if (err.name === 'NotFoundError') {
        toast.error('Ekran yakalama kaynağı bulunamadı', {
          description: 'Paylaşılacak ekran veya pencere seçilmedi.',
        });
      } else if (err.name === 'NotReadableError') {
        toast.error('Ekran okunamadı', {
          description: 'Başka bir uygulama ekranı kullanıyor olabilir.',
        });
      } else if (err.name === 'SecurityError') {
        toast.error('Güvenlik hatası', {
          description: 'Bu ortamda ekran paylaşımına izin verilmiyor (HTTPS gerekli).',
        });
      } else if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        toast.error('Ekran paylaşımı başlatılamadı', {
          description: err.message || 'Bilinmeyen hata',
        });
      }
    }
  }, [screenSharing, buildParticipants, acquireWakeLock, releaseWakeLock, stopScreenShareCleanup, showForegroundNotification, user]);

  const toggleSystemAudio = useCallback(async () => {
    const track = screenAudioTrackRef.current;
    if (!track || !roomRef.current) return;
    const newEnabled = !systemAudioEnabled;
    track.enabled = newEnabled;

    // Also mute/unmute the published LiveKit track so other participants are affected
    const pub = roomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
    if (pub) {
      try {
        if (newEnabled) {
          await pub.unmute();
        } else {
          await pub.mute();
        }
      } catch { /* ignore */ }
    }

    setSystemAudioEnabled(newEnabled);
  }, [systemAudioEnabled]);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      cleanupAudio();
      stopKeepAlive();
      screenAudioTrackRef.current?.stop();
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [cleanupAudio, stopKeepAlive]);

  return {
    connected,
    connecting,
    voiceChannelId,
    voiceChannelName,
    participants,
    micMuted,
    deafened,
    cameraEnabled,
    screenSharing,
    systemAudioEnabled,
    outputVolume,
    connectionQuality,
    room: roomRef.current,
    joinVoice,
    disconnect,
    toggleMic,
    toggleDeafen,
    toggleCamera,
    flipCamera,
    toggleScreenShare,
    toggleSystemAudio,
    setOutputVolume,
  };
};
