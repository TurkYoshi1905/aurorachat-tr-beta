import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ExternalLink, Music2, Gamepad2, Link2, SkipBack, Play, Pause, SkipForward } from 'lucide-react';
import { formatDuration } from '@/lib/spotify';

interface ProfileSnapshot {
  display_name: string;
  username: string;
  avatar_url: string | null;
  spotify_display_name?: string | null;
  steam_id?: string | null;
  steam_persona?: string | null;
  steam_profile_url?: string | null;
  steam_avatar_url?: string | null;
  steam_game_name?: string | null;
}

interface SpotifyNowPlaying {
  is_playing: boolean;
  track_name: string;
  artist_name: string;
  album_art_url: string | null;
  track_url: string | null;
  duration_ms: number;
  progress_ms: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  profile: ProfileSnapshot | null;
  spotifyPlaying: SpotifyNowPlaying | null;
  localProgressMs: number;
  isSelf: boolean;
  isControlling: boolean;
  onSpotifyControl: (cmd: 'play' | 'pause' | 'next' | 'prev') => void;
}

const ConnectionsModal = ({
  open, onClose, profile, spotifyPlaying, localProgressMs, isSelf, isControlling, onSpotifyControl,
}: Props) => {
  if (!profile) return null;

  const hasSpotify = !!(profile.spotify_display_name || (spotifyPlaying && spotifyPlaying.track_name));
  const hasSteam = !!(profile.steam_id && profile.steam_persona);
  const hasConnections = hasSpotify || hasSteam;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-[#1e1f22] border-[#2b2d31]">
        {/* Header gradient */}
        <div className="h-16 w-full bg-gradient-to-br from-primary/40 via-primary/20 to-transparent" />

        {/* Avatar + name */}
        <div className="px-5 -mt-10 pb-3 flex items-end gap-3">
          <Avatar className="h-16 w-16 border-4 border-[#1e1f22] shrink-0 shadow-xl">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} className="object-cover" />}
            <AvatarFallback className="bg-[#5865f2] text-white text-xl font-bold">
              {profile.display_name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="pb-1 min-w-0">
            <DialogHeader>
              <DialogTitle className="text-left text-base font-bold text-white leading-tight truncate">
                {profile.display_name}
              </DialogTitle>
            </DialogHeader>
            <p className="text-[12px] text-[#b5bac1] truncate">@{profile.username}</p>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3 h-3 text-[#b5bac1]" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#b5bac1]">Bağlantılar</p>
          </div>

          {!hasConnections && (
            <div className="rounded-xl bg-[#2b2d31] border border-[#3f4147] px-4 py-5 text-center">
              <p className="text-sm text-[#6d6f78]">Bu kullanıcının bağlı hesabı yok.</p>
            </div>
          )}

          {/* Spotify */}
          {(hasSpotify || (spotifyPlaying && spotifyPlaying.track_name)) && (
            <div className="rounded-xl overflow-hidden border border-[#1DB954]/25 bg-[#1DB954]/5">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="#1DB954">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                {spotifyPlaying?.is_playing && spotifyPlaying.track_name ? (
                  <>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#1DB954]">Şu an çalıyor</span>
                    <div className="ml-auto flex gap-0.5 items-end h-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-0.5 bg-[#1DB954] rounded-full animate-pulse" style={{ height: `${40 + i * 20}%`, animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1DB954]">Spotify · Bağlı</span>
                )}
              </div>

              {spotifyPlaying?.is_playing && spotifyPlaying.track_name ? (
                <>
                  <div className="flex items-center gap-2.5 px-3 pb-2">
                    {spotifyPlaying.album_art_url ? (
                      <img src={spotifyPlaying.album_art_url} alt="Album" className="w-11 h-11 rounded-md object-cover shrink-0 shadow" />
                    ) : (
                      <div className="w-11 h-11 rounded-md bg-[#1DB954]/20 flex items-center justify-center shrink-0">
                        <Music2 className="w-5 h-5 text-[#1DB954]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate leading-tight">{spotifyPlaying.track_name}</p>
                      <p className="text-[11px] text-[#b5bac1] truncate">{spotifyPlaying.artist_name}</p>
                      {spotifyPlaying.duration_ms > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          <div className="w-full h-1 bg-[#3f4147] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1DB954] rounded-full"
                              style={{ width: `${Math.min(100, (localProgressMs / spotifyPlaying.duration_ms) * 100)}%`, transition: 'width 1s linear' }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-[#6d6f78]">
                            <span>{formatDuration(localProgressMs)}</span>
                            <span>{formatDuration(spotifyPlaying.duration_ms)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {spotifyPlaying.track_url && (
                      <a
                        href={spotifyPlaying.track_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 w-7 h-7 rounded-full bg-[#1DB954]/15 flex items-center justify-center hover:bg-[#1DB954]/30 transition-colors"
                        title="Spotify'da Aç"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#1DB954]" />
                      </a>
                    )}
                  </div>
                  {isSelf && (
                    <div className="flex items-center justify-center gap-1 px-3 pb-2.5">
                      <button
                        onClick={() => onSpotifyControl('prev')}
                        disabled={isControlling}
                        className="p-1.5 rounded-full text-[#1DB954]/70 hover:text-[#1DB954] hover:bg-[#1DB954]/10 transition-colors disabled:opacity-40"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSpotifyControl(spotifyPlaying.is_playing ? 'pause' : 'play')}
                        disabled={isControlling}
                        className="p-2 rounded-full bg-[#1DB954]/15 text-[#1DB954] hover:bg-[#1DB954]/30 transition-colors disabled:opacity-40"
                      >
                        {spotifyPlaying.is_playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onSpotifyControl('next')}
                        disabled={isControlling}
                        className="p-1.5 rounded-full text-[#1DB954]/70 hover:text-[#1DB954] hover:bg-[#1DB954]/10 transition-colors disabled:opacity-40"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-3 pb-3">
                  <p className="text-[12px] text-[#b5bac1]">{profile.spotify_display_name || 'Spotify'}</p>
                  <p className="text-[11px] text-[#6d6f78]">Şu an müzik çalmıyor</p>
                </div>
              )}
            </div>
          )}

          {/* Steam */}
          {hasSteam && (
            <div className="rounded-xl overflow-hidden border border-[#66c0f4]/25 bg-[#1b2838]/40">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <Gamepad2 className="w-3.5 h-3.5 text-[#66c0f4] shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#66c0f4]">Steam · Bağlı</span>
              </div>
              <a
                href={profile.steam_profile_url || `https://steamcommunity.com/profiles/${profile.steam_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 pb-3 hover:bg-[#66c0f4]/5 transition-colors"
              >
                {profile.steam_avatar_url ? (
                  <img src={profile.steam_avatar_url} alt="" className="w-10 h-10 rounded-md object-cover shrink-0 shadow ring-1 ring-[#66c0f4]/30" />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-[#1b2838] flex items-center justify-center shrink-0 ring-1 ring-[#66c0f4]/30">
                    <Gamepad2 className="w-5 h-5 text-[#66c0f4]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate leading-tight">{profile.steam_persona}</p>
                  {profile.steam_game_name ? (
                    <p className="text-[11px] text-[#66c0f4] truncate flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#66c0f4] animate-pulse" />
                      {profile.steam_game_name} oynuyor
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#b5bac1] truncate flex items-center gap-1">
                      Profili Görüntüle <ExternalLink className="w-2.5 h-2.5" />
                    </p>
                  )}
                </div>
              </a>
            </div>
          )}

          <Button variant="outline" className="w-full border-[#3f4147] text-[#b5bac1] hover:text-white hover:bg-[#35373c]" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionsModal;
