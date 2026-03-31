import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  Track,
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
  room: Room | null;
  joinVoice: (channelId: string, channelName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMic: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleSystemAudio: () => Promise<void>;
}

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://aurorachat-5x5vqe5n.livekit.cloud';

const getParticipantCamera = (p: Participant): boolean => {
  const pub = p.getTrackPublication(Track.Source.Camera);
  return !!(pub && pub.isEnabled && !pub.isMuted);
};

const getParticipantScreen = (p: Participant): boolean => {
  const pub = p.getTrackPublication(Track.Source.ScreenShare);
  return !!(pub && pub.isEnabled);
};

export const useVoice = (): VoiceState => {
  const { user, profile } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const tabIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null);
  const [voiceChannelName, setVoiceChannelName] = useState('');
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
  const speakingRef = useRef<Set<string>>(new Set());

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

  const joinVoice = useCallback(async (channelId: string, channelName: string) => {
    if (!user || !profile) { toast.error('Oturum açmanız gerekiyor.'); return; }

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
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        videoCaptureDefaults: {
          resolution: { width: 1920, height: 1080, frameRate: 30 },
        },
        screenShareCaptureDefaults: {
          resolution: { width: 1920, height: 1080, frameRate: 30 },
          audio: true,
        },
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
        .on(RoomEvent.Disconnected, () => {
          cleanupAudio();
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
        });

      await room.connect(LIVEKIT_URL, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      buildParticipants(room);
      setConnected(true);
      setConnecting(false);
      setMicMuted(false);
      setDeafened(false);
      setCameraEnabled(false);
      setScreenSharing(false);
      setSystemAudioEnabled(false);
      toast.success(`#${channelName} ses kanalına bağlandı`);

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
              roomRef.current.localParticipant.setMicrophoneEnabled(false);
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
      toast.error(`Ses kanalına bağlanılamadı: ${err.message}`);
      setConnecting(false);
      setVoiceChannelId(null);
      setVoiceChannelName('');
      roomRef.current = null;
      cleanupAudio();
    }
  }, [user, profile, voiceChannelId, connected, buildParticipants, cleanupAudio]);

  const disconnect = useCallback(async () => {
    broadcastChannelRef.current?.close();
    broadcastChannelRef.current = null;
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    cleanupAudio();
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
  }, [cleanupAudio]);

  const toggleMic = useCallback(() => {
    if (!roomRef.current) return;
    const newMuted = !micMuted;
    roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
    setMicMuted(newMuted);
    buildParticipants(roomRef.current);
  }, [micMuted, buildParticipants]);

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
      roomRef.current.localParticipant.setMicrophoneEnabled(false);
      setMicMuted(true);
    } else if (!newDeafened) {
      roomRef.current.localParticipant.setMicrophoneEnabled(true);
      setMicMuted(false);
    }

    setDeafened(newDeafened);
  }, [deafened, micMuted]);

  const toggleCamera = useCallback(async () => {
    if (!roomRef.current) return;
    const newState = !cameraEnabled;
    try {
      await roomRef.current.localParticipant.setCameraEnabled(newState);
      setCameraEnabled(newState);
      buildParticipants(roomRef.current);
    } catch (err: any) {
      toast.error('Kamera açılamadı: ' + err.message);
    }
  }, [cameraEnabled, buildParticipants]);

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return;
    const newState = !screenSharing;
    try {
      if (newState) {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          toast.error('Bu cihaz ekran paylaşımını desteklemiyor', {
            description: 'Ekran paylaşımı için masaüstü tarayıcı veya Electron uygulaması kullanın.',
          });
          return;
        }

        // Capture screen — single dialog, audio: true lets browser decide availability
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: true,
        } as any);

        if (!stream) return;

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0] || null;

        if (!videoTrack) return;

        // Handle "Stop sharing" from browser UI
        videoTrack.addEventListener('ended', async () => {
          setScreenSharing(false);
          setSystemAudioEnabled(false);
          screenAudioTrackRef.current = null;
          if (roomRef.current) {
            try {
              await roomRef.current.localParticipant.setScreenShareEnabled(false);
            } catch { /* already stopped */ }
            buildParticipants(roomRef.current);
          }
        });

        // Publish video track directly using the captured stream
        await roomRef.current.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.ScreenShare,
          simulcast: false,
        });

        // Publish audio track to LiveKit so other participants can hear it
        if (audioTrack) {
          screenAudioTrackRef.current = audioTrack;
          await roomRef.current.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.ScreenShareAudio,
          });
          setSystemAudioEnabled(true);
        } else {
          setSystemAudioEnabled(false);
        }
      } else {
        // Stop screen share: unpublish both video and audio tracks
        const local = roomRef.current.localParticipant;
        const screenPub = local.getTrackPublication(Track.Source.ScreenShare);
        const screenAudioPub = local.getTrackPublication(Track.Source.ScreenShareAudio);

        if (screenPub) {
          screenPub.track?.mediaStreamTrack?.stop();
          await local.unpublishTrack(screenPub.track!);
        }
        if (screenAudioPub) {
          screenAudioPub.track?.mediaStreamTrack?.stop();
          await local.unpublishTrack(screenAudioPub.track!);
        }

        screenAudioTrackRef.current?.stop();
        screenAudioTrackRef.current = null;
        setSystemAudioEnabled(false);
      }

      setScreenSharing(newState);
      buildParticipants(roomRef.current);
    } catch (err: any) {
      if (err.message?.includes('Permission denied') || err.name === 'NotAllowedError') {
        toast.error('Ekran paylaşımı izni reddedildi.');
      } else if (err.name !== 'AbortError') {
        toast.error('Ekran paylaşımı başlatılamadı: ' + err.message);
      }
    }
  }, [screenSharing, buildParticipants]);

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
      screenAudioTrackRef.current?.stop();
    };
  }, [cleanupAudio]);

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
    room: roomRef.current,
    joinVoice,
    disconnect,
    toggleMic,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    toggleSystemAudio,
  };
};
