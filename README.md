<div align="center">

<img src="artifacts/aurorachat/public/favicon.ico" width="80" alt="AuroraChat Logo" />

# ✦ AuroraChat

**Türkiye'nin Modern İletişim Platformu**

Sunucular · Kanallar · Sesli & Görüntülü · Gerçek Zamanlı Mesajlaşma

<br/>

[![Version](https://img.shields.io/badge/sürüm-v1.2.6-6366f1?style=for-the-badge&logo=sparkles&logoColor=white)](https://github.com)
[![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Android%20%7C%20Windows-2dd4bf?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com)
[![Stack](https://img.shields.io/badge/stack-React%20%2B%20Supabase-f59e0b?style=for-the-badge&logo=react&logoColor=white)](https://github.com)
[![Language](https://img.shields.io/badge/dil-TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://github.com)
[![License](https://img.shields.io/badge/lisans-MIT-22c55e?style=for-the-badge)](https://github.com)

</div>

---

## 📖 İçindekiler

- [Uygulama Hakkında](#-uygulama-hakkında)
- [Özellikler](#-özellikler)
- [Ekran Görüntüleri](#-ekran-görüntüleri)
- [Teknoloji Stack'i](#-teknoloji-stacki)
- [Başlangıç](#-başlangıç)
- [Platform Desteği](#-platform-desteği)
- [Güvenlik](#-güvenlik)
- [Sürüm Geçmişi](#-sürüm-geçmişi)
- [Katkıda Bulunma](#-katkıda-bulunma)

---

## 🌌 Uygulama Hakkında

**AuroraChat**, Türkiye'ye özgü tasarlanmış, Discord benzeri tam özellikli bir topluluk ve iletişim platformudur. Gerçek zamanlı mesajlaşma, sesli/görüntülü görüşme, sunucu yönetimi, bot geliştirme merkezi ve gelişmiş moderasyon araçlarını tek çatı altında sunar.

> 💡 **Hedef:** Türkçe kullanıcılara yerel dil ve kültüre uygun, premium deneyimli, ücretsiz bir iletişim platformu sunmak.

```
🌐 Web Uygulaması   →  Tüm tarayıcılarda çalışır
📱 Android APK      →  Doğrudan yüklenebilir
🖥️ Masaüstü        →  Windows / Linux / macOS (Electron + Tauri)
```

---

## ✨ Özellikler

### 💬 İletişim

| Özellik | Açıklama |
|---|---|
| **Gerçek Zamanlı Mesajlaşma** | Supabase Realtime ile anlık mesaj, düzenleme ve silme |
| **Direkt Mesajlar (DM)** | Kişiden kişiye şifreli özel sohbet |
| **Grup DM** | Çok kişili grup sohbeti ve sesli arama |
| **Sesli & Görüntülü Kanallar** | LiveKit WebRTC altyapısıyla kristal netliğinde görüşme |
| **Ekran Paylaşımı** | Anlık ekran paylaşımı desteği |
| **Dosya Paylaşımı** | Resim, video ve dosya yükleme (Supabase Storage) |
| **GIF Picker** | Animasyonlu GIF arama ve gönderme |
| **Emoji & Mention** | Otomatik tamamlama, @kullanıcı ve #kanal mention |
| **Link Önizleme** | Gönderilen URL'ler için otomatik kart önizleme |
| **Mesaj Kopyalama** | Masaüstü hover + mobil uzun basma ile kopyalama |

---

### 🏠 Sunucu & Kanal Yönetimi

| Özellik | Açıklama |
|---|---|
| **Sunucu Oluşturma** | Sınırsız sunucu, özel ikon ve ayarlar |
| **Kanal Sistemi** | Metin, ses ve görüntü kanalları |
| **Sürükle-Bırak Sıralama** | @dnd-kit ile kanal sırası özelleştirme |
| **Rol Yönetimi** | Hiyerarşik rol sistemi, renk ve izin kontrolü |
| **Davet Sistemi** | Özel davet kodu ile üye daveti |
| **Topluluk Sunucusu** | Kategori, açıklama, Keşfet sayfasında listeleme |
| **Cihaz Senkronizasyonu** | Sunucu sırası IndexedDB + Supabase ile senkronize |

---

### 🤖 Bot & Geliştirici Merkezi

```
Bot Developer Center — Kendi botunu oluştur, yönet ve sunucuna ekle
```

- ✅ **Bot oluşturma ve yönetimi** — özel avatar, açıklama, komutlar
- ✅ **Slash komut sistemi** — veritabanı tabanlı özel `/komutlar`
- ✅ **22+ Komut Değişkeni:**

| Değişken | Açıklama |
|---|---|
| `{user}` | Komutu kullanan kullanıcı adı |
| `{serverName}` | Sunucu adı |
| `{memberCount}` | Sunucu üye sayısı |
| `{joke}` | Rastgele şaka |
| `{quote}` | Rastgele alıntı |
| `{trivia}` | Trivia sorusu |
| `{8ball}` | Sihirli 8 top yanıtı |
| `{lucky}` | Şans sayısı |
| `{dayOfWeek}` | Haftanın günü |
| `{greeting}` | Selamlama mesajı |

- ✅ **Bot API token sistemi** — harici entegrasyon için
- ✅ **Bot Profil Modalı** — sekmeli UI, istatistikler, sunucu listesi

---

### 🧩 Eklenti & Tema Marketi

```
Plugin Marketplace — CSS/JS eklentileri ile AuroraChat'i kişiselleştir
```

| Özellik | Açıklama |
|---|---|
| **Eklenti Yükleme** | CSS ve JS tabanlı özel eklentiler |
| **Puan & Yorum** | Eklentileri derecelendirme ve inceleme |
| **Kişisel Yönetim** | Kendi eklentilerini düzenle veya sil |
| **Admin Görünümü** | Tüm eklentileri moderasyon panelinden yönet |

---

### 👤 Profil & Kişiselleştirme

| Özellik | Açıklama |
|---|---|
| **Profil Fotoğrafı** | Yükleme + kırpma aracı (AvatarCropModal) |
| **Özel Banner** | Profil banner'ı yükleme ve kırpma |
| **Cinsiyet & Doğum Tarihi** | Gizlilik kontrollü profil bilgileri |
| **Spotify Entegrasyonu** | Dinlediğin şarkıyı profilde göster |
| **Steam Entegrasyonu** | Oynadığın oyunu profilde göster |
| **Bağlı Cihazlar** | Aktif oturumları görüntüle ve yönet |
| **Varlık Durumu** | 🟢 Çevrimiçi · 🟡 Boşta · 🔴 Rahatsız Etme · ⚫ Görünmez |

---

### 🛡️ Güvenlik & Moderasyon

<details>
<summary><strong>Aurora Guard Güvenlik Katmanı</strong> — tıkla ve gör</summary>

```
┌─────────────────────────────────────────┐
│           AURORA GUARD v1.1.5           │
├─────────────────────────────────────────┤
│  ✓ IP Ban                               │
│  ✓ Rate Limiting — 6 istek/saniye       │
│  ✓ Otomatik Soğutma — 30 dakika         │
│  ✓ XSS Sanitizasyonu                   │
│  ✓ reCAPTCHA Koruması                   │
│  ✓ Kullanıcı IP Takibi                  │
└─────────────────────────────────────────┘
```

</details>

| Özellik | Açıklama |
|---|---|
| **MFA / TOTP** | Google Authenticator uyumlu 2 faktörlü doğrulama |
| **Moderasyon Rolleri** | Deneme → Moderatör → Admin → Yetkili hiyerarşisi |
| **Cooldown Sistemi** | Manuel ve otomatik mesaj soğutma (AdvancedCooldownModal) |
| **Moderasyon Paneli** | 3 sütunlu admin dashboard; ban, rol atama, kullanıcı arama |
| **Row Level Security** | Supabase'de her tablo için ayrı RLS politikası |

---

### 📢 Duyuru Sistemi

```
Admin → Duyuru yaz (rich text + resim) → Gerçek zamanlı yayın
Kullanıcılar → Yorum yap, yanıtla, beğen
```

---

## 📸 Ekran Görüntüleri

> *Görüntüler yakında eklenecektir. Uygulamayı çalıştırarak önizleme yapabilirsiniz.*

```
┌──────────────────────────────────────────┐
│  🌌  AuroraChat — Ana Ekran              │
│                                          │
│  [Sunucu Listesi] [Kanallar] [Sohbet]    │
│                                          │
│  Koyu tema + Aurora turkuaz/mor gradyan  │
└──────────────────────────────────────────┘
```

---

## 🛠 Teknoloji Stack'i

### Frontend

| Paket | Sürüm | Kullanım |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5.9 | Tip güvenliği |
| Vite | 7 | Build aracı |
| Tailwind CSS | v3 | Stil sistemi |
| shadcn/ui + Radix UI | — | Bileşen kütüphanesi |
| Framer Motion | — | Animasyonlar |
| TanStack Query | v5 | Sunucu durum yönetimi |
| React Router | v6 | Sayfa yönlendirme |
| @dnd-kit | — | Sürükle-bırak |
| Lucide React | — | İkon seti |

### Backend & Altyapı

| Servis | Kullanım |
|---|---|
| Supabase PostgreSQL | Ana veritabanı |
| Supabase Auth | Kimlik doğrulama (E-posta, OAuth, TOTP) |
| Supabase Realtime | WebSocket — anlık mesaj & presence |
| Supabase Storage | Dosya, resim, banner depolama |
| Supabase Edge Functions | Spotify token, reCAPTCHA, link önizleme |
| LiveKit | Sesli/görüntülü WebRTC altyapısı |
| pg_cron | Zamanlanmış veritabanı görevleri |

### Masaüstü & Mobil

| Platform | Teknoloji |
|---|---|
| Windows / Linux / macOS | Electron + electron-builder |
| Native masaüstü | Tauri (Rust tabanlı) |
| Android | Doğrudan yüklenebilir APK |
| PWA | Service Worker ile çevrimdışı destek |

---

## 🚀 Başlangıç

### Gereksinimler

```bash
Node.js >= 18
pnpm >= 8
```

### Kurulum

```bash
# 1. Repoyu klonla
git clone https://github.com/aurorachat/aurorachat.git
cd aurorachat

# 2. Bağımlılıkları yükle
pnpm install

# 3. Ortam değişkenlerini ayarla
# Aşağıdaki değerleri Replit Secrets veya .env dosyasına ekle:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...

# 4. Frontend geliştirme sunucusunu başlat
pnpm --filter @workspace/aurorachat run dev

# 5. (Opsiyonel) API sunucusunu başlat
pnpm --filter @workspace/api-server run dev
```

### Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase proje URL'si |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon/public key |

> ⚠️ **Not:** Değişkenler ayarlanmazsa `src/integrations/supabase/client.ts` içindeki fallback değerler kullanılır.

---

## 📱 Platform Desteği

| Platform | Durum | İndirme |
|---|---|---|
| 🌐 **Web** (Chrome, Firefox, Safari, Edge) | ✅ Tam Destekli | — |
| 📱 **Android** | ✅ APK Mevcut | `public/AuroraChat_V1.0.5.apk` |
| 🖥️ **Windows** | ✅ Electron Build | GitHub Releases |
| 🐧 **Linux** | ✅ Electron Build | GitHub Releases |
| 🍎 **macOS** | ✅ Electron Build | GitHub Releases |
| 🔌 **PWA** | ✅ Yüklenebilir | Tarayıcıdan "Yükle" |

---

## 🌍 Dil Desteği

| Dil | Kod | Durum |
|---|---|---|
| 🇹🇷 Türkçe | `tr` | ✅ Tam |
| 🇬🇧 İngilizce | `en` | ✅ Tam |
| 🇩🇪 Almanca | `de` | ✅ Mevcut |
| 🇯🇵 Japonca | `ja` | ✅ Mevcut |
| 🇦🇿 Azerbaycanca | `az` | ✅ Mevcut |

---

## 🗂️ Proje Yapısı

```
aurorachat/
├── artifacts/
│   └── aurorachat/              # Ana frontend uygulaması
│       ├── src/
│       │   ├── pages/           # Sayfa bileşenleri
│       │   ├── components/      # UI bileşenleri
│       │   │   └── ui/          # shadcn/ui bileşenleri
│       │   ├── contexts/        # React Context (Auth, Voice, Chat)
│       │   ├── hooks/           # Custom hook'lar
│       │   ├── integrations/
│       │   │   └── supabase/    # Supabase istemcisi + tipler
│       │   ├── lib/             # Yardımcı modüller
│       │   ├── i18n/            # Dil dosyaları (TR/EN/DE/JA/AZ)
│       │   ├── data/            # Statik veri (changelog)
│       │   ├── types/           # TypeScript tip tanımları
│       │   └── utils/           # rateLimiter, sanitize
│       ├── public/              # Statik dosyalar (favicon, sw.js, APK)
│       ├── tailwind.config.ts   # Aurora renk teması
│       └── index.html           # Giriş noktası
├── artifacts/api-server/        # Express API sunucusu
├── supabase/
│   ├── migrations/              # Kronolojik SQL migration'lar
│   └── functions/               # Edge Functions
├── lib/
│   ├── db/                      # Drizzle ORM şema
│   └── api-spec/                # OpenAPI spec
└── replit.md                    # Geliştirici referans belgesi
```

---

## 📋 Sürüm Geçmişi

<details>
<summary><strong>v1.2.6</strong> — 27 Mayıs 2026 (Mevcut)</summary>

- 🐛 Çeşitli bug düzeltmeleri ve performans iyileştirmeleri
- 🔒 Güvenlik güncellemeleri

</details>

<details>
<summary><strong>v1.2.5</strong> — 26 Mayıs 2026</summary>

- ✨ Sürükle-bırak kanal sıralama (`@dnd-kit/sortable`)
- 🎨 Topluluklar sayfası yenileme (glassmorphism kartlar, 3 sütun grid)
- 🤖 6 yeni bot değişkeni: `{joke}` `{quote}` `{trivia}` `{wouldYouRather}` `{riddle}` `{compliment}`
- 🐛 Plugin yorumları FK hatası düzeltmesi

</details>

<details>
<summary><strong>v1.2.3</strong></summary>

- ⚔️ Rol hiyerarşisi ve dokunulmazlık kuralları
- 🛡️ AdvancedCooldownModal (9 süre seçeneği, sebep alanı)
- 📖 BotDocModal — 22 değişken, 4 kategori

</details>

<details>
<summary><strong>v1.2.1</strong></summary>

- 🧭 Communities/Keşfet sayfası
- 📋 Mesaj kopyalama (masaüstü + mobil)
- 📄 PDF veri dışa aktarma (Ayarlar > Gizlilik)

</details>

<details>
<summary><strong>v1.1.5</strong></summary>

- 🔒 Aurora Guard güvenlik katmanı (IP Ban, Rate Limit, XSS)
- 🤖 Bot Profil Modalı
- 📝 Komut değişken sistemi

</details>

<details>
<summary><strong>v1.1.3</strong></summary>

- 📢 Duyuru sistemi (admin yayını, rich text, yorumlar)
- 👥 Grup DM sesli arama sistemi
- ↔️ Yeniden boyutlandırılabilir ses odası

</details>

<details>
<summary><strong>v1.1.0</strong></summary>

- 🤖 Bot & Geliştirici sistemi
- 🧩 Plugin marketi
- 🖥️ Ekran paylaşımı

</details>

> Tüm değişiklikler için uygulama içi `/changelog` sayfasını ziyaret edin.

---

## 🤝 Katkıda Bulunma

```bash
# 1. Fork'la
# 2. Feature branch oluştur
git checkout -b feature/yeni-ozellik

# 3. Değişikliklerini commit'le
git commit -m "feat: yeni özellik eklendi"

# 4. Push'la
git push origin feature/yeni-ozellik

# 5. Pull Request aç
```

### Kod Standartları

- ✅ TypeScript strict mod — `any` kullanma
- ✅ Tailwind CSS değişkenleri — hardcode renk yazma
- ✅ TanStack Query — `useEffect + fetch` yerine
- ✅ shadcn/ui bileşenleri — sıfırdan yazma
- ✅ Her yeni Supabase tablosu için RLS politikası ekle
- ✅ Yeni modal → ayrı bileşen dosyası (`src/components/`)

---

## 📄 Lisans

```
MIT License — © 2026 AuroraChat
Tüm hakları saklıdır.
```

---

<div align="center">

**[🌐 Web Uygulaması](#)** · **[📱 Android İndir](#)** · **[🖥️ Masaüstü İndir](#)** · **[📖 Dokümantasyon](#)**

<br/>

<img src="https://img.shields.io/badge/Made%20with-❤️-ff6b6b?style=flat-square" alt="Made with love" />
<img src="https://img.shields.io/badge/Türkiye'de-üretildi-e30a17?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MCAzMCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjZTMwYTE3Ii8+PC9zdmc+" alt="Made in Turkey" />

<br/><br/>

*AuroraChat — Konuş, Bağlan, Topluluğunu Oluştur* ✦

</div>
