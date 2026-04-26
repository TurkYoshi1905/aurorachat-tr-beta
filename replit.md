# AuroraChat

A Discord-like real-time chat application built with React, Vite, TypeScript, and Supabase.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Routing**: React Router v6
- **State/Data fetching**: TanStack React Query
- **Backend**: Supabase (hosted) — handles auth, PostgreSQL database, realtime subscriptions, and file storage
- **i18n**: Custom translation system (Turkish default)

## Current Version

**v1.0.1** — 25 Nisan 2026: Rol üye yönetimi (arama + ekle/kaldır), mesaj gruplama, boşluklu @mention düzeltmesi, APK v1.0.1 GitHub bağlantısı.

**v1.0.0** — 🎉 ilk büyük sürüm: kayıtta cinsiyet/doğum tarihi dolduran kullanıcılar artık "Profilini Tamamla" modalı görmüyor:
- Sorun analizi: `Register.tsx` `auth.signUp` sonrası `profiles` üzerinde client-side `update` yapıyordu ama e-posta doğrulanmadığı için oturum yok → RLS update'i sessizce reddediyordu. Sonuç: `gender` ve `birth_date` profile hiç yazılmıyor → `ProfileCompletionModal` ilk girişte açılıyor.
- Düzeltme: `handle_new_user` SECURITY DEFINER tetikleyicisi `raw_user_meta_data->>'gender'` ve `raw_user_meta_data->>'birth_date'` alanlarını da okuyup oluşturma anında profile yazıyor (gender enum doğrulaması + güvenli `::date` parse'ı `EXCEPTION` bloğu içinde)
- Mevcut kullanıcılar için idempotent backfill: metadata'da değer olup profile'da NULL olan tüm satırlar otomatik dolduruldu
- Yeni SQL migration: `supabase/migrations/20260424010000_v100_handle_new_user_gender_birthdate.sql`

## Previous Version

**v0.9.10** — gizlilik kartlarındaki "Mevcut" değer düzeltmesi ve kayıt akışı için "E-posta Gönderildi" modalı:
- AuthContext profil sorgusuna `gender` ve `birth_date` eklendi; Settings > Gizlilik kartlarındaki "Mevcut" alanı artık doğru değeri gösteriyor (önceden hep "—" görünüyordu)
- Yeni `src/components/EmailSentModal.tsx`: animasyonlu hero başlık (Mail + CheckCircle2 rozet), gönderim adresi rozeti, 3 adımlı yönerge listesi, şifrelenmiş bağlantı + 24 saat geçerlilik etiketleri, sağlayıcıya özel (Gmail/Outlook/Yahoo/iCloud/Proton/Yandex) tek tık posta kutusu butonu, geri sayımlı tekrar gönderme bilgisi
- Register kayıt akışı `auth.signUp` başarısından sonra toast + redirect yerine bu modalı açar; "Giriş Sayfasına Git" butonuyla `/login`'e yönlendirir
- Yeni SQL migration: `supabase/migrations/20260424000000_v0910_profile_gender_birthdate_safety.sql` — `profiles.gender` ve `profiles.birth_date` kolonlarının varlığını garantileyen idempotent güvence + filtreleme için iki yardımcı index

## Previous Version

**v0.9.9** — gizlilik değişiklik modallarının yeniden tasarımı ve davet bağlantıları için karşılama kanalı:
- Yeni `src/components/ChangeGenderModal.tsx`: "Doğru Cinsiyetinizi Girin" başlıklı, hero header + 4 seçenek kartı (User/Users/User2/CircleHelp), haftalık limit rozeti ve hata uyarıları; `change_gender` RPC çağırır
- Yeni `src/components/ChangeBirthDateModal.tsx`: "Doğru Doğum Tarihinizi Girin" başlıklı, canlı yaş önizlemesi + 13–120 doğrulaması + haftalık limit rozeti; `change_birth_date` RPC çağırır
- Settings > Gizlilik kartları artık satır içi modal yerine bu özel modalları açar
- InviteDialog: "Karşılama Kanalı" seçici eklendi — sunucu sahibi davet ile gelenlerin hangi kanala düşeceğini seçer; mevcut davet için kayıtlı seçim otomatik yüklenir
- InvitePage: kabul/zaten üye yollarında `localStorage.aurorachat_nav_${user.id}` anahtarına `{serverId, channelId: landing}` yazarak Index'in kaldığı yerden başlatma mantığını yönlendirir
- Yeni SQL migration: `supabase/migrations/20260423010000_v099_invite_landing_channel.sql` — `server_invites.landing_channel_id uuid REFERENCES channels(id) ON DELETE SET NULL` + index

## Previous Version

**v0.9.8** — üye listesi sadeleştirme, sahip taç rozeti, sunucu emoji tepkileri, mobil indirme, gizlilik değişiklik limitleri ve raporlarda gerçek zamanlı düzeltme:
- MemberList: "Sen" etiketi ve sağdaki rol etiketleri (TESTER vb.) kaldırıldı; sahip için sadece avatar üzerinde taç ve sarı isim gösteriliyor — Discord benzeri sade görünüm
- UserProfileCard: sunucu sahibi profil kartında altın taç rozeti ve "Sahip" tooltip'i
- ChatArea: tepki seçicisi sunucu özel emojilerini (`:name:`) destekler — hem masaüstü popover hem mobil long-press için
- Settings > Uygulamayı İndir: APKPure üzerinden Android uygulama indirme bölümü eklendi
- Settings > Gizlilik: "Cinsiyetimi Değiştir" ve "Doğum Tarihimi Değiştir" butonları + ayrı modaller; haftada 2 değişiklik limiti hem istemci hem Supabase tarafında zorlanır, sayaç haftalık otomatik sıfırlanır
- Settings > Bildirilerim: rapor durumu (Beklemede → Reddedildi/Onaylandı) artık moderatör güncellediği anda gerçek zamanlı yenilenir; UPDATE eventi yanında ek refetch ile güvene alındı
- Yeni tablo: `profile_change_log` (RLS, sadece RPC yazabilir)
- Yeni RPC: `change_gender(p_value)`, `change_birth_date(p_value)` — server tarafında haftada 2 kez kontrol
- `message_reports` için REPLICA IDENTITY FULL ve realtime publication idempotent olarak yeniden onaylandı
- SQL migration: `supabase/migrations/20260423000000_v098_profile_changes_and_reports_realtime.sql`

## Previous Version

**v0.9.7** — yayın kalitesi, mobil kamera ve presence düzeltmeleri:
- Welcome/leave şablonlarında `{user}` artık `profiles.username` değerini öncelikli kullanır; görünen ad fallback olarak kalır
- Ses odası mobil ekran paylaşımı katılımcı listesi çakışmayacak grid düzenine alındı
- Kamera ilk açılışta ön kamera ile başlar; mobilde kamera butonu açıkken ön/arka kamera arasında döner
- Video ve ekran paylaşımı hedefi 1080p / 60 FPS ve 8 Mbps yayın ayarlarına yükseltildi
- Uzaktan telefon kontrolü modernize edildi; kamera aksiyonu telefonun kamerasıyla kanala katılım sayfasına yönlendirir
- `voice_channel_members` mikrofon, kamera ve ekran paylaşımı durumlarını realtime gösterecek şekilde genişletildi; kullanıcı ses kanalında değilken de kanaldaki üyeler Discord tarzı listelenir
- Kanallar `sort_order` sütununa uyumlu şekilde sıralanır, yoksa `position` fallback kullanılır
- Hotfix: Sunucu Ayarları > Kanallar bölümünde ses/metin kanalları kendi kategori grupları içinde doğru taşınır; `position` ve `sort_order` birlikte güncellenir. Ses katılımcı kayıtları `joined_at` heartbeat fallback ile güncellendiği için diğer hesaplarda görünme daha dayanıklıdır
- SQL migration: `supabase/migrations/20260420020000_v097_voice_quality_presence_sort_order.sql`

## Previous Version

**v0.9.4** — güvenlik, WebRTC ve UI düzeltmeleri:
- Mesaj sabitleme yetkisi: artık sadece sunucu sahibi veya `pin_messages` izinli roller sabitleyebilir (frontend + Supabase RLS)
- Kullanıcı adı benzersizliği: `profiles.username` UNIQUE kısıtlaması SQL migration ile güvence altına alındı
- Kullanıcı adı değiştirme modalı: mevcut şifre doğrulamalı, şık Dialog modali eklendi (Ayarlar)
- Emoji Ekle modalı: ServerSettings'de iki sütunlu profesyonel Dialog modali (önizleme + isim + sunucu seçimi)
- Sabitlenmiş mesajlar paneli: overflow-y-auto ile düzgün kaydırılabilir hale getirildi
- Ekran paylaşımı: loadedmetadata/playing eventleri ile yükleme durumu doğru temizleniyor; 12 saniyelik timeout sonrası hata mesajı gösteriliyor
- Sekme kapatılınca ses odasından düşme: beforeunload event listener eklendi
- SQL migration: `supabase/migrations/20260419010000_v095_security_pin_rls_username_unique.sql`

## Previous Version

**v0.9.3** — mobil ses, profil tamamlama ve kelime filtresi iyileştirmeleri:
- Mikrofon izin hataları gerçek LiveKit durumu ile eşleştirildi; izin reddedilince mikrofon açık görünmez
- Sağırlaştırma kapatıldığında mikrofon artık kendiliğinden açılmaz
- UserInfoPanel mikrofon/kulaklık ikonları bağlı ses odasının gerçek state'ini gösterir
- Ses odasına gelen ses seviyesi kontrolü ve mobil iki katılımcı grid iyileştirmesi eklendi
- Ekran paylaşımı track geç geldiğinde siyah alan yerine yeniden bağlanma/yükleniyor durumu gösterilir
- Profil tamamlama penceresi zorunlu hale getirildi; cinsiyet ve doğum tarihi kaydedilmeden kapatılamaz
- Sunucu kelime filtresine rol muafiyeti eklendi; kurucu/yönetici otomatik muaftır
- SQL migration: `supabase/migrations/20260419000000_v093_word_filter_exempt_roles.sql`
- Sürüm v0.9.3 ve ReleaseNotesModal güncellendi

## Previous Version

**v0.9.2** — hata düzeltmeleri, yeni özellikler ve DM iyileştirmeleri:
- Davet linki placeholder ve yardım metni doğru domain ile güncellendi (`aurorachat-beta-tr.netlify.app`)
- Moderasyon kullanıcı listesi tek sütuna getirildi — genişleme sırasında yanın boş kalma sorunu giderildi
- E-posta doğrulama linki PKCE akışını destekler; artık `EmailVerified` sayfasına doğru yönlendiriyor
- ServerInviteEmbed çevrimiçi sayısı artık veritabanı tabanlı sorgu ile hesaplanıyor — sunucu üyeleri için de düzgün çalışıyor
- DM listesinde okunmamış mesajlar için beyaz nokta göstergesi eklendi (localStorage tabanlı)
- Ayarlar > "Bildirilerim" sekmesi: gönderilen raporları ve durumlarını (beklemede/inceleniyor/çözüldü/reddedildi) gerçek zamanlı gösteriyor
- Sunucu Ayarları > Kanallar sekmesinde kanal ve kategori inline yeniden adlandırma desteği eklendi
- Sürüm v0.9.2 ve ReleaseNotesModal güncellendi

**v0.9.1** — mesaj gönderimi, global canlı durum ve hesap silme düzeltmeleri:
- Mesaj gönderim gecikmesi azaltıldı; sunucu ve DM mesajlarında istemci tarafından oluşturulan ID doğrudan veritabanına yazılıyor
- Canlı durum heartbeat yönetimi `AuthProvider` seviyesine taşındı; moderasyon ve ayarlar sayfalarında kullanıcı çevrimdışı görünmez
- Yeni kayıt olan kullanıcılar eski kullanıcılar için tasarlanan profil tamamlama penceresini tekrar görmez
- DM konuşması oluşturma sırasında kullanıcı UUID sıralaması garanti edildi; hesap silip yeniden kayıt sonrası DM gönderme akışı düzeltildi
- Hesap silme fonksiyonu `messages.user_id` ve `direct_messages.sender_id` üzerinden doğru anonimleştirme yapar
- Sunucu mesajları hesap silme sonrası korunur ve yazar "Deleted User (<id>)" olarak görünür
- SQL migration: `supabase/migrations/20260418110000_v091_account_delete_message_retention.sql`

**v0.9.0** — moderasyon kullanıcı merkezi, canlı durumlar ve hesap ban sistemi:
- Moderasyon kullanıcı aramasındaki `profiles.created_at` seçimi kaldırıldı; bu kolon olmadığı için oluşan Supabase 400 hatası giderildi
- Moderasyon > Kullanıcılar artık arama yapmadan A-Z kullanıcı listesi yükler
- Kullanıcılar/Adminler/Banlılar filtreleri eklendi; adminler ve kullanıcılar aynı ekranda yönetilebilir
- Kullanıcı durumları (`online`, `idle`, `dnd`, `offline`) Supabase Realtime ile panelde canlı görünür
- Kurucu, kullanıcı veya admin hesabını sebep yazarak banlayabilir ve banı kaldırabilir
- Banlanan kullanıcı açık oturumdaysa gerçek zamanlı çıkışa zorlanır; tekrar girişte "Hesabınız banlandı. Sebep: ..." mesajı gösterilir
- SQL migration: `supabase/migrations/20260417090000_v090_account_bans_moderation.sql`
- Hotfix: kullanıcı kartları iki kolonlu grid'de birbirini dikey olarak genişletmez; moderasyon canlı durumları artık `user_sessions.is_active + last_seen` ve `profiles.last_seen` üzerinden hesaplanır
- Hotfix SQL migration: `supabase/migrations/20260417100000_v090_moderation_presence_fix.sql`

**v0.8.9** — cinsiyet/doğum tarihi, karşılama sayfası, gizlilik iyileştirmeleri, moderasyon paneli redesign:
- Kayıt sihirbazına cinsiyet seçimi (Erkek/Kadın/Diğer/Belirtmek İstemiyorum) eklendi, Supabase `profiles` tablosuna kaydediliyor
- Kayıt sihirbazına kullanım koşulları adımı eklendi (metin okunmadan kabul edilemiyor)
- İlk kez giren kullanıcılar için animasyonlu landing page (`/welcome`) oluşturuldu
- Gizlilik Politikası güncellendi (tarih: 17 Nisan 2026, cinsiyet/doğum tarihi bölümleri eklendi)
- Ayarlar > Gizlilik'e "Cinsiyetinizi kimler görebilir?" ve "Doğum tarihinizi kimler görebilir?" ekli (Herkes/Arkadaşlar/Kimse)
- UserProfileCard'da cinsiyet ve doğum tarihi/yaş görünürlük ayarına göre gösteriliyor
- Şifre hataları artık şifre adımında gösteriliyor (e-posta adımında değil)
- Şifre güvenlik seviyesi göstergesi eklendi
- Moderasyon paneli yeniden tasarlandı: rapor türü filtresi, geliştirilmiş kart tasarımı, kullanıcı yönetim paneli, premium toggle (founder-only)
- SQL migration: `supabase/migrations/20260417000000_v089_gender_birthday_privacy.sql`

## Key Features

- Server/channel system (Discord-like)
- Direct messaging between users
- Real-time messaging via Supabase Realtime
- File/image attachments via Supabase Storage
- User authentication with MFA (TOTP) support
- Voice channels via LiveKit with full-screen meeting room UI (camera + screen share)
- **DM Voice Calling**: Supabase Realtime broadcast-based call signaling; incoming call modal (accept/reject); DM voice panel using shared VoiceMeetingRoom component; toggle panel while chatting
- Voice/text split view: chat panel alongside voice meeting room
- Browser push notifications for @mentions (Notification API + Service Worker at /sw.js)
- Real-time kick detection: kicked users are redirected instantly
- Audio settings persisted to profiles DB (audio_settings JSONB column)
- 6-language i18n system (TR, EN, AZ, RU, JA, DE)
- reCAPTCHA v2 on login/register
- User profiles, friend system, roles, bans
- Thread messages, message reactions, emoji picker, GIF picker
- Server categories, invites, audit logs, notifications
- Voice channel UI (VoicePanel)
- Admin premium badge toggle (Supabase Edge Function)
- **Blocking system**: Discord-style block confirmation modal (`BlockConfirmModal`); "Engellediğin bir kullanıcıya mesaj gönderemezsin" bar with inline unblock in `DMChatArea`; block/unblock from `UserProfileCard` profile popup
- **Role-based permissions**: `ServerSettings` now checks user's assigned roles & `getHighestPermissions()` — admins with `manage_channels`, `manage_roles`, `kick_members`, etc. can access those sections without being the owner; real-time role update subscription
- **Privacy settings**: `allow_dms` and `friend_request_setting` stored in Supabase profiles (migration `20260324000000_privacy_block_realtime.sql`)
- **Realtime reactions/poll votes**: `REPLICA IDENTITY FULL` on `message_reactions` ensures DELETE events carry full row data for instant sync across all users

## Environment Variables

Set these as Replit environment variables (already configured):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` — Supabase project ID

## Development

```bash
npm run dev       # Start dev server on port 5000
npm run build     # Production build
npm run preview   # Preview production build
```

## Supabase

The app uses a hosted Supabase project (`ktittqaubkaylprxnoya`). Database schema and migrations are in `supabase/migrations/`. Edge functions are in `supabase/functions/`.

## Notes

- The Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` env vars

## Pending Supabase Migration (v0.4.6)

The migration file `supabase/migrations/20260324000000_privacy_block_realtime.sql` must be applied to the Supabase project via the SQL editor. It:
1. Adds `allow_dms boolean DEFAULT true` and `friend_request_setting text DEFAULT 'everyone'` columns to `profiles`
2. Sets `REPLICA IDENTITY FULL` on `message_reactions` for proper realtime DELETE events
3. Adds RLS policy to prevent blocked users from sending DMs at the database level

The frontend code has fallbacks so it functions while the migration is pending.

## Pending Supabase Migration (v0.4.7)

Apply `supabase/migrations/20260328000000_push_subscriptions_and_kick_realtime.sql` via the Supabase SQL editor. It:
1. Creates `push_subscriptions` table for Web Push API subscription storage
2. Sets `REPLICA IDENTITY FULL` on `server_members` for proper real-time kick detection
3. Sets `REPLICA IDENTITY FULL` on `blocked_users` for real-time block sync

For Web Push notifications to work end-to-end, also set the `VITE_VAPID_PUBLIC_KEY` environment variable with your VAPID public key.

## v0.6.1 Sürüm Notları

- **Electron ESM düzeltme**: `electron/main.js` ESM formatına dönüştürüldü, `require()` → `import` ifadelerine çevrildi. `electron/package.json` `"type": "module"` yapıldı.
- **Nativefier yapılandırması**: `nativefier.json` oluşturuldu — `nodeIntegration: true`, `contextIsolation: false` ile modül çakışması giderildi.
- **Gradient animasyon**: `roleGradientShimmer` animasyonu soldan sağa (`0% → 200%`), varsayılan `paused`, hover'da `running`, hız `0.5s` (↑ daha hızlı).
- **Ban kontrolü**: `InvitePage` ve `ServerInviteEmbed` davet akışlarına `server_bans` DB sorgusu eklendi; yasaklı kullanıcı katılamaz.
- **Davet embed üye sayısı**: `fetch` fonksiyon ismi shadowing hatası düzeltildi; `select('*', head:true)` yerine tam satır sorgusu (`select('id')`) kullanıldı — "0 Üye" sorunu giderildi.
- **Gerçek zamanlı sunucu listesi**: Kullanıcı yeni sunucuya katıldığında `server_members INSERT` eventi yakalanıyor, sunucu listesi yenileniyor ve kullanıcı otomatik olarak o sunucunun ilk metin kanalına yönlendiriliyor.
- **DM mesaj scroll**: `handleNavigateToMessage` DM navigasyonuna `messageId` aktarımı eklendi; `DMChatArea` yeni `scrollToMessageId` propunu alıyor ve mesajı `scrollIntoView` ile vurgulayarak odaklıyor.

## Pending Supabase Migrations (v0.7.1 + v0.7.2)

Apply these two migrations in order via the Supabase SQL editor:

**1. `supabase/migrations/20260405000000_v071_leave_message_welcome_fix.sql`**
- Adds `leave_enabled`, `leave_message`, `leave_channel_id` columns to `servers`
- Creates `handle_welcome_message_v3()` with COALESCE+NULLIF fallback
- Creates `handle_leave_message()` trigger for member leave bot messages
- Creates `on_member_leave_message` trigger (BEFORE DELETE on server_members)

**2. `supabase/migrations/20260405100000_fix_block_rls_and_check_fn.sql`**
- Adds RLS SELECT policy so blocked users can detect they are blocked
- Creates `is_blocked_by(p_blocker_id UUID)` SECURITY DEFINER RPC function

**3. `supabase/migrations/20260406000000_v072_welcome_fix.sql`**
- Drops ALL old welcome trigger variants (on_member_joined_welcome, on_member_join_welcome, trg_welcome_message)
- Creates clean `handle_welcome_message_v4()` with is_bot=TRUE and NULL user_id
- Creates single canonical trigger `on_member_join_welcome`
- Fixes duplicate welcome message and {user} template not rendering

## Supabase GitHub Backup System

User has set up a Supabase database backup/restore system using GitHub Actions. Important details:

- Workflows configured in GitHub Actions:
  - `Supabase Otomatik Yedek` for automatic/manual database backups
  - `Supabase Yedekten Geri Yükle` for restoring a selected backup
- GitHub secret configured:
  - `SUPABASE_DB_PASSWORD` contains the Supabase database password; the password is stored as a GitHub secret and is not exposed in the project files
- Backup branch:
  - `database-backups` branch stores backup dumps
- Automatic backup schedule:
  - Runs every day at 06:00 Turkey time via GitHub Actions
  - Uses `pg_dump` to save database dumps to the `database-backups` branch
  - Keeps the latest 30 backups and deletes older ones
- Backup files are stored under `backups/` with names like:
  - `backup_2026-04-17_03-00-00_otomatik.dump`
  - `backup_2026-04-18_03-00-00_otomatik.dump`
- Manual backup:
  - GitHub → Repository → Actions → `Supabase Otomatik Yedek` → `Run workflow`
- Restore from GitHub Actions:
  - GitHub → Actions → `Supabase Yedekten Geri Yükle` → `Run workflow`
  - Set `backup_file` to the dump file name, for example `backup_2026-04-17_03-00-00_otomatik.dump`
  - Set `confirm` to `EVET` to start restore
- Restore from terminal:
  - Export password first: `export PGPASSWORD="<SUPABASE_DB_PASSWORD>"`
  - Run: `bash scripts/restore-from-github.sh`
  - Select a numbered backup and type `EVET` to restore
