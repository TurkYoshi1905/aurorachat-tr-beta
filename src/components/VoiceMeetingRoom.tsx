import { useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Headphones, HeadphoneOff,
  Camera, CameraOff, Monitor, MonitorX, PhoneOff,
  Users, MonitorPlay, MessageSquare, Volume2, VolumeX,
} from 'lucide-react';
import { Track, type Room, type Participant } from 'livekit-client';
import type { VoiceState, VoiceParticipant } from '@/hooks/useVoice';
import { useTranslation } from '@/i18n';

interface VoiceMeetingRoomProps {
  voiceState: VoiceState;
  onToggleChat?: () => void;
  showChat?: boolean;
  isMobile?: boolean;
}

interface TileProps {
  participant: VoiceParticipant;
  room: Room | null;
  isLocal: boolean;
  fillMode?: boolean;
}

const ParticipantTile = ({ participant, room, isLocal, fillMode = false }: TileProps) => {
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
  const avatarSize = fillMode ? 'w-28 h-28 text-4xl' : 'w-16 h-16 text-2xl';

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
        <div className="flex flex-col items-center justify-center w-full h-full gap-3">
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

  useEffect(() => {
    if (!room || !videoRef.current) return;
    let lkParticipant: Participant | undefined;
    if (sharerIdentity === room.localParticipant.identity) lkParticipant = room.localParticipant;
    else lkParticipant = room.remoteParticipants.get(sharerIdentity);
    if (!lkParticipant) return;
    const pub = lkParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (pub?.videoTrack && videoRef.current) {
      pub.videoTrack.attach(videoRef.current);
      return () => { if (videoRef.current) pub.videoTrack?.detach(videoRef.current); };
    }
  }, [sharerIdentity, room]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-contain rounded-xl"
      style={{ background: '#000' }}
    />
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

const VoiceMeetingRoom = ({ voiceState, onToggleChat, showChat, isMobile = false }: VoiceMeetingRoomProps) => {
  const { t } = useTranslation();
  const {
    participants, micMuted, deafened, cameraEnabled, screenSharing, systemAudioEnabled, room,
    voiceChannelName, toggleMic, toggleDeafen, toggleCamera, toggleScreenShare, toggleSystemAudio, disconnect,
  } = voiceState;

  const sharingParticipant = participants.find((p) => p.screenSharing);
  const localParticipant = participants[0];
  const count = participants.length;

  const getGridClass = () => {
    if (isMobile) {
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-1';
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

      {/* Main content */}
      <div className={`flex-1 overflow-hidden ${isMobile ? 'p-2' : 'p-3'} flex flex-col gap-2 min-h-0`}>
        {sharingParticipant ? (
          isMobile ? (
            /* Mobile screen share: stack vertically */
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-3.5 h-3.5 text-[#00ff88]" />
                <span className="text-xs text-white/50">
                  {sharingParticipant.identity === localParticipant?.identity
                    ? t('voice.youAreSharing')
                    : `${sharingParticipant.displayName} ${t('voice.isSharing')}`}
                </span>
              </div>
              <div className="flex-1 min-h-0 rounded-xl overflow-hidden ring-1 ring-white/8" style={{ background: '#000' }}>
                <ScreenShareView sharerIdentity={sharingParticipant.identity} room={room} />
              </div>
              <div className="flex gap-2 h-20 overflow-x-auto shrink-0">
                {participants.map((p) => (
                  <div key={p.identity} className="w-28 shrink-0 h-full">
                    <ParticipantTile participant={p} room={room} isLocal={p.identity === localParticipant?.identity} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex gap-3 min-h-0">
              {/* Screen share main view */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <MonitorPlay className="w-4 h-4 text-[#00ff88]" />
                  <span className="text-xs text-white/50">
                    {sharingParticipant.identity === localParticipant?.identity
                      ? t('voice.youAreSharing')
                      : `${sharingParticipant.displayName} ${t('voice.isSharing')}`}
                  </span>
                </div>
                <div className="flex-1 min-h-0 rounded-2xl overflow-hidden ring-1 ring-white/8"
                  style={{ background: '#000' }}>
                  <ScreenShareView sharerIdentity={sharingParticipant.identity} room={room} />
                </div>
              </div>
              {/* Participants sidebar — fixed width, no overlap */}
              <div className="flex flex-col gap-2 w-48 shrink-0 overflow-y-auto">
                {participants.map((p) => (
                  <div key={p.identity} className="w-full rounded-xl overflow-hidden" style={{ height: '108px' }}>
                    <ParticipantTile participant={p} room={room} isLocal={p.identity === localParticipant?.identity} />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
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
                <ParticipantTile participant={p} room={room} isLocal={p.identity === localParticipant?.identity} fillMode={count === 1} />
              </div>
            ))}
          </div>
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
