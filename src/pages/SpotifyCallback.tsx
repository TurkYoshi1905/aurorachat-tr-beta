import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'baf63b79285f4d6db3ed80c49ad8f302';

const processedCodes = new Set<string>();

const SpotifyCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Spotify hesabı bağlanıyor...');
  const [spotifyName, setSpotifyName] = useState('');

  useEffect(() => {
    if (authLoading) return;

    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Spotify bağlantısı reddedildi.');
      setTimeout(() => navigate('/settings?tab=connections'), 2500);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Geçersiz istek: yetkilendirme kodu bulunamadı.');
      setTimeout(() => navigate('/settings?tab=connections'), 2500);
      return;
    }

    if (processedCodes.has(code)) return;

    if (!user) {
      setStatus('error');
      setMessage('Oturum bilgisi bulunamadı, lütfen tekrar giriş yapın.');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    processedCodes.add(code);

    const handleCallback = async () => {
      const verifier = sessionStorage.getItem('spotify_code_verifier');
      if (!verifier) {
        processedCodes.delete(code);
        setStatus('error');
        setMessage('Oturum süresi doldu. Lütfen tekrar "Spotify ile Bağlan" butonuna basın.');
        setTimeout(() => navigate('/settings?tab=connections'), 3000);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/spotify-callback`;

        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          if (tokenRes.status === 400 && err.includes('redirect')) {
            throw new Error('redirect_mismatch');
          }
          throw new Error(`token_exchange_failed: ${tokenRes.status}`);
        }

        const tokens = await tokenRes.json();
        sessionStorage.removeItem('spotify_code_verifier');

        let displayName = '';
        let email = '';
        let spotifyId = '';

        const profileRes = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (profileRes.ok) {
          const profile = await profileRes.json();
          displayName = profile.display_name || profile.id || '';
          email = profile.email || '';
          spotifyId = profile.id || '';
        } else if (profileRes.status === 403) {
          console.warn('[Spotify] /v1/me returned 403 — dev mode restriction');
        } else {
          console.warn('[Spotify] /v1/me returned', profileRes.status);
        }

        const { data, error: fnError } = await supabase.functions.invoke('spotify-token', {
          body: {
            action: 'store',
            user_id: user.id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            display_name: displayName,
            email,
            spotify_id: spotifyId,
          },
        });

        if (fnError) throw new Error(fnError.message || 'Sunucu hatası');
        if (data?.error === 'DB_UPSERT_FAILED') throw new Error('DB_UPSERT_FAILED');

        setSpotifyName(displayName || 'Spotify Hesabı');
        setStatus('success');
        setMessage('Hesabın AuroraChat ile ilişkilendirildi!');
        toast.success('Spotify hesabı başarıyla bağlandı!');
        setTimeout(() => navigate('/settings?tab=connections'), 2000);
      } catch (err: any) {
        processedCodes.delete(code);
        const msg = (err?.message || '');
        if (msg === 'DB_UPSERT_FAILED') {
          setMessage('Bağlantı bilgileri kaydedilemedi. Lütfen tekrar dene.');
        } else if (msg === 'redirect_mismatch' || msg.toLowerCase().includes('redirect')) {
          setMessage('Yönlendirme adresi uyuşmuyor. Spotify Dashboard\'daki Redirect URI doğru mu kontrol et.');
        } else {
          setMessage('Bağlantı kurulurken hata oluştu. Tekrar dene.');
        }
        setStatus('error');
        setTimeout(() => navigate('/settings?tab=connections'), 5000);
      }
    };

    handleCallback();
  }, [authLoading, user]);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-card border border-border max-w-sm w-full mx-4 text-center shadow-2xl">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
          status === 'success' ? 'bg-[#1DB954]/20 shadow-[0_0_30px_#1DB95440]' :
          status === 'error' ? 'bg-destructive/20' :
          'bg-[#1DB954]/10'
        }`}>
          {status === 'loading' && (
            <div className="w-10 h-10 border-2 border-[#1DB954]/30 border-t-[#1DB954] rounded-full animate-spin" />
          )}
          {status === 'success' && (
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          )}
          {status === 'error' && (
            <span className="text-3xl text-destructive">✕</span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
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
