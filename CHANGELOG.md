# AuroraChat Değişiklik Günlüğü

## [0.7.2] - 2026-04-05

### Düzeltmeler
- **Hoşgeldin Mesajı Çift Gönderim** — SQL trigger ve frontend kodu aynı anda mesaj gönderiyordu; frontend kodu kaldırıldı, artık yalnızca trigger gönderir.
- **Hoşgeldin {user} Şablonu** — Eski trigger adı çakışması (`on_member_joined_welcome` vs `on_member_join_welcome`) nedeniyle iki farklı trigger tetikleniyordu; yeni migration tüm eski varyantları silip tek temiz trigger (v4) kurar.
- **Gerçek Zamanlı Sunucu Ayarları Butonu** — Başka bir yetkili rol atandığında kanal listesindeki ⚙ butonu yenileme gerektirmeden anında görünüyor; `fetchPerms()` artık `server_member_roles` değişikliklerinde tetikleniyor.

---

## [0.7.1] - 2026-04-05

### Yeni Özellikler
- **Emoji GIF Desteği** — Sunucu ayarlarında emoji yüklerken GIF dosyaları artık animasyonunu koruyarak yükleniyor; canvas'a çizilmeden doğrudan upload ediliyor.
- **Çıkış Mesajı** — Sunucu Ayarları > Genel bölümüne "Çıkış Mesajı" alanı eklendi; üye ayrıldığında belirlenen kanala otomatik bot mesajı gönderiliyor (`{user}` şablonu desteklenir).
- **Üyeler Sayfası Yenilendi** — Sunucu sahibi Crown (taç) ikonu ve altın rengi ile vurgulandı; "Sahip" rozeti eklendi. Rol olmayan üyeler için "@everyone" gösteriliyor; 3'ten fazla rol "+N" ile özetleniyor.
- **Arka Plan Bildirimleri** — Tarayıcı arka planda olduğunda yeni DM ve etiket bildirimleri için yerel işletim sistemi (Windows/macOS) bildirimi gösteriliyor.

### Düzeltmeler
- **Engel Sistemi Arkadaşlık İsteği** — Hedef kullanıcı sizi engellediğinde artık arkadaşlık isteği butonu gizleniyor; çift taraflı blok kontrolü eklendi.
- **Rol Atanınca Kanal Listesi** — Rol atanınca kanallar gerçek zamanlı olarak güncelleniyor; `fetchServers()` çağrısı da tetikleniyor.
- **DM Embed Sunucu Katılım Listesi** — DM içindeki davet embed'inden sunucuya katılındığında sol kenar çubuğundaki sunucu listesi otomatik yenileniyor ve yeni sunucuya yönlendiriliyor.

### İyileştirmeler
- Hoş Geldin / Çıkış SQL Trigger yeniden yazıldı; COALESCE+NULLIF fallback ve EXCEPTION bloğu eklendi.
- Sunucu yokken DM ekranına otomatik yönlendirme eklendi.
- Sürüm numarası v0.7.1 olarak güncellendi.

---

## [0.7.0] - 2026-04-04

### Yeni Özellikler
- **Üye Listesi Mobil İkonu** — Mobil cihazdan bağlı üyeler artık Discord benzeri şekilde avatarın sağ altında yeşil telefon ikonu ile gösterilmektedir. "SEN" yanındaki ikon kaldırıldı.
- **DM Mobil Mesaj Alanı** — DM ekranındaki mesaj giriş alanı artık sunucu kanallarıyla aynı mobil tasarımı kullanıyor; `+` butonuna tıklayınca "Resim Ekle" ve "GIF Gönder" seçenekleri çıkıyor.
- **Foreground Service Simülasyonu** — Android Chrome'da ekran paylaşımı başlatıldığında, işletim sistemine kalıcı bildirim gönderilerek uygulamanın arka planda kapatılması engelleniyor. Paylaşım durduğunda bildirim otomatik kapanıyor.

### Düzeltmeler
- **Hoş Geldin Mesajı `{user}` Şablonu** — Gerçek zamanlı gelen bot mesajlarında (server owner kanalı izlediğinde) `{user}` artık doğru şekilde sanitize ediliyor. Trigger ile değiştirilemeyen şablonlar için frontend fallback da eklendi.

### İyileştirmeler
- Ekran paylaşımı başlarken `showForegroundNotification`, durduğunda `closeForegroundNotification` çağrılarak bildirim yaşam döngüsü yönetiliyor.
- Sürüm numarası v0.7.0 olarak güncellendi.

---

## [0.6.7] - 2026-04-02

### Yeni Özellikler
- **WakeLock API** — Ekran paylaşımı aktifken `navigator.wakeLock.request('screen')` ile Android'in uygulamayı askıya alması engellenir. Sayfa arka plandan döndüğünde kilit otomatik yeniden edinilir.
- **MediaSession API** — İşletim sistemi bildirim çubuğuna "Ekran Paylaşımı" metadata ve `stop` aksiyonu eklendi; kulaklık butonu veya bildirimden paylaşım durdurulabilir.
- **Android WebView Algılama** — `isAndroidWebView()` helper'ı ile Sketchware Pro gibi hibrit uygulamalar tespit edilerek özel hata mesajı ve constraint seti sunulur.
- **Otomatik Fallback Constraints** — `OverconstrainedError` veya `ConstraintNotSatisfiedError` durumunda sistem otomatik olarak `{ video: true, audio: false }` ile yeniden dener.

