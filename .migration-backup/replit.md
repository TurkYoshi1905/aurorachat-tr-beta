# AuroraChat

Türkiye'nin modern iletişim platformu — sunucular, kanallar, sesli/görüntülü görüşme ve gerçek zamanlı mesajlaşmayı tek çatı altında buluşturan, Discord benzeri tam özellikli bir topluluk ve sohbet uygulaması.

---

## Uygulamanın Amacı

AuroraChat; kullanıcıların kendi sunucularını kurmasına, metin/ses/görüntü kanalları oluşturmasına, direkt mesaj ve grup DM ile iletişim kurmasına olanak tanır. Bot geliştirme merkezi, eklenti/tema marketi, duyuru sistemi ve gelişmiş moderasyon araçlarıyla yalnızca bir sohbet uygulaması değil; eksiksiz bir topluluk yönetim platformudur. Türkçe arayüz ve Türkiye lokalizasyonu ile yerel kullanıcılara birinci sınıf deneyim sunmayı hedefler.

**Admin hesabı:** `asfurkan140@gmail.com` — duyuru yayını ve moderasyon paneline bu hesapla erişilir.

---

## Kodlama Dili

- **TypeScript** (strict mod) — uçtan uca tip güvenliği
- **TSX** — React bileşen dosyaları
- **SQL** — Supabase migration dosyaları (`supabase/migrations/`)

---

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

---

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

---

## Mobil ve Masaüstü Uyumlu

- **Tam Responsive** — Tailwind breakpoint sistemi ile mobil/tablet/masaüstü desteği
- **Touch Optimizasyon** — `touch-action: manipulation`, uzun basma menüsü
- **Landscape Mod** — Alt navigasyon bar otomatik küçülür
- **PWA** — Service Worker ile çevrimdışı destek, hızlı yükleme
- **Viewport Fit** — `viewport-fit=cover` ile çentikli ekran uyumu
- **Electron** — Windows/Linux/macOS masaüstü uygulaması
- **Tauri** — Native masaüstü (Rust tabanlı, daha hafif)
- **Android APK** — Doğrudan yüklenebilir APK (`public/`)
- **Tauri Bildirimler** — Masaüstünde native bildirim, web'de `Notification API` fallback

---

## Yeni Sayfa veya Özellik Eklerken

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

**Tipografi & Boşluklar**
- Font: `Inter` (Google Fonts, `src/index.css` içinde import edilmiş)
- Başlıklar: `font-semibold` veya `font-bold` + uygun `text-foreground`
- İkincil metin: `text-muted-foreground`
- Boşluk: Tailwind spacing sistemi (`gap-`, `p-`, `m-`) — hardcode `px` değer kullanma

