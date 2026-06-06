# AuroraChat

Türkiye'nin modern iletişim platformu — sunucular, kanallar, sesli/görüntülü görüşme ve gerçek zamanlı mesajlaşmayı tek çatı altında buluşturan, Discord benzeri tam özellikli bir topluluk ve sohbet uygulaması.

## Uygulamanın Amacı

AuroraChat; kullanıcıların kendi sunucularını kurmasına, metin/ses/görüntü kanalları oluşturmasına, direkt mesaj ve grup DM ile iletişim kurmasına olanak tanır. Bot geliştirme merkezi, eklenti/tema marketi, duyuru sistemi ve gelişmiş moderasyon araçlarıyla yalnızca bir sohbet uygulaması değil; eksiksiz bir topluluk yönetim platformudur. Türkçe arayüz ve Türkiye lokalizasyonu ile yerel kullanıcılara birinci sınıf deneyim sunmayı hedefler.

**Admin hesabı:** `asfurkan140@gmail.com` — duyuru yayını ve moderasyon paneline bu hesapla erişilir.

## Run & Operate

```bash
pnpm --filter @workspace/aurorachat run dev   # frontend (workflow: artifacts/aurorachat: web)
pnpm --filter @workspace/api-server run dev   # API sunucusu (yardımcı rol)
pnpm run build                                 # tüm paketleri derle
pnpm run typecheck                             # tip kontrolü
```

### Gerekli Ortam Değişkenleri
| Değişken | Açıklama |
|---|---|
| `VITE_SUPABASE_URL` | Supabase proje URL'si |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |

> Şu an `src/integrations/supabase/client.ts` içinde fallback değerler hardcode'dur. Replit Secrets'a yukarıdaki değişkenleri ekleyerek override edilebilir.

## Stack

### Frontend
| Katman | Teknoloji |
|---|---|
| Framework | React 18 + Vite |
| Dil | TypeScript (strict) |
| Stil | Tailwind CSS v3 (PostCSS) + shadcn/ui + Radix UI |
| Animasyon | Framer Motion |
| State Yönetimi | TanStack Query v5 + React Context API |
| Routing | React Router v6 |
| İkonlar | Lucide React |
| Form | React Hook Form + Zod |
| Sürükle-Bırak | @dnd-kit/core + @dnd-kit/sortable |
| QR Kod | qrcode.react + jsqr |
| Paket Yöneticisi | pnpm (workspace) |

