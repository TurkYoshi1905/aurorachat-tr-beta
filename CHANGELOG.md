# AuroraChat Değişiklik Günlüğü

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