**Bileşenler**
- Tüm UI bileşenleri için önce `src/components/ui/` (shadcn/ui) içine bak
- Buton: `<Button variant="default|outline|ghost|destructive">`
- Modal/Diyalog: `<Dialog>` (Radix UI tabanlı) — `DialogContent`, `DialogHeader`, `DialogTitle` kullan
- Input: `<Input>`, `<Label>` shadcn bileşenlerini kullan
- Scroll alanı: `<ScrollArea>` — native scrollbar yerine bunu kullan
- Tooltip: `<Tooltip>` + `<TooltipProvider>` (zaten `App.tsx`'te sarılı)

### Yeni Sayfa Eklerken
1. `src/pages/YeniSayfa.tsx` dosyasını oluştur
2. `src/App.tsx` içindeki `<Routes>` bloğuna route ekle
3. `ProtectedRoute` veya `PublicRoute` wrapper'ı ile sar (auth durumuna göre)
4. Sayfa başına `<title>` ve meta tag'leri ekle (SEO)
5. Mobil görünümü test et — özellikle dar ekranda padding ve scroll kontrolü yap

### Yeni Özellik / Modal Eklerken
1. Bileşeni `src/components/YeniBilesen.tsx` olarak ayrı dosyaya yaz
2. State'i mümkünse custom hook'a taşı: `src/hooks/useYeniOzellik.ts`
3. Supabase verisi gerekiyorsa TanStack Query `useQuery`/`useMutation` kullan
4. Gerçek zamanlı güncelleme gerekiyorsa Supabase Realtime channel ekle
5. Hata durumlarını her zaman `toast` (Sonner) ile kullanıcıya bildir
6. Yeni SQL tablosu gerekiyorsa `supabase/migrations/` altına tarih önekli dosya oluştur ve RLS politikası ekle

### Kesinlikle Yapılmaması Gerekenler
- `@tailwindcss/vite` eklentisi kullanma — Tailwind v3 PostCSS tabanlıdır
- Hardcode renk değeri yazma (`#5865F2` gibi) — CSS değişkeni veya Tailwind class kullan
- `any` TypeScript tipi kullanma — doğru tip tanımla
- Supabase sorgusu için `useEffect + fetch` yazma — TanStack Query kullan
- `console.log` ile debug bırakma — production'a taşımadan önce temizle
- Yeni modal için yeni `useState` zinciri oluşturma — ilgili context veya hook'a ekle

---

## Hatasız Kodlama Standartları

### Mimari Kurallar
- **Tip Güvenliği** — `src/integrations/supabase/types.ts` üretilmiş tiplerini kullan, manual tip yazma
- **Row Level Security** — Her yeni Supabase tablosu için RLS politikası zorunludur
- **Realtime Sırası** — Broadcast öncesi her zaman `channel.subscribe()` bekle, sonra `channel.send()` çağır
- **N+1 Sorgu Önleme** — İç içe sorgular yerine Supabase RPC (stored procedure) kullan
- **Statement Timeout** — Uzun sorgularda timeout guard ekle (bkz. `get_server_members_full`)
- **Race Condition** — Eş zamanlı işlemleri `useRef` guard ile önle (örn. `joiningRef`)

### Güvenlik
- Kullanıcı girdisi her zaman sanitize edilmeli (`src/utils/sanitize.ts`)
- Rate limiting: `src/utils/rateLimiter.ts` — 6 istek/saniye, 30 dk soğutma
- ReCAPTCHA: kayıt ve giriş formlarında Edge Function üzerinden doğrulama

### Bilinen Gotcha'lar
- `server_bot_roles` tablosu `IF NOT EXISTS` ile oluşturulmalı (prod/dev farkı)
- Supabase Presence'ta `onlineStatus` alanı kullanılır, `status` değil (profil durumuyla çakışır)
- SQL migration'lar Supabase prod'a **manuel** uygulanır — otomatik migration yoktur
- GroupDM presence: `group-dm-presence-{groupId}` channel + 30 sn polling fallback
- `@tailwindcss/vite` yok — Tailwind PostCSS ile çalışır (`postcss.config.js`)

---

## Çalıştırma & Geliştirme

```bash
# Frontend geliştirme sunucusu (port otomatik atanır)
pnpm --filter @workspace/aurorachat run dev

# API sunucusu
pnpm --filter @workspace/api-server run dev

# Tüm paketleri derle
pnpm run build

# Tip kontrolü
pnpm run typecheck
```

### Gerekli Ortam Değişkenleri
| Değişken | Açıklama |
|---|---|
| `VITE_SUPABASE_URL` | Supabase proje URL'si |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |

> Şu an `src/integrations/supabase/client.ts` içinde fallback değerler hardcode'dur. Replit Secrets'a yukarıdaki değişkenleri ekleyerek override edilebilir.

---

## Dosya Haritası

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

supabase/
├── migrations/             — Kronolojik SQL migration dosyaları
└── functions/              — Edge Functions (spotify-token, verify-recaptcha...)
```

---

## Mevcut Sürüm: v1.2.6 (27 Mayıs 2026)

Detaylı değişiklik geçmişi için uygulama içi `/changelog` sayfasını ziyaret edin.