### İyileştirmeler
- **Gelişmiş hata sınıflandırması** — `NotAllowedError`, `NotFoundError`, `NotReadableError`, `SecurityError` için ayrı Türkçe açıklama mesajları.
- **track.onended otomasyonu** — Tarayıcı veya OS bildirimi üzerinden paylaşım durdurulduğunda `stopScreenShareCleanup()` çağrılır; UI otomatik sıfırlanır.
- **Mobil constraints optimize edildi** — Android/Chrome Mobile için `frameRate: { ideal: 15, max: 30 }`; masaüstü için 1920×1080@60fps ayarı korundu.
- Sürüm numarası v0.6.7 olarak güncellendi.

---

## [0.6.6] - 2026-04-02

### Yeni Özellikler
- **Bot Destekli Hoş Geldin Mesajı** — Hoş geldin mesajı artık "AuroraChat Bot" adına gönderilmektedir. `{user}` şablonu katılan üyenin kullanıcı adıyla değiştirilir ve mesaj bot hesabından sistem mesajı olarak iletilir. InvitePage üzerinden katılımlarda da aynı bot mesajı gönderilmektedir.
- **E-posta Doğrulama Sayfası (/verified)** — E-posta doğrulama işlemi başarılı olduğunda kullanıcı `/verified` sayfasına yönlendirilir. Bu sayfada "E-posta doğrulandı, bu sekmeyi kapatıp uygulamaya dönebilirsiniz" mesajı görüntülenir.
- **Şifre Sıfırlama Yönlendirmesi** — AuthCallback `type=recovery` veya `PASSWORD_RECOVERY` olayını algıladığında kullanıcıyı doğrudan ResetPassword sayfasına yönlendirir.
- **Mobil Ekran Paylaşımı (WebRTC)** — `getDisplayMedia` API'si mobil tarayıcılar (Chrome Android 12+) için optimize edildi. Mobil cihazlarda ekran paylaşımı başlatıldığında tarayıcıya uygun daha basit kısıtlamalar (constraints) kullanılmakta, hata mesajı daha açıklayıcı hale getirilmektedir.

### Düzeltmeler
- **Sunucu Ayarları Mobil Header** — Sunucu Ayarları sayfasının üst çubuğu artık `env(safe-area-inset-top)` ile mobil cihazların durum çubuğu (saat/pil) alanının altında doğru biçimde konumlandırılmaktadır.
- **InvitePage geliştirmeleri** — Giriş yapmamış kullanıcılar davet linkine tıkladığında artık sunucu adı, logo ve üye sayısı görüntülenmektedir. "Katıl" butonu yerine doğrudan Giriş Yap ve Hesap Oluştur butonları sunulmaktadır.

### İyileştirmeler
- Sürüm numarası v0.6.6 olarak güncellendi.

---

## [0.6.5] - 2026-04-01

### Düzeltmeler
- **Hesap silme CORS hatası giderildi** — `delete-account` Edge Function'a OPTIONS preflight desteği ve `Access-Control-Allow-Origin: *` başlığı eklendi.
- **Hesap silme mantığı geliştirildi** — Kullanıcıya ait sunucular silinir; kullanıcının mesajları ve profili "Deleted User (eski-id)" şeklinde anonimleştirilir, gerçek veriler korunmaz.
- **Üye listesindeki "as" metni kaldırıldı** — MemberList bileşeninde hatalı yerleştirilmiş metin temizlendi.
- **Tooltip `members.title` hatası giderildi** — Üye listesi simgesinin üzerindeki tooltip için tüm dil dosyalarına `members.title` anahtarı eklendi.

### Yeni Özellikler
- **Hoş Geldin Mesajı tetikleyicisi** — Yeni üye sunucuya katıldığında sunucu ayarlarında belirlenen kanala otomatik mesaj gönderen SQL Trigger eklendi.

### İyileştirmeler
- **Hakkında sayfası metni güncellendi** — "Discord benzeri..." ifadesi "Discord'dan esinlenerek geliştirilen gerçek zamanlı sohbet platformu." olarak güncellendi.
- Sürüm numarası v0.6.5 olarak güncellendi.

---

## [0.6.3] - 2026-03-31

### Düzeltmeler
- **Hazır şablon ile sunucu oluştururken iki adet "genel" kanalı oluşturulması sorunu giderildi** — Veritabanı tetikleyicisi zaten "genel" kanalını otomatik oluşturduğundan, şablon kanalları arasından bu kanal artık atlanmaktadır.
- **Eksik tooltip'ler eklendi** — Sohbet alanı başlık butonları (iğnelenmiş mesajlar, üyeler, arama, bildirimler) ve kanal listesi butonları (sunucudan ayrıl, davet oluştur, sunucu ayarları, kanal oluştur) artık fareyle üzerine gelindiğinde açıklayıcı tooltip göstermektedir.

### İyileştirmeler
- Kanal listesi ve sohbet alanı başlığındaki tüm eylem butonlarına `Tooltip` bileşeni entegre edildi.
- Şablon kanalları artık veritabanı tetikleyicisi ile tutarlı biçimde `position: 1+` değerleriyle oluşturulmaktadır.

---

## [0.6.2] - 2026-03-28

### Düzeltmeler
- MFA (iki adımlı doğrulama) girişi sırasında "2FA kontrolü" artık Supabase üzerinden gerçek zamanlı olarak kontrol edilmektedir.
- Hesabında MFA aktif olan kullanıcılar giriş yaptıklarında login sayfasında doğrulama kodu penceresi açılmaktadır.

---

## [0.6.1] - 2026-03-22

### Genel
- Çeşitli hata düzeltmeleri ve performans iyileştirmeleri.