### Backend & Altyapı
| Katman | Teknoloji |
|---|---|
| Veritabanı | Supabase PostgreSQL |
| Auth | Supabase Auth (e-posta, OAuth, MFA/TOTP) |
| Gerçek Zamanlı | Supabase Realtime (WebSocket) |
| Depolama | Supabase Storage (dosya, resim, banner) |
| Edge Functions | Supabase Functions (Spotify token, reCAPTCHA, link önizleme) |
| Ses/Video | LiveKit Client (WebRTC) |
| Cron | pg_cron (5 dk'da bir bayat durum sıfırlama) |

### Masaüstü & Mobil
| Platform | Teknoloji |
|---|---|
| Windows/Linux/macOS | Electron + electron-builder |
| Native Masaüstü | Tauri (Rust tabanlı) |
| Android APK | `public/AuroraChat_V1.0.5.apk` |
| PWA | Service Worker (`public/sw.js`) |

## Özellikler

### İletişim
- Sunucu bazlı metin kanalları (gerçek zamanlı, Supabase Realtime)
- Sesli ve görüntülü kanallar (LiveKit WebRTC) + ekran paylaşımı
- Direkt mesajlar (DM) ve Grup DM
- Grup DM sesli arama — gelen arama banner'ı, yeniden arama, yeniden boyutlandırılabilir oda (140–520 px sürükle)
- Dosya ve resim paylaşımı (Supabase Storage)
- GIF picker, emoji otomatik tamamlama, @mention sistemi
- Mesaj kopyalama (masaüstü hover + mobil long-press)
- Link önizleme kartları (Edge Function)

### Sunucu & Kanal Yönetimi
- Sunucu oluşturma ve davet kodu sistemi
- Sürükle-bırak kanal sıralama (@dnd-kit/sortable)
- Rol sistemi — hiyerarşi, izin yönetimi, rol renkleri
- Topluluk sunucusu — açıklama, kategori, Keşfet sayfasında listeleme
- Sunucu sırası cihazlar arası senkronizasyon (IndexedDB + Supabase `order_index`)

### Bot & Geliştirici Merkezi
- Bot oluşturma, yönetimi ve sunucuya ekleme
- Özel slash komutları (veritabanı tabanlı)
- 22+ komut değişkeni: `{user}`, `{serverName}`, `{joke}`, `{quote}`, `{trivia}`, `{8ball}` vb.
- Bot API token sistemi
- Bot Profil Modalı — sekmeli UI, sunucu sayısı, komut listesi

### Eklenti & Tema Marketi
- CSS/JS eklenti yükleme ve uygulama
- Eklenti puanlama ve yorum sistemi
- Kişisel eklenti yönetimi (düzenleme, silme)

### Profil & Kişiselleştirme
- Özel profil banner'ı (yükleme, kırpma)
- Avatar yükleme ve kırpma (AvatarCropModal)
- Cinsiyet ve doğum tarihi (gizlilik kontrollü)
- Spotify entegrasyonu — dinlenen şarkı profilde görünür
- Steam entegrasyonu — oyun durumu gösterimi
- Bağlı cihazlar paneli

### Güvenlik & Moderasyon
- **Aurora Guard** — IP ban, rate limit (6 istek/s), 30 dk otomatik soğutma, XSS sanitizasyonu
- MFA / TOTP iki faktörlü doğrulama
- Moderasyon rol hiyerarşisi: Deneme → Moderatör → Admin → Yetkili
- Manuel ve otomatik soğutma (cooldown) sistemi (AdvancedCooldownModal)
- 3 sütunlu moderasyon paneli — kullanıcı arama, ban, rol atama, aktif cooldown listesi
- reCAPTCHA koruması (kayıt + giriş formları)
- Kullanıcı IP takibi (`user_login_ips`)

### Sistem & Altyapı
- Çok dilli destek: Türkçe, İngilizce, Almanca, Japonca, Azerbaycanca
- Çevrimiçi/çevrimdışı/meşgul/gizli varlık durumu (Supabase Presence)
- Duyuru sistemi — rich text, resim, gerçek zamanlı yorumlar ve yanıtlar
- Sürüm notları ve changelog sistemi (`/changelog`)
- Tam SEO meta etiketleri (Open Graph, Twitter Card, canonical)

## Where Things Live

```
artifacts/aurorachat/
├── src/
│   ├── pages/              — Rota bazlı sayfa bileşenleri (Index, Settings, Moderation...)
│   ├── components/         — Yeniden kullanılabilir UI bileşenleri
│   │   └── ui/             — shadcn/ui bileşenleri (Button, Dialog, Input...)
│   ├── contexts/           — AuthContext, VoiceContext, ChatContext
│   ├── hooks/              — Custom hook'lar (useAuth, useVoice, useCooldown...)
│   ├── integrations/
│   │   └── supabase/       — Supabase istemcisi + üretilmiş tip tanımları
│   ├── lib/                — Yardımcı modüller (bildirim, spotify, steam, utils)
│   ├── i18n/               — Dil dosyaları: TR, EN, DE, JA, AZ
│   ├── data/               — Statik veri (changelogData.ts)
│   ├── types/              — Global TypeScript tip tanımları
│   └── utils/              — rateLimiter.ts, sanitize.ts
├── public/                 — Statik dosyalar (favicon, sw.js, APK)
├── tailwind.config.ts      — Aurora renk paleti ve tema ayarları
├── postcss.config.js       — Tailwind v3 PostCSS konfigürasyonu
└── index.html              — Uygulama giriş noktası (SEO meta, Google Fonts)
```

## Architecture Decisions

- **Supabase as primary backend** — Auth, realtime DB, storage ve edge functions Supabase üzerinden çalışır; Express API server yardımcı roldedir
- **Tailwind CSS v3 (PostCSS)** — `@tailwindcss/vite` kullanılmaz, PostCSS pipeline ile çalışır
- **React Router DOM v6** — Scaffold'daki wouter yerine react-router-dom kullanılır
- **LiveKit** — Sesli/görüntülü kanallar ve grup DM sesli aramalar için WebRTC
- **Aurora Guard** — Uygulama katmanında rate limiting + XSS koruması (6 req/s, 30 dk cooldown)

## User Preferences

### Arayüz Standartları (Her Zaman Uygulanmalı)

**Renk & Tema**
- Arka planlar için mutlaka CSS değişkeni kullan: `bg-background`, `bg-card`, `bg-sidebar`
- Vurgu renkleri: `text-primary` (turkuaz), `text-accent` (mor/`--aurora-purple`)
- Koyu temayı baz al — açık tema `.light` class ile override edilir
- Özel renkler için `tailwind.config.ts` içindeki Aurora paletini kullan (`aurora.glow`, `aurora.purple`, `aurora.green`, `status.online` vb.)

**Glassmorphism & Derinlik**
- Kart ve modal arka planları: `bg-card/60 backdrop-blur-xl border border-white/[0.08] shadow-lg`
- Hover efekti: `hover:bg-card/80 hover:border-white/[0.12] transition-all duration-300`
- Utility class olarak `glass` ve `glass-hover` mevcuttur — doğrudan kullan

**Animasyonlar**
- Sayfa geçişleri ve modal açılışları için Framer Motion kullan (`motion.div`, `AnimatePresence`)
- Hover için Tailwind transition kullan: `transition-all duration-200`
- Yükleme durumu için spinner: `border-2 border-primary border-t-transparent animate-spin rounded-full`

**Bileşenler**
- Tüm UI bileşenleri için önce `src/components/ui/` (shadcn/ui) içine bak
- Buton: `<Button variant="default|outline|ghost|destructive">`
- Modal/Diyalog: `<Dialog>` (Radix UI tabanlı)
- Scroll alanı: `<ScrollArea>` — native scrollbar yerine bunu kullan

### Yeni Sayfa Eklerken
1. `src/pages/YeniSayfa.tsx` dosyasını oluştur
2. `src/App.tsx` içindeki `<Routes>` bloğuna route ekle
3. `ProtectedRoute` veya `PublicRoute` wrapper'ı ile sar
4. Sayfa başına `<title>` ve meta tag'leri ekle (SEO)
5. Mobil görünümü test et

### Yeni Özellik / Modal Eklerken
1. Bileşeni `src/components/YeniBilesen.tsx` olarak ayrı dosyaya yaz
2. State'i mümkünse custom hook'a taşı: `src/hooks/useYeniOzellik.ts`
3. Supabase verisi gerekiyorsa TanStack Query `useQuery`/`useMutation` kullan
4. Gerçek zamanlı güncelleme gerekiyorsa Supabase Realtime channel ekle
5. Hata durumlarını her zaman `toast` (Sonner) ile bildir
6. Yeni SQL tablosu gerekiyorsa `supabase/migrations/` altına tarih önekli dosya oluştur ve RLS politikası ekle

## Gotchas

- **`@tailwindcss/vite` kullanma** — Tailwind v3 PostCSS tabanlıdır, `postcss.config.js` ile çalışır
- **Hardcode renk yazma** — `#5865F2` gibi değil, CSS değişkeni veya Tailwind class kullan
- **`any` TypeScript tipi kullanma** — `src/integrations/supabase/types.ts` üretilmiş tiplerini kullan
- **`useEffect + fetch` ile Supabase sorgusu** — TanStack Query kullan
- **`console.log` bırakma** — production'a taşımadan önce temizle
- **`server_bot_roles` tablosu** — `IF NOT EXISTS` ile oluşturulmalı (prod/dev farkı)
- **Changelog & Sürüm Notu Güvenliği** — Halka açık changelog içine SQL migration dosya adı, tablo adı, sütun adı, RLS politika detayı veya güvenlik açıklarını açıklayan teknik bilgi YAZMA. Yalnızca kullanıcıya yönelik özet yaz. Teknik ayrıntılar yalnızca bu `replit.md` ve commit geçmişinde tutulabilir.
- **Supabase Presence** — `onlineStatus` alanı kullanılır, `status` değil (profil durumuyla çakışır)
- **SQL migration'lar** — Supabase prod'a **manuel** uygulanır, otomatik migration yoktur
- **GroupDM presence** — `group-dm-presence-{groupId}` channel + 30 sn polling fallback
- **Race Condition** — Eş zamanlı işlemleri `useRef` guard ile önle (örn. `joiningRef`)
- **Do NOT run `pnpm dev` at workspace root** — artifacts need workflow-provided env vars (PORT, BASE_PATH)

## Mevcut Sürüm: v1.3.0

Detaylı değişiklik geçmişi için uygulama içi `/changelog` sayfasını ziyaret edin.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Supabase edge functions: `supabase/functions/` — spotify-token, verify-recaptcha, livekit-token, link-preview, delete-account, bot-api, send-push, steam-auth, toggle-premium-badge
