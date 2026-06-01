// Steam integration helpers — public ISteamUser API via CORS proxy.
// No API key required client-side; we route through allorigins.win which proxies arbitrary URLs.
// Users supply their own SteamID64 (17-digit) or vanity URL — we resolve via Steam's public XML profile endpoint.

const CORS_PROXY = 'https://api.allorigins.win/get?url=';

function viaProxy(url: string): string {
  return `${CORS_PROXY}${encodeURIComponent(url)}`;
}

async function fetchProxied(url: string): Promise<string> {
  const res = await fetch(viaProxy(url));
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const json = await res.json();
  if (!json?.contents) throw new Error('empty proxy response');
  return json.contents as string;
}

export interface SteamProfile {
  steamId: string;
  persona: string;
  avatarUrl: string;
  profileUrl: string;
}

const SteamId64Regex = /^[0-9]{17}$/;

export function extractSteamInput(raw: string): { type: 'id' | 'vanity' | 'url'; value: string } {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('empty');
  if (SteamId64Regex.test(trimmed)) return { type: 'id', value: trimmed };

  // URL forms
  const urlMatch = trimmed.match(/steamcommunity\.com\/(profiles|id)\/([^\/\s?#]+)/i);
  if (urlMatch) {
    const kind = urlMatch[1].toLowerCase();
    const val = decodeURIComponent(urlMatch[2]);
    if (kind === 'profiles' && SteamId64Regex.test(val)) return { type: 'id', value: val };
    return { type: 'vanity', value: val };
  }

  return { type: 'vanity', value: trimmed };
}

function parseProfileXml(xml: string): SteamProfile | null {
  const get = (tag: string) => {
    const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : '';
  };
  const steamId = get('steamID64');
  const persona = get('steamID');
  const avatarUrl = get('avatarFull') || get('avatarMedium') || get('avatarIcon');
  if (!steamId) return null;
  return {
    steamId,
    persona: persona || steamId,
    avatarUrl,
    profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
  };
}

export async function resolveSteamProfile(rawInput: string): Promise<SteamProfile> {
  const input = extractSteamInput(rawInput);
  let xmlUrl: string;
  if (input.type === 'id') {
    xmlUrl = `https://steamcommunity.com/profiles/${input.value}/?xml=1`;
  } else {
    xmlUrl = `https://steamcommunity.com/id/${encodeURIComponent(input.value)}/?xml=1`;
  }
  const xml = await fetchProxied(xmlUrl);
  const profile = parseProfileXml(xml);
  if (!profile) throw new Error('Profile not found or private');
  return profile;
}
