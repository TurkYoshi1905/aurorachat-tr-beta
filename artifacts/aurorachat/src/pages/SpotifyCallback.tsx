import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'baf63b79285f4d6db3ed80c49ad8f302';

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Spotify hesabı bağlanıyor...');
  const [spotifyName, setSpotifyName] = useState('');
  const handledRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (handledRef.current) return;
      handledRef.current = true;

      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const errorParam = params.get('error');

      if (errorParam || !code) {
        setStatus('error');
        setMessage(errorParam === 'access_denied' ? 'Spotify erişimi reddedildi.' : 'Spotify yetkilendirme kodu alınamadı.');
        setTimeout(() => navigate('/settings?tab=connections'), 4000);
        return;
      }

      const codeVerifier = localStorage.getItem('spotify_pkce_verifier');
      localStorage.removeItem('spotify_pkce_verifier');

      if (!codeVerifier) {
        setStatus('error');
        setMessage('Oturum bilgisi bulunamadı. Lütfen tekrar dene.');
        setTimeout(() => navigate('/settings?tab=connections'), 4000);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/spotify-callback`;

        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: SPOTIFY_CLIENT_ID,
            code_verifier: codeVerifier,
          }),
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.json().catch(() => ({}));
          throw new Error(errData.error_description || 'Token alınamadı');
        }

        const tokenData = await tokenRes.json();
        const accessToken: string = tokenData.access_token;
        const refreshToken: string = tokenData.refresh_token || '';
        const expiresIn: number = tokenData.expires_in || 3600;

        let displayName = '';
        let email = '';
        let spotifyId = '';
        let avatarUrl = '';

        const profileRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (profileRes.ok) {
          const prof = await profileRes.json();
          displayName = prof.display_name || prof.id || '';
          email = prof.email || '';
          spotifyId = prof.id || '';
          if (Array.isArray(prof.images) && prof.images.length > 0) {
            avatarUrl = prof.images[0].url || '';
          }
        } else if (profileRes.status === 403) {
          console.warn('[Spotify] /v1/me returned 403 — geliştirici modu kısıtlaması');
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session) throw new Error('Oturum bulunamadı');

        const { data, error: fnError } = await supabase.functions.invoke('spotify-token', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {
            action: 'store',
            user_id: session.user.id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: expiresIn,
            display_name: displayName,
            email,
            spotify_id: spotifyId,
            avatar_url: avatarUrl,
          },
        });

        if (fnError) throw new Error(fnError.message || 'Sunucu hatası');
        if (data?.error === 'DB_UPSERT_FAILED') throw new Error('DB_UPSERT_FAILED');

        setSpotifyName(displayName || email || 'Spotify');
        setStatus('success');
        setMessage('Hesabın AuroraChat ile ilişkilendirildi!');
        toast.success('Spotify hesabı başarıyla bağlandı!');
        setTimeout(() => navigate('/settings?tab=connections'), 2000);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg === 'DB_UPSERT_FAILED') {
          setMessage('Bağlantı bilgileri kaydedilemedi. Lütfen tekrar dene.');
        } else {
          setMessage(`Bağlantı kurulurken hata oluştu: ${msg || 'Bilinmeyen hata'}`);
        }
        setStatus('error');
        setTimeout(() => navigate('/settings?tab=connections'), 5000);
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-card border border-border max-w-sm w-full mx-4 text-center shadow-2xl">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
            status === 'success'
              ? 'bg-[#1DB954]/20 shadow-[0_0_30px_#1DB95440]'
              : status === 'error'
              ? 'bg-destructive/20'
              : 'bg-[#1DB954]/10'
          }`}
        >
          {status === 'loading' && (
            <div className="w-10 h-10 border-2 border-[#1DB954]/30 border-t-[#1DB954] rounded-full animate-spin" />
          )}
          {status === 'success' && (
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          )}
          {status === 'error' && <span className="text-3xl text-destructive">✕</span>}
        </div>

        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            <h2 className="font-bold text-lg text-foreground">Spotify</h2>
          </div>
          {status === 'success' && spotifyName && (
            <p className="text-sm font-semibold text-[#1DB954] mb-1">{spotifyName}</p>
          )}
          <p className="text-sm text-muted-foreground">{message}</p>
          {status !== 'loading' && (
            <p className="text-xs text-muted-foreground mt-2 opacity-60">Yönlendiriliyorsunuz...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpotifyCallback;
