/**
 * messagePreview.ts
 * Mesaj içeriğini (ham URL, JSON, metin) insan tarafından okunabilir
 * kısa önizleme metnine dönüştürür.
 */

const GIF_DOMAINS = [
  'klipy.co', 'giphy.com', 'tenor.com', 'gph.is',
  'media.giphy', 'media.tenor', 'c.tenor.com',
  'media.discordapp', 'i.giphy.com',
];

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|bmp|svg)(\?|#|$)/i;
const GIF_EXTENSION = /\.gif(\?|#|$)/i;

/**
 * Ham mesaj içeriğini DM listesi / bildirim için kısa önizleme metnine çevirir.
 *
 * @param content    - Veritabanından gelen ham `content` değeri
 * @param attachments - Varsa ek dosya URL dizisi
 * @param isMine     - true → "Gönderdin.", false → "Gönderildi.", undefined → nötr
 */
export function getMessagePreview(
  content: string,
  attachments?: string[] | null,
  isMine?: boolean,
): string {
  const sent  = isMine === true  ? 'Gönderdin.'  : '';
  const recv  = isMine === false ? 'Gönderildi.' : '';
  const suffix = isMine === true ? sent : isMine === false ? recv : '';

  // ── Sesli mesaj ──────────────────────────────────────────────────────────
  if (content && content.startsWith('{"__vn"')) {
    return suffix ? `🎙 Bir Sesli Mesaj ${suffix}` : '🎙 Sesli Mesaj';
  }

  // ── Ek dosya/resim ───────────────────────────────────────────────────────
  if (attachments && attachments.length > 0) {
    const first = attachments[0].toLowerCase();
    if (IMAGE_EXTENSIONS.test(first) || GIF_EXTENSION.test(first)) {
      return suffix ? `🖼 Bir Resim ${suffix}` : '🖼 Resim';
    }
    return suffix ? `📎 Bir Dosya ${suffix}` : '📎 Dosya';
  }

  // ── GIF veya Resim URL (GIF Picker / ImagePicker kaynaklı) ──────────────
  if (content && /^https?:\/\//i.test(content.trim())) {
    const lower = content.toLowerCase();
    if (GIF_EXTENSION.test(lower) || GIF_DOMAINS.some(d => lower.includes(d))) {
      return suffix ? `🖼 Bir Gif ${suffix}` : '🖼 Gif';
    }
    if (IMAGE_EXTENSIONS.test(lower)) {
      return suffix ? `🖼 Bir Resim ${suffix}` : '🖼 Resim';
    }
    // Diğer URL'ler (link önizlemesi vs.) — dosya olarak göster
    return suffix ? `📎 Bir Dosya ${suffix}` : '📎 Dosya';
  }

  return content;
}

/**
 * Bildirim gövdesi için sade, emoji içermeyen önizleme.
 */
export function getNotificationPreview(
  content: string,
  attachments?: string[] | null,
): string {
  if (!content && attachments?.length) return '📎 Dosya gönderdi';
  if (!content) return '';
  if (content.startsWith('{"__vn"')) return '🎙 Sesli mesaj gönderdi';
  if (/^https?:\/\//i.test(content.trim())) {
    const lower = content.toLowerCase();
    if (GIF_EXTENSION.test(lower) || GIF_DOMAINS.some(d => lower.includes(d))) {
      return '🖼 Gif gönderdi';
    }
    if (IMAGE_EXTENSIONS.test(lower)) return '🖼 Resim gönderdi';
    return '📎 Dosya gönderdi';
  }
  return content;
}
