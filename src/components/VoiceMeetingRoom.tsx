import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  Mic, MicOff, Headphones, HeadphoneOff,
  Camera, CameraOff, Monitor, MonitorX, PhoneOff,
  Users, MonitorPlay, MessageSquare, Volume2, VolumeX,
  QrCode, X as XIcon, Smartphone, RotateCcw,
  Eye, Maximize2, Minimize2, RotateCw,
} from 'lucide-react';
import { RoomEvent, Track, type Room, type Participant } from 'livekit-client';
import type { VoiceState, VoiceParticipant } from '@/hooks/useVoice';
import { useTranslation } from '@/i18n';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceMeetingRoomProps {
  voiceState: VoiceState;
  onToggleChat?: () => void;
  showChat?: boolean;
  isMobile?: boolean;
  serverId?: string | null;
}

interface TileProps {
  participant: VoiceParticipant;
  room: Room | null;
  isLocal: boolean;
  fillMode?: boolean;
  compact?: boolean;
  onWatchStream?: (identity: string) => void;
}

const ParticipantTile = ({ participant, room, isLocal, fillMode = false, compact = false, onWatchStream }: TileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const attachTrack = useCallback(() => {
    if (!room || !videoRef.current || !participant.cameraEnabled) return;
    let lkParticipant: Participant | undefined;
    if (isLocal) lkParticipant = room.localParticipant;
    else lkParticipant = room.remoteParticipants.get(participant.identity);
    if (!lkParticipant) return;
    const pub = lkParticipant.getTrackPublication(Track.Source.Camera);
    if (pub?.videoTrack && videoRef.current) {
      pub.videoTrack.attach(videoRef.current);
    }
  }, [room, participant.cameraEnabled, participant.identity, isLocal]);

  useEffect(() => {
    attachTrack();
    return () => {
      if (!room) return;
      let lkParticipant: Participant | undefined;
      if (isLocal) lkParticipant = room.localParticipant;
      else lkParticipant = room.remoteParticipants.get(participant.identity);
      if (!lkParticipant) return;
      const pub = lkParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.videoTrack && videoRef.current) pub.videoTrack.detach(videoRef.current);
    };
  }, [attachTrack, room, participant.cameraEnabled, participant.identity, isLocal]);

  const initials = participant.displayName.charAt(0).toUpperCase();
  const avatarSize = compact ? 'w-10 h-10 text-base' : fillMode ? 'w-28 h-28 text-4xl' : 'w-16 h-16 text-2xl';

  return (
    <div
      className={`relative rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all duration-300 w-full h-full ${
        participant.isSpeaking
          ? 'ring-2 ring-[#00ff88] shadow-[0_0_32px_rgba(0,255,136,0.3)]'
          : 'ring-1 ring-white/8'
      }`}
      style={{ background: 'linear-gradient(145deg, #161718 0%, #0f0f10 100%)' }}
    >
      {participant.cameraEnabled ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className={`flex flex-col items-center justify-center w-full h-full ${compact ? 'gap-1.5 pb-5' : 'gap-3'}`}>
          <div className="relative">
            {participant.isSpeaking && (
              <div className={`absolute inset-0 rounded-full animate-ping bg-[#00ff88]/30 scale-125`} />
            )}
            {participant.avatarUrl ? (
              <img
                src={participant.avatarUrl}
                alt={participant.displayName}
                className={`rounded-full object-cover ${avatarSize} relative z-10 ${
                  participant.isSpeaking ? 'ring-[3px] ring-[#00ff88] ring-offset-2 ring-offset-[#0f0f10]' : ''
                }`}
              />
            ) : (
              <div
                className={`rounded-full bg-gradient-to-br from-[#5865F2] to-[#7b86f4] flex items-center justify-center font-bold text-white relative z-10 ${avatarSize} ${
                  participant.isSpeaking ? 'ring-[3px] ring-[#00ff88] ring-offset-2 ring-offset-[#0f0f10]' : ''
                }`}
              >
                {initials}
              </div>
            )}
          </div>
          {participant.isSpeaking && (
            <div className="flex gap-1 items-end h-4">
              {[3, 5, 8, 5, 3].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-[#00ff88] rounded-full"
                  style={{
                    height: `${h}px`,
                    animation: `pulse 0.6s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Discord-style "Yayını İzle" button on the sharing user's tile */}
      {participant.screenSharing && !isLocal && onWatchStream && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onWatchStream(participant.identity); }}
          className="absolute inset-0 flex items-center justify-center bg-black/45 hover:bg-black/30 transition-colors z-10 group/watch"
          data-testid={`watch-stream-${participant.identity}`}
        >
          <span
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-transform group-hover/watch:scale-105"
            style={{
              background: '#00ff88',
              color: '#0a1a0e',
              boxShadow: '0 0 16px rgba(0,255,136,0.4)',
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Yayını İzle
          </span>
        </button>
      )}
      {participant.screenSharing && isLocal && (
        <div
          className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold z-10"
          style={{
            background: 'rgba(0,255,136,0.15)',
            color: '#00ff88',
            border: '1px solid rgba(0,255,136,0.35)',
          }}
        >
          <MonitorPlay className="w-3 h-3" />
          Yayındasın
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
      >
        <span
          className="text-white text-xs font-semibold truncate flex-1"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {participant.displayName}
          {isLocal && <span className="text-white/40 text-xs ml-1">(Sen)</span>}
        </span>
        <div className="flex gap-1 ml-2 shrink-0">
          {participant.micMuted && <MicOff className="w-3 h-3 text-red-400" />}
          {participant.screenSharing && <MonitorPlay className="w-3 h-3 text-[#00ff88]" />}
          {participant.cameraEnabled && <Camera className="w-3 h-3 text-blue-400" />}
        </div>
      </div>
    </div>
  );
};

const ScreenShareView = ({ sharerIdentity, room }: { sharerIdentity: string; room: Room | null }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attached, setAttached] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const isLocal = room ? sharerIdentity === room.localParticipant.identity : false;

  useEffect(() => {
    if (isLocal || !room || !videoRef.current) return;
    const video = videoRef.current;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    setLoadTimeout(false);

    const attach = () => {
      const lkParticipant = room.remoteParticipants.get(sharerIdentity);
      const pub = lkParticipant?.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.videoTrack && video) {
        pub.videoTrack.attach(video);
        video.play().catch(() => {});
        return true;
      }
      return false;
    };

    const scheduleAttach = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!attach()) scheduleAttach();
      }, 250);
    };

    const handleTrackSubscribed = () => {
      if (retryTimer) clearTimeout(retryTimer);
      attach();
    };

    const handleLoadedMetadata = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      setAttached(true);
      setLoadTimeout(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('playing', handleLoadedMetadata);

    setAttached(false);
    if (!attach()) scheduleAttach();
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    // After 12 seconds, show timeout state instead of indefinite loading
    timeoutTimer = setTimeout(() => {
      if (!attached) setLoadTimeout(true);
    }, 12000);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('playing', handleLoadedMetadata);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      const lkParticipant = room.remoteParticipants.get(sharerIdentity);
      const pub = lkParticipant?.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.videoTrack) pub.videoTrack.detach(video);
      setAttached(false);
    };
  }, [sharerIdentity, room, isLocal]);

  // Local participant's own share → show informational placeholder (avoid mirror loop)
  if (isLocal) {
    return (
      <div className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-3"
        style={{ background: 'linear-gradient(145deg, #0d1f12 0%, #0a1a0e 100%)' }}>
        <div className="w-16 h-16 rounded-2xl bg-[#00ff88]/10 ring-1 ring-[#00ff88]/30 flex items-center justify-center">
          <MonitorPlay className="w-8 h-8 text-[#00ff88]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white/80">Ekranınızı paylaşıyorsunuz</p>
          <p className="text-xs text-white/40 mt-1">Diğer katılımcılar ekranınızı görüyor</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain rounded-xl"
        style={{ background: '#000' }}
      />
      {!attached && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/50 bg-black rounded-xl">
          {loadTimeout ? (
            <>
              <MonitorPlay className="w-8 h-8 text-yellow-400/70" />
              <span className="text-xs text-yellow-300/70 text-center px-4">Ekran paylaşımı bağlanamadı.<br />Paylaşan kişi bağlantısını kontrol etsin.</span>
            </>
          ) : (
            <>
              <div className="relative">
                <MonitorPlay className="w-8 h-8 text-[#00ff88]" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#00ff88] animate-ping opacity-75" />
              </div>
              <span className="text-xs">Ekran paylaşımı yükleniyor...</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface CtrlBtnProps {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  activeClass: string;
  inactiveClass: string;
  children: React.ReactNode;
}

const CtrlBtn = ({ active, onClick, title, label, activeClass, inactiveClass, children }: CtrlBtnProps) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex flex-col items-center justify-center w-[60px] h-[60px] rounded-2xl gap-1 transition-all duration-200 select-none ${
      active ? activeClass : inactiveClass
    }`}
  >
    {children}
    <span className="text-[10px] leading-none font-medium opacity-70">{label}</span>
  </button>
);

const VoiceMeetingRoom = ({ voiceState, onToggleChat, showChat, isMobile = false, serverId }: VoiceMeetingRoomProps) => {
  const { t } = useTranslation();
  const {
    participants, micMuted, deafened, cameraEnabled, screenSharing, systemAudioEnabled, room,
    voiceChannelName, voiceChannelId, outputVolume, toggleMic, toggleDeafen, toggleCamera, flipCamera, toggleScreenShare, toggleSystemAudio, setOutputVolume, disconnect,
  } = voiceState;

  const [showQRModal, setShowQRModal] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const controlChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const controlSessionId = useMemo(() => crypto.randomUUID(), []);
  const latestControlStateRef = useRef({ micMuted, deafened, cameraEnabled });
  const latestControlActionsRef = useRef({ toggleMic, toggleDeafen, toggleCamera });

  const voiceJoinUrl = voiceChannelId
    ? `${window.location.origin}/voice-remote?session=${controlSessionId}&channelId=${encodeURIComponent(voiceChannelId)}&channelName=${encodeURIComponent(voiceChannelName)}`
    : null;
  const phoneCameraJoinUrl = voiceChannelId
    ? `${window.location.origin}/voice-join?channelId=${encodeURIComponent(voiceChannelId)}&channelName=${encodeURIComponent(voiceChannelName)}${serverId ? `&serverId=${encodeURIComponent(serverId)}` : ''}`
    : null;

  useEffect(() => {
    latestControlStateRef.current = { micMuted, deafened, cameraEnabled };
    latestControlActionsRef.current = { toggleMic, toggleDeafen, toggleCamera };
  }, [micMuted, deafened, cameraEnabled, toggleMic, toggleDeafen, toggleCamera]);

  useEffect(() => {
    if (!voiceChannelId) return;

    const ch = supabase
      .channel(`voice-control:${controlSessionId}`)
      .on('broadcast', { event: 'remote_joined' }, () => {
        setRemoteConnected(true);
        ch.send({
          type: 'broadcast',
          event: 'state',
          payload: latestControlStateRef.current,
        });
      })
      .on('broadcast', { event: 'remote_left' }, () => {
        setRemoteConnected(false);
      })
      .on('broadcast', { event: 'toggle_mic' }, () => {
        latestControlActionsRef.current.toggleMic();
      })
      .on('broadcast', { event: 'toggle_deafen' }, () => {
        latestControlActionsRef.current.toggleDeafen();
      })
      .on('broadcast', { event: 'toggle_camera' }, () => {
        latestControlActionsRef.current.toggleCamera();
      })
      .subscribe();

    controlChannelRef.current = ch;

    return () => {
      ch.send({ type: 'broadcast', event: 'desktop_left', payload: {} });
      if (controlChannelRef.current) {
        supabase.removeChannel(controlChannelRef.current);
        controlChannelRef.current = null;
      }
    };
  }, [voiceChannelId, controlSessionId]);

  useEffect(() => {
    if (!controlChannelRef.current || !remoteConnected) return;
    controlChannelRef.current.send({
      type: 'broadcast',
      event: 'state',
      payload: { micMuted, deafened, cameraEnabled },
    });
  }, [micMuted, deafened, cameraEnabled, remoteConnected]);

  const sharingParticipants = participants.filter((p) => p.screenSharing);
  const localParticipant = participants[0];
  const count = participants.length;

  // Watch-stream state: when null, show normal grid even if someone is sharing.
  // User must click "Yayını İzle" to focus on a stream.
  const [watchingIdentity, setWatchingIdentity] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const focusedViewRef = useRef<HTMLDivElement>(null);

  // If the watched stream stops, reset the watching state
  useEffect(() => {
    if (watchingIdentity && !sharingParticipants.find((p) => p.identity === watchingIdentity)) {
      setWatchingIdentity(null);
      setIsFullscreen(false);
    }
  }, [watchingIdentity, sharingParticipants]);

  // Track fullscreen state changes from native browser
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = focusedViewRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
      // Try landscape orientation lock on mobile
      try {
        const orientation = (screen as any).orientation;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape').catch(() => {});
        }
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('[VoiceMeetingRoom] fullscreen failed', err);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
      try {
        const orientation = (screen as any).orientation;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }, []);

  const toggleLandscape = useCallback(async () => {
    try {
      const orientation = (screen as any).orientation;
      if (!orientation) return;
      const isLandscape = (orientation.type || '').startsWith('landscape');
      if (typeof orientation.lock === 'function') {
        await orientation.lock(isLandscape ? 'portrait' : 'landscape').catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  const watchedSharer = watchingIdentity ? sharingParticipants.find((p) => p.identity === watchingIdentity) : null;

  const getGridClass = () => {
    if (isMobile) {
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-2';
      if (count <= 4) return 'grid-cols-2';
      return 'grid-cols-2';
    }
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full" style={{ background: '#0f0f0f' }}>
      {/* Top bar */}
      <div
        className={`${isMobile ? 'h-11' : 'h-12'} flex items-center px-3 shrink-0 gap-2 border-b border-white/5`}
        style={{ background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <Users className="w-4 h-4 text-[#00ff88] shrink-0" />
        <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-white/80 truncate`}>{t('voice.meetingRoom')}</span>
        <span className="text-white/20 text-sm">·</span>
        <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-white/40 truncate`}>#{voiceChannelName}</span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/40">
            {count} kişi
          </span>
          {/* QR Code button — phone remote control */}
          {voiceJoinUrl && !isMobile && (
            <button
              onClick={() => setShowQRModal(true)}
              title="Telefonla kontrol et — QR kod"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: remoteConnected ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)',
                color: remoteConnected ? '#00ff88' : 'rgba(255,255,255,0.6)',
                border: remoteConnected ? '1px solid rgba(0,255,136,0.3)' : '1px solid transparent',
              }}
              data-testid="button-show-qr"
            >
              <Smartphone className="w-3.5 h-3.5" />
              {remoteConnected ? 'Telefon Bağlı' : 'Telefonla Kontrol'}
            </button>
          )}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              title="Metin sohbetine geç"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {!isMobile && 'Sohbet'}
            </button>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && voiceJoinUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="relative flex flex-col items-center gap-4 rounded-2xl p-6 shadow-2xl"
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <XIcon className="w-4 h-4 text-white/60" />
            </button>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#00ff88]" />
              <span className="text-sm font-semibold text-white">Telefonla Ses Kontrolü</span>
            </div>
            {remoteConnected && (
              <div className="flex items-center gap-1.5 -mt-1 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-[11px] font-semibold text-[#00ff88]">Telefon bağlı!</span>
              </div>
            )}
            <p className="text-xs text-white/40 text-center -mt-1">
              QR'ı okut → telefonundan<br />
              <span className="text-white/60 font-medium">mikrofon, ses ve kamerayı</span> kontrol et
            </p>
            <div className="rounded-xl overflow-hidden p-3" style={{ background: '#fff' }}>
              <QRCodeSVG
                value={voiceJoinUrl}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-[10px] text-white/25 text-center break-all px-2">{voiceJoinUrl}</p>
            {phoneCameraJoinUrl && (
              <a
                href={phoneCameraJoinUrl}
                className="text-[11px] font-semibold text-[#00ff88] hover:underline"
              >
                Telefon kamerasını kullanarak katıl
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 overflow-hidden ${isMobile ? 'p-2' : 'p-3'} flex flex-col gap-2 min-h-0`}>
        {watchedSharer ? (
          /* Focused stream view — Discord-like "Yayını izliyorsun" mode */
          <div
            ref={focusedViewRef}
            className="flex-1 flex flex-col gap-2 min-h-0 bg-black rounded-xl"
          >
            {/* Top bar — sharer name + controls */}
            <div className="flex items-center gap-2 px-3 py-2 shrink-0">
              <MonitorPlay className="w-4 h-4 text-[#00ff88] shrink-0" />
              <span className="text-xs text-white/70 truncate flex-1">
                {watchedSharer.identity === localParticipant?.identity
                  ? t('voice.youAreSharing')
                  : `${watchedSharer.displayName} — yayını izliyorsun`}
              </span>
              {/* Mobile: landscape toggle */}
              {isMobile && (
                <button
                  onClick={toggleLandscape}
                  title="Yatay/dikey çevir"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/8 text-white/70 hover:bg-white/15"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Çevir
                </button>
              )}
              {/* Fullscreen toggle */}
              <button
                onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/8 text-white/70 hover:bg-white/15"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {!isMobile && (isFullscreen ? 'Çık' : 'Tam Ekran')}
              </button>
              {/* Exit watch — back to normal voice grid */}
              <button
                onClick={() => { exitFullscreen(); setWatchingIdentity(null); }}
                title="Yayından çık"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/35"
              >
                <XIcon className="w-3.5 h-3.5" />
                Yayından Çık
              </button>
            </div>
            {/* Stream view */}
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden">
              <ScreenShareView sharerIdentity={watchedSharer.identity} room={room} />
            </div>
          </div>
        ) : (
          <>
            {/* Discord-style: button is rendered ON the sharing user's tile, not in a banner. */}
            <div
              className={`flex-1 grid ${getGridClass()} ${isMobile ? 'gap-2' : 'gap-3'} min-h-0`}
              style={{ gridAutoRows: count === 1 ? '1fr' : undefined, alignContent: 'center' }}
            >
              {participants.map((p) => (
                <div key={p.identity} className={
                  count === 1
                    ? isMobile
                      ? 'h-full max-h-[280px] mx-auto w-full max-w-full'
                      : 'h-full max-h-[460px] mx-auto w-full max-w-[560px]'
                    : isMobile
                      ? 'aspect-square'
                      : 'aspect-video'
                }>
                  <ParticipantTile
                    participant={p}
                    room={room}
                    isLocal={p.identity === localParticipant?.identity}
                    fillMode={count === 1}
                    onWatchStream={setWatchingIdentity}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom control bar — glassmorphism */}
      <div
        className={`shrink-0 ${isMobile ? 'px-2 py-2' : 'px-4 py-3'} border-t border-white/5`}
        style={{
          background: 'rgba(10,10,12,0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div className={`flex items-center justify-center ${isMobile ? 'gap-1.5' : 'gap-2'} flex-wrap`}>
          {/* Mic */}
          <CtrlBtn
            active={!micMuted}
            onClick={toggleMic}
            title={micMuted ? t('voice.unmuteMic') : t('voice.muteMic')}
            label={micMuted ? 'Sessiz' : 'Mikrofon'}
            activeClass="text-white"
            inactiveClass="text-red-400"
          >
            <div className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center transition-all duration-200 ${
              micMuted
                ? 'bg-red-500/20 ring-1 ring-red-500/50'
                : 'bg-[#00ff88]/15 ring-1 ring-[#00ff88]/40'
            }`}>
              {micMuted
                ? <MicOff className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-400`} />
                : <Mic className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-[#00ff88]`} />}
            </div>
          </CtrlBtn>

          {/* Camera */}
          <CtrlBtn
            active={cameraEnabled}
            onClick={toggleCamera}
            title={cameraEnabled ? t('voice.cameraOff') : t('voice.cameraOn')}
            label="Kamera"
            activeClass="text-white"
            inactiveClass="text-white/40"
          >
            <div className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center transition-all duration-200 ${
              cameraEnabled
                ? 'bg-[#5865F2]/25 ring-1 ring-[#5865F2]/60'
                : 'bg-white/5 ring-1 ring-white/10'
            }`}>
              {cameraEnabled
                ? <Camera className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-[#7b86f4]`} />
                : <CameraOff className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-white/40`} />}
            </div>
          </CtrlBtn>

          {/* Camera Flip — only when camera is active on mobile */}
          {cameraEnabled && isMobile && (
            <CtrlBtn
              active={false}
              onClick={flipCamera}
              title="Kamerayı çevir (ön/arka)"
              label="Çevir"
              activeClass="text-white"
              inactiveClass="text-white/60"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 bg-white/10 ring-1 ring-white/20">
                <RotateCcw className="w-4 h-4 text-white/70" />
              </div>
            </CtrlBtn>
          )}

          {/* Screen Share — shown on all devices; getDisplayMedia check happens inside toggleScreenShare */}
          <CtrlBtn
            active={screenSharing}
            onClick={toggleScreenShare}
            title={screenSharing ? t('voice.stopShare') : t('voice.shareScreen')}
            label={screenSharing ? 'Durdur' : 'Ekran'}
            activeClass="text-white"
            inactiveClass="text-white/40"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
              screenSharing
                ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                : 'bg-white/5 ring-1 ring-white/10'
            }`}>
              {screenSharing
                ? <MonitorX className="w-5 h-5 text-emerald-400" />
                : <Monitor className="w-5 h-5 text-white/40" />}
            </div>
          </CtrlBtn>

          <div className={`${isMobile ? 'w-full max-w-[280px] mt-1' : 'w-44 ml-2'} flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 ring-1 ring-white/10`}>
            {outputVolume <= 0 ? <VolumeX className="w-4 h-4 text-white/40 shrink-0" /> : <Volume2 className="w-4 h-4 text-[#00ff88] shrink-0" />}
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(outputVolume * 100)}
              onChange={(e) => setOutputVolume(Number(e.target.value) / 100)}
              className="w-full accent-[#00ff88]"
              aria-label="Gelen ses seviyesi"
            />
            <span className="w-8 text-[10px] text-white/40 text-right">{Math.round(outputVolume * 100)}%</span>
          </div>

          {/* System Audio (only visible when screen sharing) */}
          {screenSharing && !isMobile && (
            <CtrlBtn
              active={systemAudioEnabled}
              onClick={toggleSystemAudio}
              title={systemAudioEnabled ? 'Sistem sesini kapat' : 'Sistem sesini aç'}
              label="Sys Ses"
              activeClass="text-white"
              inactiveClass="text-white/40"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                systemAudioEnabled
                  ? 'bg-yellow-500/20 ring-1 ring-yellow-500/50'
                  : 'bg-white/5 ring-1 ring-white/10'
              }`}>
                {systemAudioEnabled
                  ? <Volume2 className="w-5 h-5 text-yellow-400" />
                  : <VolumeX className="w-5 h-5 text-white/40" />}
              </div>
            </CtrlBtn>
          )}

          {/* Headphones / Deafen */}
          <CtrlBtn
            active={!deafened}
            onClick={toggleDeafen}
            title={deafened ? t('voice.undeafen') : t('voice.deafen')}
            label={deafened ? 'Kapalı' : 'Ses'}
            activeClass="text-white"
            inactiveClass="text-red-400"
          >
            <div className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center transition-all duration-200 ${
              deafened
                ? 'bg-red-500/20 ring-1 ring-red-500/50'
                : 'bg-white/5 ring-1 ring-white/10'
            }`}>
              {deafened
                ? <HeadphoneOff className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-400`} />
                : <Headphones className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-white/60`} />}
            </div>
          </CtrlBtn>

          {/* Separator */}
          <div className={`w-px ${isMobile ? 'h-8' : 'h-10'} rounded-full mx-1`} style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Leave */}
          <button
            onClick={disconnect}
            title={t('voice.leaveChannel')}
            className={`flex flex-col items-center justify-center ${isMobile ? 'w-[48px] h-[48px]' : 'w-[60px] h-[60px]'} rounded-2xl gap-1 transition-all duration-200 select-none group`}
            style={{
              background: 'rgba(239,68,68,0.2)',
              boxShadow: '0 0 0 1px rgba(239,68,68,0.4), 0 4px 16px rgba(239,68,68,0.15)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.85)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px rgba(239,68,68,0.8), 0 4px 24px rgba(239,68,68,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px rgba(239,68,68,0.4), 0 4px 16px rgba(239,68,68,0.15)';
            }}
          >
            <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center`}>
              <PhoneOff className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-400 group-hover:text-white transition-colors`} />
            </div>
            <span className="text-[10px] leading-none font-medium text-red-400 group-hover:text-white transition-colors">Ayrıl</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceMeetingRoom;
