import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Sparkles, Wifi, WifiOff } from 'lucide-react';

const VoiceRemote = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const session = params.get('session') || '';
  const channelName = params.get('channelName') || 'Ses Kanalı';

  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [connected, setConnected] = useState(false);
  const [desktopOnline, setDesktopOnline] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!session) {
      navigate('/');
      return;
    }

    const ch = supabase
      .channel(`voice-control:${session}`)
      .on('broadcast', { event: 'state' }, ({ payload }: any) => {
        if (typeof payload.micMuted === 'boolean') setMicMuted(payload.micMuted);
        if (typeof payload.deafened === 'boolean') setDeafened(payload.deafened);
        setDesktopOnline(true);
      })
      .on('broadcast', { event: 'desktop_left' }, () => {
        setDesktopOnline(false);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          ch.send({ type: 'broadcast', event: 'remote_joined', payload: {} });
        }
      });

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session]);

  const sendCommand = async (event: string) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: 'broadcast', event, payload: {} });
  };

  const handleToggleMic = () => sendCommand('toggle_mic');
  const handleToggleDeafen = () => sendCommand('toggle_deafen');
  const handleLeave = () => {
    sendCommand('remote_left');
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f0f] overflow-hidden select-none">
      <div
        className="shrink-0 h-12 flex items-center px-4 gap-3 border-b border-white/8"
        style={{ background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-white/80">AuroraChat</span>
        <span className="text-white/20">·</span>
        <span className="text-sm text-white/40 truncate">#{channelName}</span>
        <div className="ml-auto flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-medium">
              <Wifi className="w-3 h-3" />
              Bağlı
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] text-white/30 font-medium">
              <WifiOff className="w-3 h-3" />
              Bağlanıyor...
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-center">
          <p className="text-white/50 text-sm font-medium mb-1">Uzaktan Ses Kontrolü</p>
          <p className="text-white/25 text-xs">
            {desktopOnline ? 'Masaüstü bağlı — komutlar iletiliyor' : 'Masaüstü bekleniyor...'}
          </p>
        </div>

        <div
          className="w-3 h-3 rounded-full"
          style={{
            background: desktopOnline ? '#00ff88' : 'rgba(255,255,255,0.15)',
            boxShadow: desktopOnline ? '0 0 16px #00ff88' : 'none',
          }}
        />

        <div className="flex gap-6">
          <button
            onClick={handleToggleMic}
            disabled={!connected || !desktopOnline}
            className="flex flex-col items-center gap-2.5 disabled:opacity-40"
          >
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-200"
              style={{
                background: micMuted
                  ? 'rgba(239,68,68,0.2)'
                  : 'rgba(0,255,136,0.12)',
                boxShadow: micMuted
                  ? '0 0 0 1.5px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)'
                  : '0 0 0 1.5px rgba(0,255,136,0.4), 0 0 20px rgba(0,255,136,0.15)',
              }}
            >
              {micMuted
                ? <MicOff className="w-10 h-10 text-red-400" />
                : <Mic className="w-10 h-10 text-[#00ff88]" />}
            </div>
            <span className="text-xs font-semibold" style={{ color: micMuted ? '#f87171' : '#00ff88' }}>
              {micMuted ? 'Mikrofon Kapalı' : 'Mikrofon Açık'}
            </span>
          </button>

          <button
            onClick={handleToggleDeafen}
            disabled={!connected || !desktopOnline}
            className="flex flex-col items-center gap-2.5 disabled:opacity-40"
          >
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-200"
              style={{
                background: deafened
                  ? 'rgba(239,68,68,0.2)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: deafened
                  ? '0 0 0 1.5px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)'
                  : '0 0 0 1.5px rgba(255,255,255,0.12)',
              }}
            >
              {deafened
                ? <HeadphoneOff className="w-10 h-10 text-red-400" />
                : <Headphones className="w-10 h-10 text-white/60" />}
            </div>
            <span className="text-xs font-semibold" style={{ color: deafened ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
              {deafened ? 'Ses Kapalı' : 'Ses Açık'}
            </span>
          </button>
        </div>

        <p className="text-white/20 text-xs text-center max-w-[220px] leading-relaxed">
          Bu kontroller masaüstündeki ses oturumunu etkiler
        </p>
      </div>

      <div
        className="shrink-0 flex items-center justify-center px-6 py-5 border-t border-white/5"
        style={{ background: 'rgba(15,15,15,0.98)', backdropFilter: 'blur(16px)' }}
      >
        <button
          onClick={handleLeave}
          className="flex flex-col items-center gap-1.5"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.2)', boxShadow: '0 0 0 1px rgba(239,68,68,0.4)' }}
          >
            <PhoneOff className="w-7 h-7 text-red-400" />
          </div>
          <span className="text-[10px] font-medium text-red-400">Çıkış</span>
        </button>
      </div>
    </div>
  );
};

export default VoiceRemote;
