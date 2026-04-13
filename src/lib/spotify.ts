const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'baf63b79285f4d6db3ed80c49ad8f302';
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-private',
  'user-read-email',
].join(' ');

function getRedirectUri() {
  return `${window.location.origin}/spotify-callback`;
}

function generateCodeVerifier(length = 128): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map(v => possible[v % possible.length]).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function initiateSpotifyOAuth() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem('spotify_code_verifier', verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const verifier = sessionStorage.getItem('spotify_code_verifier');
  if (!verifier) throw new Error('Code verifier not found');

  const redirectUri = getRedirectUri();
  console.log('[Spotify] Token exchange →', { client_id: SPOTIFY_CLIENT_ID, redirect_uri: redirectUri, has_verifier: !!verifier, code_prefix: code.substring(0, 10) });

  const response = await fetch('https://accounts.spotify.com/api/token', {
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

  if (!response.ok) {
    const err = await response.text();
    console.error('[Spotify] Token exchange failed:', response.status, err);
    throw new Error(`Token exchange 400: ${err}`);
  }
  return response.json();
}

export async function refreshSpotifyToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (response.status === 400 || response.status === 401) {
    throw new Error('TOKEN_REFRESH_REVOKED');
  }
  if (response.status === 403) {
    throw new Error('TOKEN_REFRESH_FORBIDDEN');
  }
  if (!response.ok) {
    const errText = await response.text();
    console.error('[Spotify] Token refresh failed:', response.status, errText);
    throw new Error('TOKEN_REFRESH_FAILED');
  }
  return response.json();
}

export async function getCurrentlyPlaying(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 204 || response.status === 404) return null;
  if (response.status === 401) throw new Error('TOKEN_INVALID');
  if (response.status === 403) throw new Error('TOKEN_FORBIDDEN');
  if (!response.ok) throw new Error('Failed to fetch currently playing');
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

export async function getSpotifyProfile(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 403) {
    throw new Error('SPOTIFY_403');
  }
  if (response.status === 401) {
    throw new Error('SPOTIFY_401');
  }
  if (!response.ok) throw new Error('Failed to fetch Spotify profile');
  return response.json();
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
