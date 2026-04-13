import { Sparkles, Bug, Wrench } from 'lucide-react';

export interface ChangelogSection {
  title: string;
  icon: typeof Sparkles;
  color: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  summary: string;
  sections: ChangelogSection[];
}

export const changelogData: ChangelogRelease[] = [
  {
    version: '0.8.5',
    date: '12 Nisan 2026',
    summary: 'Discord tarzı DM split-pane düzeni (masaüstü), mobil mesaj işlemleri dokunmatik geliştirmesi, arkadaşlar listesi alfabetik sıralama, mobil arama ekranı güvenli alan düzeltmesi ve paralel sunucu yükleme optimizasyonu.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Discord Tarzı DM Düzeni — Masaüstünde DM geçmişinden birine tıklayınca artık sol tarafta DM listesi, sağ tarafta sohbet arayüzü yan yana gösteriliyor. Tam Discord deneyimi.',
          'DM Mesaj İşlemleri (Mobil Dokunmatik) — Mobilde kendi mesajınıza dokunarak düzenleme ve silme butonlarını görüntüleyebilirsiniz; tekrar dokunarak kapatabilirsiniz. Masaüstünde üzerine gelince görünür.',
          'Arkadaşlar Alfabetik Sıralama — Arkadaşlar listesi artık A\'dan Z\'ye isime göre otomatik sıralanıyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Mobil Arama Ekranı Güvenli Alan — Android\'de mesaj arama açılırken durum çubuğunun altına kayıyordu; env(safe-area-inset-top) desteğiyle düzeltildi.',
          'DM Mesaj Butonları — Mobilde kendi mesajlarının yanında sürekli görünen kalem/çöp kutusu ikonları kaldırıldı; yerine dokunmatik seçim sistemi getirildi.',
          'Üretim Ortamı Çöküşü — useServerOnlineBroadcast hook\'u servers ve myStatus değişkenlerinden önce çağrılıyordu; JavaScript TDZ (Temporal Dead Zone) hatası giderildi.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Sunucu/Kanal Yükleme Hızı — Sunucu, kanal ve kategori veritabanı sorguları artık Promise.all ile paralel çalışıyor; başlangıç yükleme süresi belirgin şekilde azaldı.',
          'Sürüm numarası v0.8.5 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.8.4',
    date: '11 Nisan 2026',
    summary: 'Sunucu davet embed\'inde WebSocket Presence ile anlık çevrimiçi sayacı eklendi, stale online sorunu çözüldü, Spotify 403 hatası düzeltildi, ses kanalı mikrofon hata yönetimi iyileştirildi ve kanal geçiş gecikmesi giderildi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Anlık Çevrimiçi Sayacı (Sunucu Daveti) — Davet linkleri artık Discord gibi WebSocket Presence üzerinden anlık çevrimiçi sayısı gösteriyor. Birisi uygulamayı açınca sayı anında artar, kapatınca anında düşer; veritabanına hiç sorgu atmaz.',
          'Boşta ve Rahatsız Etme Durumu Çevrimiçi Sayılıyor — "Boşta" (idle) ve "Rahatsız Etmeyin" (dnd) durumundaki kullanıcılar da çevrimiçi sayısına dahil ediliyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Stale Çevrimiçi Durumu — Uygulama kapandığında kullanıcının durumu artık anında offline\'a düşüyor. Eski oturumlardan kalan hayalet "online" kayıtları yanlış sayıya yol açan sorun giderildi.',
          'Spotify 403 Hatası — Spotify geliştirici modu kısıtlaması nedeniyle /v1/me 403 döndürdüğünde token\'lar artık yine de kaydediliyor; Spotify bağlantısı artık başarısız olmuyor.',
          'Sunucu Daveti Çevrimiçi Sayısı Sıfır Gösteriyordu — RLS politikaları nedeniyle çevrimiçi sayısı her zaman 0 çıkıyordu; SECURITY DEFINER ile yeni bir RPC fonksiyonu oluşturularak sorun çözüldü.',
          'Ses Kanalı Mikrofon Hatası — NotReadableError ve AudioContext hataları artık uygulamayı çökertmiyor; mikrofon kullanılamadığında kullanıcı sessiz olarak ses kanalına bağlanıyor ve bilgilendirici bir uyarı gösteriliyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'last_seen Heartbeat Sistemi — Kullanıcı aktifken her 30 saniyede bir last_seen güncelleniyor; bu sayede gerçek zamanlı olmayan bağlamlarda da doğru çevrimiçi tespiti yapılabiliyor.',
          'Kanal Geçiş Hızı — Kanallar arasında geçişte mesajlar ve reaksiyonlar artık aynı anda (paralel) yükleniyor; sıralı bekleme süresi ortadan kalktı.',
          'Anlık Kanal Temizleme — Kanal değiştirildiğinde eski mesajlar ve reaksiyonlar anında temizleniyor; yeni kanal yüklenene kadar eski içerik görünmüyor.',
          'Sürüm numarası v0.8.4 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.8.3',
    date: '10 Nisan 2026',
    summary: 'Spotify token yönetimi Supabase Edge Function\'a taşındı, telefonla ses kontrolü (QR kod + Realtime broadcast) eklendi ve Spotify "şu an çalıyor" profil kartı düzeltildi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Spotify Sunucu Taraflı Token Yönetimi — Spotify token değişimi ve yenileme artık Supabase Edge Function (spotify-token) üzerinden güvenli sunucu ortamında çalışıyor. Token\'lar istemciye açık kalmaz; CORS ve yetkilendirme hataları ortadan kalktı.',
          'Telefonla Ses Kontrolü (QR Kod) — Ses toplantısındayken "Telefonla Kontrol" butonuna basarak QR kodu göster. Telefonunla okutunca mikrofon (sessiz/açık) ve hoparlör (sağır/açık) kontrolü anlık olarak yapılabiliyor. Supabase Realtime Broadcast üzerinden sıfır gecikmeli iki yönlü iletişim.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Spotify Token Hatası — Token yenileme ve değişim işlemleri artık edge function üzerinden gerçekleştirildiğinden istemci taraflı CORS ve yetkilendirme hataları ortadan kalktı.',
          'Spotify "Şu An Çalıyor" Görünmüyor — Polling ve profil kartı veri akışı yeniden düzenlendi; edge function DB\'yi güncellediğinde Realtime abone olan profil kartları anlık güncelleniyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Ses toplantısı QR modal\'ı "Telefonla Ses Kontrolü" açıklaması ve bağlı telefon göstergesiyle güncellendi.',
          'Telefon bağlandığında masaüstü arayüzündeki "Telefonla Kontrol" butonu yeşile dönerek "Telefon Bağlı" yazısı gösteriyor.',
          'Sürüm numarası v0.8.3 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.8.2',
    date: '9 Nisan 2026',
    summary: 'Spotify entegrasyonu: Şu an çalınan şarkı profil kartında gösteriliyor, DM geçmişi sıralama düzeltmesi ve gerçek zamanlı durum güncellemesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Spotify Entegrasyonu — Ayarlar > Bağlantılar sayfasından Spotify hesabını bağlayabilirsin. Hesabı bağlayınca şu an çaldığın şarkı profil kartında Discord tarzı embed olarak görünür.',
          'Spotify Şarkı Embed — Profil kartında albüm kapağı, şarkı adı, sanatçı, ilerleme çubuğu ve "Spotify\'da Aç" butonu gerçek zamanlı olarak görünür.',
          'Bağlantılar Sayfası — Ayarlar\'a yeni "Bağlantılar" sekmesi eklendi. Spotify hesabını buradan ekleyip kaldırabilirsin.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'DM Geçmişi Sıralama — DM listesi artık en son mesaja göre sıralanıyor (en yeni üstte). Önceden konuşma oluşturulma tarihine göre sıralanıyordu.',
          'Kullanıcı Zıplama Sorunu — Yeni mesaj geldiğinde tüm DM listesi yeniden yüklenmiyor; sadece ilgili kullanıcı güncellenerek liste yerinde sıralanıyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Gerçek Zamanlı Durum — DM sayfasında kullanıcı durumları artık veritabanından anlık olarak güncelleniyor (profiller tablosu aboneliği).',
          'Sürüm numarası v0.8.2 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.8.1',
    date: '9 Nisan 2026',
    summary: 'Telefon ile ses kanalına QR kod ile katılım, platform tespiti (Mobil/Tablet ikonu), üye listesi mevcut kullanıcı görünürlük düzeltmesi ve gerçek zamanlı SQL iyileştirmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'QR Kod ile Sesli Kanala Katılım — Masaüstü uygulamasında ses kanalındayken "Telefon ile Katıl" butonuna tıklayarak QR kod oluşturabilirsin. Telefonundan QR kodu okutunca /voice-join sayfasına yönlendirilirsin.',
          '/voice-join Sayfası — Telefon tarayıcısı üzerinden ses kanalına katılmak için özel sayfa. Kamera (ön/arka geçiş), mikrofon açma/kapama ve sesli kanaldan ayrılma kontrollerini içeriyor.',
          'QR Kod Tarayıcı (Ayarlar) — Mobil cihazlarda Ayarlar > QR Kod Okut sekmesinde canlı kamera tarayıcısı. Ön/arka kamera geçişi destekleniyor; ses kanalı QR kodunu okutunca otomatik yönlendirme yapıyor.',
          'Platform Tespiti — Kullanıcı profillerine platform bilgisi eklendi. Mobil ve tablet cihazlardan bağlanan kullanıcılar üye listesinde ve profil kartında Smartphone/Tablet ikonu ile "Mobil İstemci" etiketi ile gösteriliyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Üye Listesi Mevcut Kullanıcı Görünürlüğü — Kendi kullanıcın üye listesinde her zaman "çevrimiçi" görünüyor; önceden bileşen yeniden render edilince kaybolabiliyordu.',
          'send-push Edge Fonksiyon VAPID Hatası — VAPID JWT artık JWK import (x/y koordinatları ile) kullanıyor; önceki hatalı manuel PKCS8 yapısı düzeltildi.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Gerçek Zamanlı SQL İyileştirmeleri — friends, channels, server_members, servers, profiles tabloları için REPLICA IDENTITY FULL ayarlandı; 15 tablo supabase_realtime yayınına eklendi.',
          'friends tablosu için RLS (Row Level Security) politikaları eklendi.',
          'Sürüm numarası v0.8.1 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    date: '8 Nisan 2026',
    summary: 'RGB Premium animasyonu, avatar tıklanabilirlik, Basic/Premium çakışma düzeltmesi ve gerçek zamanlı ses kanalı katılımcıları.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'RGB Premium Animasyonu — Premium üyelik kartı (Ayarlar) ve UserProfileCard\'daki Premium rozeti + Gem ikonu artık döngüsel RGB renk animasyonu ile parlıyor.',
          'Avatar Tıklanabilirlik (ChatArea) — Sunucu sohbetinde mesaj avatarına tıklayınca profil kartı açılıyor; daha önce yalnızca kullanıcı adı tıklanabilirdi.',
          'Avatar Tıklanabilirlik (DM) — DM ekranında da mesaj avatarına tıklayınca profil kartı açılıyor.',
          'Gerçek Zamanlı Ses Kanalı Katılımcıları — Ses kanalına katılmadan da diğer kanallarda kimlerin olduğunu görebilirsin; voice_channel_members tablosu Supabase Realtime ile anlık güncelleniyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Premium Aktifken Basic Alınabiliyordu — Premium aboneliği aktifken Basic butonu artık devre dışı; düğme "Premium\'a Dahil" olarak gösteriliyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Sürüm numarası v0.8.0 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.9',
    date: '8 Nisan 2026',
    summary: 'Çift giriş mesajı düzeltildi, bot mesajları okunmamış sayılıyor, Premium/Basic iptal desteği, profiles realtime user_status ve son gezilen konuma dönüş eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Son Konum Hafıza — Siteden çıkıp geri girildiğinde en son açık olan sunucu ve kanal otomatik olarak yükleniyor; DM sayfasındayken de DM görünümü korunuyor (localStorage).',
          'Premium/Basic İptal — Kullanıcı Ayarları > AuroraChat Premium sayfasında aktif üyelik "İptal Et" butonu ile iptal edilebiliyor.',
          'Premium Kilidi — Basic aktifken Premium butonu devre dışı; önce Basic iptal edilmesi gerekiyor.',
          'user_status Gerçek Zamanlı — Kullanıcı durumu değiştiğinde profiles tablosundaki status alanı da anında güncelleniyor; diğer kullanıcılar için realtime durum desteği tamamlandı.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Çift Giriş Mesajı — Sunucuya katılınca hem SQL trigger hem frontend aynı anda mesaj gönderiyordu; frontend kodu kaldırıldı, artık yalnızca trigger gönderir. Özel mesaj yoksa varsayılan mesaj trigger tarafından gönderilir.',
          'Bot Mesajları Okunmamış Sayılmıyor — Bot mesajları diğer kanallarda okunmamış (beyaz nokta) olarak işaretlenmiyordu; düzeltildi.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Sürüm numarası v0.7.9 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.8',
    date: '7 Nisan 2026',
    summary: 'Premium & Basic üyelik sistemi, dinamik dosya limitleri, Basic rozeti ve profiles realtime desteği eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'AuroraChat Basic — 1 aylık ücretsiz deneme, profil rozeti, 20 MB dosya yükleme limiti.',
          'AuroraChat Premium — 1 aylık ücretsiz deneme, profil rozeti, animasyonlu avatar, banner, 50 MB dosya limiti, öncelikli destek.',
          'Premium sayfası yeniden tasarlandı: özellik karşılaştırma tablosu, aktif plan göstergesi ve "Al" butonlarına işlev eklendi.',
          'UserProfileCard\'a Basic rozeti (yıldız ikonu + "Basic" etiketi) eklendi.',
          'Dosya yükleme limiti artık plana göre dinamik: Ücretsiz 10 MB / Basic 20 MB / Premium 50 MB.',
          'profiles tablosu Supabase Realtime\'a eklendi; status değişiklikleri artık veritabanında gerçek zamanlı görünüyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Kullanıcı Ayarları "Hesap" sekmesinde aktif plan (Basic/Premium) bitiş tarihi ile gösteriliyor.',
          'Sürüm numarası v0.7.8 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.7',
    date: '7 Nisan 2026',
    summary: 'Giriş ve çıkış mesajları artık veritabanında düzgün ekleniyor ve diğer kullanıcılara gerçek zamanlı gösteriliyor.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Giriş/Çıkış Mesajları Çalışmıyor — messages.user_id sütunundaki NOT NULL kısıtlaması ve eksik is_bot sütunu nedeniyle trigger INSERT\'leri sessizce başarısız oluyordu. Kısıtlama kaldırıldı, is_bot eklendi, RLS politikaları bot mesajlarına izin verecek şekilde güncellendi.',
          'Gerçek Zamanlı Görünmüyor — messages tablosu supabase_realtime yayınına eklendi ve REPLICA IDENTITY FULL ayarlandı; artık bot mesajları kanaldaki tüm kullanıcılara anında görünüyor.',
          'Trigger Çakışması — Tüm eski welcome/leave trigger varyantları (v3–v7) temizlendi; v8/v5 adında tek ve temiz trigger seti yeniden oluşturuldu.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Sürüm numarası v0.7.7 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.6',
    date: '7 Nisan 2026',
    summary: 'Durum "Boşta" kalma hatası düzeltildi, DM sayfasında uygulama içi bildirim sorunu giderildi, 2FA\'ya 1 aylık cihaz güven özelliği eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          '2FA Cihaza Güven — Giriş yaparken MFA kodu girerken "1 aylığına bu cihaza güven" seçeneği eklendi. İşaretlenirse o cihazda 30 gün boyunca tekrar kod sorulmaz; güven süresi dolduğunda otomatik olarak geçersiz olur.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Durum Boşta Kalıyor — Uygulamadan çıkıp tekrar girildiğinde durum "Boşta" olarak kalmaya devam ediyordu. Artık sekme yeniden açıldığında "Boşta" localStorage\'dan yüklenirse otomatik olarak "Çevrimiçi"ye sıfırlanıyor.',
          'DM Sayfasında Bildirim Gelmiyor — DM sayfasındayken başka birinden mesaj geldiğinde uygulama içi bildirim toast\'ı görünmüyordu; eksik InAppNotificationToast bileşeni masaüstü ve mobil DM görünümlerine eklendi.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Sürüm numarası v0.7.6 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.5',
    date: '6 Nisan 2026',
    summary: 'DM çift bildirim sorunu giderildi, hesap değiştirildiğinde DM geçmişi karışması düzeltildi, DM silinip tekrar yazılınca konuşma otomatik geri geliyor, DM sayfasına gerçek zamanlı bildirim eklendi, Windows/macOS bildirimi düzeltildi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Çift DM Bildirimi — Aynı mesaj için iki ayrı bildirim gelme sorunu giderildi; artık yalnızca broadcast kanalı üzerinden tek bildirim gösteriliyor.',
          'DM Geçmişi Hesap Karışması — Farklı hesapla girildiğinde önceki hesabın gizlenmiş konuşmaları artık görünmüyor; IndexedDB kullanıcı kimliğine göre izole edildi.',
          'Silinen Konuşma Geri Gelmiyor — Sohbet silinip aynı kişiyle tekrar konuşulduğunda mesajlar artık otomatik olarak DM listesinde geri geliyor.',
          'DM Sayfasına Bildirim Gelmiyor — DM sayfasındayken başka bir kişiden mesaj geldiğinde artık uygulama içi ve masaüstü bildirimi tetikleniyor.',
          'Windows/macOS Bildirimi — Masaüstü bildirimleri ServiceWorker showNotification() üzerinden güvenilir şekilde çalışıyor; açık konuşmadayken gereksiz bildirim gösterilmiyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'DM Supabase Realtime — DMDashboard\'a direct_messages tablosu için gerçek zamanlı abonelik eklendi; yeni mesaj geldiğinde liste otomatik güncelleniyor.',
          'Sürüm numarası v0.7.5 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.4',
    date: '6 Nisan 2026',
    summary: 'Kanal okunmamış beyaz nokta sistemi, DM sayfasında sunucu etiket bildirimi, Android push bildirim iyileştirmesi, hoşgeldin mesajı trigger düzeltmesi, resim görüntüleyici buton sorunu ve sunucuya katıl üye/kanal sayısı düzeltmesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Kanal Okunmamış Noktası — Okunmamış mesaj bulunan metin kanallarında Discord tarzı beyaz nokta gösterilir; kanala girilince nokta otomatik kaybolur. Okunmamış kanallar metni kalın ve beyaz görünür.',
          'DM Sayfasında Etiket Bildirimi — DM ekranındayken bir sunucu kanalında biri sizi @etiketlediğinde artık bildirim/in-app toast tetikleniyor. Mention kontrolü artık yalnızca aktif kanala değil tüm kanallara uygulanıyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Hoşgeldin Mesajı — Üye sunucuya katılınca çıkış mesajı gönderilmesi sorunu düzeltildi; yeni migration tüm trigger çakışmalarını temizler ve welcome/leave triggerlarını ayrı ayrı yeniden kurar.',
          'Resim Görüntüleyici Butonlar — Resme tıklayınca "Orijinali Aç" ve "İndir" butonlarının arkada/görünmez kalması düzeltildi; butonlar artık z-index[9999] ile her zaman üstte görünür.',
          'Sunucuya Katıl Sayı — Davet önizlemesinde üye ve kanal sayısı 0 gözükmesi düzeltildi; RLS engelini aşmak için SECURITY DEFINER RPC fonksiyonu kullanılıyor.',
          '{user} Şablonu Güvenliği — Hoşgeldin mesajında {user} placeholder\'ının değiştirilmemesi durumunda istemci tarafı fallback güçlendirildi.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Android Push Bildirimi — Service Worker tabanlı push bildirim Android için iyileştirildi; actions (eylem butonları), requireInteraction ve vibrate desteği eklendi.',
          'Sürüm numarası v0.7.4 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.3',
    date: '6 Nisan 2026',
    summary: 'Masaüstü bildirimleri ServiceWorker üzerinden çalışıyor, DM gerçek zamanlı bildirim sistemi broadcast ile güçlendirildi, üye at/yasakla işlemleri için onay modalı eklendi, mobil profil kartı düzeltildi ve hoşgeldin mesajı trigger garanti altına alındı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Üye At / Yasakla Onay Modalı — Sunucu Ayarları > Üyeler bölümünde at veya yasakla butonuna tıklandığında artık gelişmiş bir uyarı modalı çıkıyor. Üye adı, işlem türü ve isteğe bağlı sebep alanı içeriyor.',
          'DM Bildirim Broadcast Sistemi — Direkt mesajlarda RLS engelini aşmak için Supabase Broadcast kanalı eklendi. Alıcı çevrimiçi olduğunda uygulama içi bildirim anında tetikleniyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Masaüstü Bildirimleri — Windows ve macOS\'ta tarayıcı bildirimleri artık ServiceWorker üzerinden `showNotification()` ile gönderiliyor; doğrudan `new Notification()` çağrısının çalışmadığı ortamlarda da güvenilir şekilde çalışıyor.',
          'DM Sayfa Bildirimi — DM sayfasında uygulama içi gerçek zamanlı bildirim gelmeme sorunu, broadcast tabanlı ek abonelik ile giderildi.',
          'Mobil Profil Kartı — Alt gezinme çubuğunun altında kalan butonlar için `safe-area-inset-bottom` dolgusu eklendi; artık profil kartı içeriği sistem navigasyon çubuğunun arkasında kalmıyor.',
          'Hoşgeldin Mesajı — Trigger\'ın atlanmış olabileceği durumlar için yeni migration eklendi; v0.7.3 migration\'ı tüm eski trigger varyantlarını temizleyip tek temiz trigger\'ı garanti altına alıyor.',
          'Push Bildirim 404 Hatası — `send-push` Edge Function çağrısı artık ham `fetch` yerine `supabase.functions.invoke()` kullanıyor; Netlify ortamında tanımsız URL sorunu giderildi.',
          'Üretim TDZ Hatası — `fetchPerms` useCallback tanımı, onu bağımlılık olarak kullanan `useEffect`\'ten önceye taşındı; Netlify build\'ında oluşan `ReferenceError: Cannot access before initialization` hatası giderildi.',
        ],
      },
    ],
  },
  {
    version: '0.7.2',
    date: '5 Nisan 2026',
    summary: 'Hoşgeldin mesajı çift gönderim ve {user} şablon hatası düzeltildi; yetkili rol atanınca sunucu ayarları butonu gerçek zamanlı görünüyor.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Hoşgeldin Mesajı Çift Gönderim — SQL trigger ve frontend kodu aynı anda mesaj gönderiyordu; frontend kodu kaldırıldı, artık yalnızca trigger gönderir.',
          'Hoşgeldin {user} Şablonu — Eski trigger adı çakışması (on_member_joined_welcome vs on_member_join_welcome) nedeniyle iki farklı trigger tetikleniyordu; yeni migration tüm eski varyantları silip tek temiz trigger (v4) kurar.',
          'Gerçek Zamanlı Sunucu Ayarları Butonu — Başka bir yetkili rol atandığında kanal listesindeki ⚙ butonu yenileme gerektirmeden anında görünüyor; fetchPerms() artık server_member_roles değişikliklerinde tetikleniyor.',
        ],
      },
    ],
  },
  {
    version: '0.7.1',
    date: '5 Nisan 2026',
    summary: 'Emoji GIF animasyon desteği, çıkış mesajı özelliği, üyeler sayfası yenilendi, engel sistemi arkadaşlık isteğini de kapsıyor, rol atanınca kanal listesi gerçek zamanlı güncelleniyor ve DM embed linkte sunucuya katılınca liste yenileniyor.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Emoji GIF Desteği — Sunucu ayarlarında emoji yüklerken GIF dosyaları artık animasyonunu koruyarak yükleniyor; canvas\'a çizilmeden doğrudan upload ediliyor.',
          'Çıkış Mesajı — Sunucu Ayarları > Genel bölümüne "Çıkış Mesajı" alanı eklendi; üye ayrıldığında belirlenen kanala otomatik bot mesajı gönderiliyor ({user} şablonu desteklenir).',
          'Üyeler Sayfası Yenilendi — Sunucu sahibi Crown (taç) ikonu ve altın rengi ile vurgulandı; "Sahip" rozeti eklendi. Rol yönetim popover\'ı geliştirildi: mevcut roller kaldırılabilir, yeni roller listeye ekleniyor.',
          'Bildirimler — Tarayıcı arka planda olduğunda yeni DM ve etiket bildirimleri için yerel işletim sistemi (Windows/macOS) bildirimi gösteriliyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Engel Sistemi Arkadaşlık İsteği — Hedef kullanıcı sizi engellediğinde artık arkadaşlık isteği butonu gizleniyor; çift taraflı blok kontrolü eklendi.',
          'Rol Atanınca Kanal Listesi Gerçek Zamanlı Güncelleniyor — server_member_roles değişikliklerinde fetchServers() da çağrılıyor; kanal erişimleri anlık güncelleniyor.',
          'DM Embed Sunucu Katılım Listesi — DM içindeki davet embed\'inden sunucuya katılındığında sol kenar çubuğundaki sunucu listesi otomatik yenileniyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Hoş Geldin / Çıkış SQL Trigger — Daha güvenilir COALESCE+NULLIF fallback ile yeniden yazıldı; auth.users yedek kaynağı eklendi; EXCEPTION bloğu ile sessiz hatalar engellendi.',
          'Üye kartı @everyone etiketi — Rol atanmamış üyeler artık "Rol yok" yerine "@everyone" gösteriyor.',
          '3\'ten fazla rol — Üye kartında 3 rol gösterilip geri kalanlar "+N" olarak özetleniyor.',
          'Sürüm numarası v0.7.1 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.7.0',
    date: '4 Nisan 2026',
    summary: 'Mobil telefon ikonu Discord tarzı avatar altına taşındı, DM mesaj alanı mobil tasarıma kavuştu, Android ekran paylaşımı Foreground Service simülasyonu eklendi ve hoşgeldin mesajı {user} şablonu düzeltildi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Üye Listesi Mobil İkonu — Mobil cihazdan bağlı üyeler artık Discord benzeri şekilde avatarın sağ altında yeşil telefon ikonu ile gösterilmektedir. "SEN" yanındaki ikon kaldırıldı.',
          'DM Mobil Mesaj Alanı — DM ekranındaki mesaj giriş alanı artık sunucu kanallarıyla aynı mobil tasarımı kullanıyor; + butonuna tıklayınca "Resim Ekle" ve "GIF Gönder" seçenekleri çıkıyor.',
          'Foreground Service Simülasyonu — Android Chrome\'da ekran paylaşımı başlatıldığında Service Worker aracılığıyla kalıcı bildirim gösterilerek uygulamanın arka planda kapatılması engelleniyor. Paylaşım durduğunda bildirim otomatik kapanıyor.',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Hoşgeldin Mesajı {user} Şablonu — Gerçek zamanlı gelen bot mesajlarında (sunucu sahibi kanalı izlediğinde) {user} artık doğru şekilde sanitize ediliyor. Trigger ile değiştirilemeyen şablonlar için frontend fallback da eklendi.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Ekran paylaşımı başlarken showForegroundNotification, durduğunda closeForegroundNotification çağrılarak bildirim yaşam döngüsü yönetiliyor.',
          'Sürüm numarası v0.7.0 olarak güncellendi.',
        ],
      },
    ],
  },
  {
    version: '0.6.9',
    date: '3 Nisan 2026',
    summary: 'Ekran paylaşımı sonsuz ayna hatası, bot mesaj {user} şablon güvenliği, dinamik bağlantı kalitesi ikonları ve mobil istemci akıllı telefon simgesi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Ekran paylaşımı sonsuz ayna hatası giderildi — Ekranını paylaşan kullanıcı artık kendi yayınını görmez; yerine "Ekranınızı paylaşıyorsunuz" bilgi ekranı gösteriliyor',
          'Bot hoş geldin mesajı {user} şablonu — Eski trigger\'dan gelen replace edilmemiş {user} etiketleri artık istemci tarafında da "kullanıcı" olarak gösteriliyor (çift güvenlik katmanı)',
        ],
      },
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Dinamik bağlantı kalitesi ikonları — Ses kanalındaki bağlantı panelinde Mükemmel/İyi/Zayıf bağlantı durumuna göre SignalHigh/SignalMedium/SignalLow ikonları ve renk kodlaması',
          'Mobil istemci akıllı telefon simgesi — Üye listesinde mobil uygulama kullananlar için Smartphone ikonu',
        ],
      },
    ],
  },
  {
    version: '0.6.8',
    date: '2 Nisan 2026',
    summary: 'Gradient rol animasyonu hover ile soldan sağa, üye listesi gerçek zamanlı rol ataması, MFA giriş düzeltmesi, DM mesaj alanı yenilendi, uzun mesaj Discord mantığı ve bot hoş geldin mesajı düzeltmesi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Gradient rol animasyonu — Kullanıcı adı üzerine gelindiğinde soldan sağa kayan animasyon aktif oluyor; varsayılan durumda animasyon duraksatılmış (Discord tarzı)',
          'MFA giriş sorunu giderildi — Hesabında iki adımlı doğrulama açık olsa bile giriş sayfasında sorulmama hatası düzeltildi; artık doğru şekilde kod isteniyor',
          'DM mesaj yazma alanı — Hem mobilde hem masaüstünde görünmez/bozuk gözüken input alanı yenilendi; bg-input, min-h-[48px] ve items-center ile düzgün görünüm sağlandı',
          'Bot hoş geldin mesajı — SQL trigger artık mesajı sunucu sahibi adına değil "AuroraChat Bot" adına gönderiyor; {user} şablonu kullanıcı adıyla doğru değiştiriliyor',
          'DM sohbette uzun mesajlarda yatay taşma sorunu — inline-block yerine block ve break-words uygulandı',
        ],
      },
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Uzun Mesaj Yönetimi (Discord tarzı) — 400 karakterden uzun mesajlar 200px\'te kırpılıyor; "▼ Devamını göster" butonu ile tam içerik açılabiliyor, "▲ Daha az göster" ile kapatılabiliyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Üye listesi gerçek zamanlı rol ataması — server_member_roles ve server_roles tabloları REPLICA IDENTITY FULL ile Supabase Realtime yayınına eklendi; rol atandığında veya üye ayrıldığında liste anında güncelleniyor',
          'SQL trigger iyileştirildi — Boş display_name/username durumları için NULLIF+COALESCE ile güvenli fallback eklendi',
        ],
      },
    ],
  },
  {
    version: '0.6.7',
    date: '2 Nisan 2026',
    summary: 'Android WebRTC ekran paylaşımı için WakeLock ve MediaSession API entegrasyonu, WebView algılama, otomatik fallback constraints ve gelişmiş hata sınıflandırması.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'WakeLock API — Ekran paylaşımı aktifken Android\'in uygulamayı askıya almasını engeller; sayfa arka plandan döndüğünde kilit otomatik yeniden edinilir',
          'MediaSession API — İşletim sistemi bildirim çubuğuna "Ekran Paylaşımı" aksiyonu eklendi; bildirimden veya kulaklık butonundan paylaşım durdurulabilir',
          'Android WebView Algılama — Sketchware Pro gibi WebView ortamları özellikle tespit edilerek uygun hata mesajı gösterilir',
          'Otomatik Fallback Constraints — OverconstrainedError durumunda ultra-minimal { video: true } ile otomatik yeniden deneme yapılır',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-cyan-400',
        items: [
          'Gelişmiş hata sınıflandırması — NotAllowedError, NotFoundError, NotReadableError, SecurityError için Türkçe açıklama mesajları eklendi',
          'track.onended otomasyonu — Tarayıcı UI veya OS bildirimi üzerinden paylaşım durdurulduğunda arayüzdeki buton ve durum otomatik güncellenir',
          'Mobil constraints optimize edildi — Android/Chrome Mobile için frameRate ideal:15, max:30; masaüstü için 1920×1080 60fps korundu',
        ],
      },
    ],
  },
  {
    version: '0.6.6',
    date: '2 Nisan 2026',
    summary: 'Bot destekli hoş geldin mesajı, mobil safe-area düzeltmesi, InvitePage sunucu bilgisi geliştirmesi, e-posta doğrulama sayfası ve mobil ekran paylaşımı optimizasyonu.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Bot Destekli Hoş Geldin Mesajı — Hoş geldin mesajı artık "AuroraChat Bot" adına gönderiliyor; {user} şablonu katılan üyenin adıyla değiştiriliyor, hem sunucu hem davet linki üzerinden katılımlarda tetikleniyor',
          'E-posta Doğrulama Sayfası (/verified) — Başarılı doğrulama sonrası kullanıcı yeni /verified sayfasına yönlendiriliyor; "Bu sekmeyi kapatıp uygulamaya dönebilirsiniz" mesajı gösteriliyor',
          'Şifre Sıfırlama Yönlendirmesi — AuthCallback type=recovery veya PASSWORD_RECOVERY olayını algılayınca doğrudan ResetPassword sayfasına yönlendiriyor',
          'Mobil Ekran Paylaşımı (WebRTC) — Chrome Android 12+ için getDisplayMedia optimize edildi; mobil cihazlarda daha basit constraints kullanılıyor, hata mesajı netleştirildi',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Sunucu Ayarları Mobil Header — Üst çubuk artık env(safe-area-inset-top) ile durum çubuğunun (saat/pil) altında doğru konumlanıyor',
          'InvitePage — Giriş yapmamış kullanıcılar artık sunucu adını, logosunu ve üye sayısını görebiliyor; "Katıl" yerine doğrudan Giriş Yap / Hesap Oluştur butonları sunuluyor',
        ],
      },
    ],
  },
  {
    version: '0.6.5',
    date: '1 Nisan 2026',
    summary: 'CORS ve hesap silme kritik hatası giderildi, üye listesindeki görsel hata düzeltildi, tooltip sorunu çözüldü ve hoş geldin mesajı tetikleyicisi eklendi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Hesap silme CORS hatası giderildi — delete-account Edge Function\'a OPTIONS preflight ve Access-Control-Allow-Origin: * desteği eklendi',
          'Hesap silme mantığı geliştirildi — sahip olunan sunucular siliniyor, mesajlar ve profil "Deleted User (eski-id)" şeklinde anonimleştirildi',
          'Üye listesindeki hatalı "as" metni kaldırıldı',
          'Üye simgesi üzerindeki tooltip members.title hatası düzeltildi — tüm dil dosyalarına anahtar eklendi',
        ],
      },
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Hoş Geldin Mesajı tetikleyicisi — yeni üye katıldığında belirlenen kanala otomatik mesaj gönderen SQL Trigger aktif edildi',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-yellow-500',
        items: [
          'Hakkında sayfası metni güncellendi: "Discord\'dan esinlenerek geliştirilen gerçek zamanlı sohbet platformu."',
        ],
      },
    ],
  },
  {
    version: '0.6.4',
    date: '1 Nisan 2026',
    summary: 'MFA kritik hataları giderildi, profil fotoğrafı düzenleme arayüzü iyileştirildi ve karanlık fotoğraf sorunu düzeltildi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'MFA 422 "factor already exists" hatası düzeltildi — dialog kapatılırken doğrulanmamış faktör artık Supabase\'den otomatik siliniyor',
          'MFA "factor_id must be an UUID" / 404 hatası giderildi — stale closure sorunu useRef ile çözüldü, factorId artık her zaman güncel değeri kullanıyor',
          'Profil fotoğrafı düzenleme modali: fotoğrafın içi karanlık görünme sorunu düzeltildi — canvas overlay evenodd çizim kuralıyla yeniden yazıldı',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Profil fotoğrafı düzenleme arayüzü yenilendi — daha büyük önizleme (300px), daha belirgin çember kenarı, iyileştirilmiş zoom kontrolü ve modern düzen',
          'Üye listesi Supabase Realtime WebSocket ile canlı güncelleniyor — yeni katılma, ayrılma ve durum değişiklikleri anlık yansıyor',
          'MFA etkinleştirme/devre dışı bırakma kodlarında 6 hane tamamlandığında otomatik doğrulama başlıyor (buton gerekmez)',
          'Uygulama İndir sayfasındaki indirme butonları GitHub Release v0.6.3 doğrudan bağlantılarına güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.6.3',
    date: '31 Mart 2026',
    summary: 'Eksik tooltip\'ler eklendi, şablon sunucu oluşturmada çift "genel" kanal sorunu giderildi, Electron artık Netlify adresini açıyor ve Windows ZIP paketleri güncellendi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Sunucu şablonuyla oluşturmada çift "genel" kanal sorunu giderildi — veritabanı tetikleyicisi zaten "genel" kanalını oluşturduğundan şablon artık bu kanalı atlamaktadır',
          'Sohbet alanı başlık butonlarına (iğnelenmiş mesajlar, üyeler, mesaj ara, bildirim geçmişi) eksik tooltip\'ler eklendi',
          'Kanal listesi butonlarına (sunucudan ayrıl, davet oluştur, sunucu ayarları, kanal oluştur) eksik tooltip\'ler eklendi',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Electron masaüstü uygulaması artık https://aurorachat-tr-beta.netlify.app adresini açmaktadır',
          'Windows 64-bit (AuroraChat-Windows-x64.zip) ve 32-bit (AuroraChat-Windows-ia32.zip) paketleri yenilendi ve GitHub Release\'e yüklendi',
          'MFA (iki adımlı doğrulama): Giriş sırasında Supabase üzerinden gerçek zamanlı kontrol yapılmakta, doğrulama kodu login sayfasında sorulmaktadır',
        ],
      },
    ],
  },
  {
    version: '0.6.2',
    date: '31 Mart 2026',
    summary: 'Mobil arayüz düzeltmeleri: status bar çakışması, bildirimler tam ekran ve DM sohbet giriş alanı iyileştirmeleri.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Kullanıcı Ayarları sayfasında mobilde üst bar artık sistem status bar\'ının altında kalmıyor — safe-area-inset-top desteği eklendi',
          'Bildirimler sayfası mobilde artık tam genişlikte açılıyor, kenarlarda ve üstte gereksiz boşluk kaldırıldı',
          'DM sohbet ekranında çift safe-area padding sorunu düzeltildi — üstte oluşan fazla boşluk giderildi',
          'DM sohbet mesaj gönderme butonu artık giriş alanından taşmıyor, sağ kenar boşluğu düzenlendi',
        ],
      },
    ],
  },
  {
    version: '0.6.1',
    date: '30 Mart 2026',
    summary: 'Arkadaş listesinden sesli arama, arama overlay\'i, davet embedinde ban kontrolü ve arama iptal özelliği.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Arkadaşlar listesinden "Sesli Arama" menü öğesi aktif edildi — tıklayınca DM ekranına geçiş ve otomatik arama başlatılıyor',
          'Arama overlay\'i eklendi: arama sırasında DM ekranının tamamını kaplar, avatarı, adı, dönen ikon ve "Aramayı İptal Et" butonu gösterir',
          'Davet embed\'inde ban kontrolü: sunucudan banlanan kullanıcı "Banlısın" etiketi görür, katılma butonu devre dışı kalır',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Sesli arama zaman aşımı artık useCallback içinde doğru ref ile yönetiliyor — eski yanlış return cleanup pattern düzeltildi',
          'Arama iptal edildiğinde zaman aşımı temizleniyor ve karşı tarafa cancel broadcast\'i gönderiliyor',
        ],
      },
    ],
  },
  {
    version: '0.6.0',
    date: '29 Mart 2026',
    summary: 'DM sesli sohbet tam ekran modu, gradient animasyon düzeltmesi, yankı önleme sistemi ve Electron URL güncellemesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'DM sesli görüşme paneli artık tam ekrana alınıyor — sesli sohbet başlatıldığında mesaj alanı gizlenir, VoiceMeetingRoom tüm alanı kaplar',
          'Aynı cihazdan iki farklı hesapla sesli sohbete girildiğinde otomatik mikrofon kapatma sistemi: BroadcastChannel ile sekmeler arası tespit, yankı önlenir ve kullanıcı uyarılır',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Gradient rol rengi animasyonu artık gerçekten soldan sağa gidiyor — background-position animasyonu 100%→0% olarak düzeltildi',
          'Sesli sohbet yankılanma sorunu: aynı cihazdan birden fazla oturum algılanınca ikinci sekmedeki mikrofon otomatik kapatılıyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Electron masaüstü uygulaması yeni yayın URL\'sine (gojofanitr) güncellendi ve ZIP paketi yeniden oluşturuldu',
          'Kullanıcı Ayarları > Uygulamayı İndir: v0.6.0 ZIP paketine güncellendi',
          'Hakkında sayfasındaki sürüm numarası v0.6.0 olarak güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.5.9',
    date: '29 Mart 2026',
    summary: 'Gradyan rol rengi animasyonu düzeltildi, Electron dosya diyalogları eklendi ve masaüstü paketi güncellendi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Gradyan rol rengi animasyonu artık sonsuz döngüde çalışıyor — "forwards" yerine "infinite" kullanıldı, fareyle üzerine gelindiğinde sürekli soldan sağa kayan animasyon',
          'Gradyan yön bildirgesi "90deg" yerine "to right" olarak güncellendi (MemberList ve ChatArea)',
          'Animasyon süresi 3s\'den 2s\'ye indirildi, geçiş noktası %100\'den %200\'e taşındı — sonsuz döngüde kesintisiz görünüm',
        ],
      },
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Electron masaüstü uygulamasına native dosya diyalogu desteği: Dosya eklerken işletim sisteminin kendi aç/kaydet penceresi açılıyor',
          'contextBridge ile güvenli IPC köprüsü (preload.js): window.electronAPI aracılığıyla showOpenDialog ve showSaveDialog erişimi',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Kullanıcı Ayarları > Uygulamayı İndir: v0.5.9 ZIP paketine güncellendi',
          'Hakkında sayfasındaki sürüm numarası v0.5.9 olarak güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.5.8',
    date: '29 Mart 2026',
    summary: 'Geri tuşu navigasyon sorunu düzeltildi, ekran paylaşımı tek diyalogda açılıyor, sunucu/kanal yükleme hızlandırıldı ve indirme paketi güncellendi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Güncelleme Notları "Tümünü Gör" butonu: Geri tuşu artık doğru sekmeye dönüyor — sekme değişimleri tarayıcı geçmişine kaydediliyor',
          'Ekran paylaşımı artık yalnızca tek diyalog açıyor — ikinci izin penceresi sorunu giderildi',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Sunucu listesi yükleme hızlandırıldı: İki ayrı sorgu yerine tek birleşik sorgu kullanılıyor',
          'Kullanıcı Ayarları > Uygulamayı İndir: v0.5.8 ZIP paketine güncellendi',
          'Hakkında sayfasındaki sürüm numarası v0.5.8 olarak güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.5.7',
    date: '29 Mart 2026',
    summary: 'Masaüstü uygulamasına özel ikon eklendi, ekran paylaşımında sistem sesi gerçek zamanlı iletimi düzeltildi ve indirme bağlantısı güncellendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'AuroraChat masaüstü uygulamasına özel ikon eklendi: Pencere başlığında ve görev çubuğunda AuroraChat ikonu görünüyor',
          'Electron uygulaması ikonlu olarak yeniden paketlendi — v0.5.7 ZIP paketi güncellendi',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Ekran paylaşımında sistem sesi gerçek zamanlı iletim sorunu düzeltildi: Ses artık LiveKit üzerinden diğer katılımcılara doğrudan iletiliyor',
          'Ekran sesi tek diyalogda yakalanıyor — önceden iki kez izin isteme sorunu giderildi',
          '"Sys Ses" butonu artık diğer kullanıcıları da etkiliyor: mute/unmute işlemi LiveKit track\'ine de uygulanıyor',
          'Ekran paylaşımı durdurulduğunda ses track\'i de düzgün şekilde yayından kaldırılıyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Kullanıcı Ayarları > Uygulamayı İndir: v0.5.7 ZIP paketine güncellendi (~96MB, ikonlu)',
          'Hakkında sayfasındaki sürüm numarası v0.5.7 olarak güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.5.6',
    date: '29 Mart 2026',
    summary: 'Mobil ekran paylaşımı desteği, arka planda ses bağlantısı korunması, akıllı boşta durumu ve kick/ban anlık bildirimleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Mobil dikey (portrait) ekranda ekran paylaşımı butonu: Sketchware Pro gibi ekran yakalama izni olan uygulamalar artık paylaşım yapabilir',
          'Arka planda sesli görüşme korunması: Uygulama arka plana alındığında ses bağlantısı kesilmiyor, müzik ve konuşma devam ediyor',
          'Akıllı boşta durumu: Sesli görüşmedeyken arka plana geçmek artık durumunuzu "boşta" olarak ayarlamıyor',
          'Kick/Ban anlık bildirimi: Sunucudan atıldığınızda ya da yasaklandığınızda anında bildirim alıyorsunuz ve otomatik yönlendiriliyorsunuz',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-red-500',
        items: [
          'Ekran paylaşımında çift izin diyaloğu sorunu: İptal edince ikinci kez sormuyordu, artık düzeltildi',
          'Mobilde getDisplayMedia hatası: Desteklenmeyen cihazda açık hata mesajı gösteriliyor, çökme yaşanmıyor',
          'Kick/ban işlemi: Realtime DELETE olayı boş payload döndürdüğü için çalışmıyordu — broadcast ile değiştirildi',
          'Arka planda ses kesilmesi: Uygulama ön plana döndüğünde ses akışları otomatik devam ediyor',
        ],
      },
    ],
  },
  {
    version: '0.5.5',
    date: '28 Mart 2026',
    summary: 'AuroraChat masaüstü uygulaması yayınlandı! Windows için taşınabilir .exe indirme desteği, Electron tabanlı native masaüstü deneyimi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'AuroraChat Desktop (Windows): Electron tabanlı taşınabilir masaüstü uygulaması yayınlandı — kurulum gerektirmez, direkt çalıştır',
          'Kullanıcı Ayarları > Uygulamayı İndir: AuroraChat 0.5.5.exe doğrudan uygulama içinden indirilebilir',
          'Native masaüstü penceresi: AuroraChat artık kendi penceresinde, tarayıcı sekmesi olmadan çalışır',
          'Sistem bildirimleri masaüstü uygulamasında daha güvenilir ve hızlı çalışır',
          'Arka planda ses kanalına bağlı kalma desteği — masaüstü uygulamasıyla kesintisiz ses',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'İndirme butonu artık gerçek bir dosyaya bağlı — placeholder GitHub linki kaldırıldı',
          'Uygulama boyutu optimize edildi: ~95MB taşınabilir paket',
          'Windows 10/11 (64-bit) tam uyumluluk',
        ],
      },
    ],
  },
  {
    version: '0.5.4',
    date: '28 Mart 2026',
    summary: 'Mobil dikey ekrana sesli toplantı odası uyarlaması, ekran paylaşımı katılımcı listesi düzeltmesi ve animasyonlu gradyan rol renkleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Discord tarzı animasyonlu gradyan rol rengi: Üyelerin kullanıcı adları artık atanmış rol renk gradyanıyla soldan sağa kayan animasyonlu efekte sahip',
          'Mobil dikey (portrait) ekranda tam sesli toplantı odası: Alt navigasyona otomatik geçiş yapan "Ses" sekmesi eklendi, ses kanalına girilince otomatik açılıyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Mobil ekran paylaşımı görünümü dikey düzene uyarlandı: Ana paylaşım ekranı üstte, katılımcılar yatay şerit olarak altta',
          'Sesli toplantı odası kontrol çubuğu mobil için küçültüldü, ekran paylaşımı butonu mobilde gizlendi',
          'Ekran paylaşımı sağ panelinde katılımcı kartı yüksekliği artırıldı (90px → 108px) ve genişletildi',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Ekran paylaşımında katılımcı isminin iki kez görünmesi düzeltildi: Avatar kartında merkezdeki isim etiketi kaldırıldı, alt çubukta yalnızca bir kez gösteriliyor',
          'Ses odasına aynı kullanıcı kimliği çift kayıt sorunu giderildi: buildParticipants\'a kimlik tekilleştirme eklendi',
          'Push bildirim konsol hatası susturuldu: AbortError artık sessizce geçiliyor',
        ],
      },
    ],
  },
  {
    version: '0.5.3',
    date: '28 Mart 2026',
    summary: 'Sesli/görüntülü oda glassmorphism yenileme, sistem sesi paylaşımı, kick/ban RLS düzeltmesi ve push bildirim AbortError giderildi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Sesli/görüntülü oda arayüzü tamamen yenilendi: Glassmorphism alt kontrol paneli, neon yeşil mikrofon (açık), kırmızı (kapalı), semantik buton renkleri',
          'Ekran paylaşımında sistem sesi desteği: Paylaşım sırasında bilgisayar sesini de iletme, "Sys Ses" butonu ile açıp kapatabilme',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Ekran paylaşımı kalitesi 1080p/60fps\'e yükseltildi, ses yakalamada fallback mekanizması eklendi',
          'Konuşma animasyonu geliştirildi: avatar üzerinde neon yeşil ping efekti',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Sunucu üye listesi realtime: Kick/ban sonrası üye listesi anında güncelleniyor (server_members realtime yayına eklendi)',
          'Kick/ban RLS politikası: Admin rolü artık üye çıkarma ve banlama işlemlerini gerçekleştirebiliyor',
          'Push bildirimleri AbortError düzeltildi: Service worker artık main.tsx\'te doğru şekilde kaydediliyor (kök neden)',
          'PWA manifest.json eklendi, send-push Edge Function\'da JWT doğrulaması devre dışı bırakıldı (401 hatası giderildi)',
        ],
      },
    ],
  },
  {
    version: '0.5.2',
    date: '28 Mart 2026',
    summary: 'Profil fotoğrafı kırpma modali, masaüstü push bildirimleri, bildirim arama ve React 19 uyumluluk güncellemeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Profil fotoğrafı düzenleyici: Resim seçince Discord gibi kırpma/yakınlaştırma modali açılıyor',
          'Masaüstü push bildirimleri: Tarayıcı kapalıyken bile OS seviyesinde bildirim geliyor (Web Push API)',
          'Bildirim geçmişine arama: Başlık ve içerikte arama, DM/Etiket/Yanıt tür filtresi ve vurgulama',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Davet sayfası yenilendi: Sunucu ikonu, gradient başlık, katılım animasyonu ve daha net hata mesajları',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'DM bildirimi yönlendirme hatası düzeltildi: Bildirimlere tıklayınca 404 hatası oluşmaması sağlandı',
          'Avatar yükleme hatası düzeltildi: .webp ve diğer formatlarda 400 Bad Request hatası artık oluşmuyor (sabit JPEG dönüşümü)',
          'React 19 uyumluluğu: next-themes, vaul ve react-day-picker paketleri güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.5.1',
    date: '28 Mart 2026',
    summary: 'Anket oy kaldırma gerçek zamanlı senkronizasyonu düzeltildi, push bildirim altyapısı tamamlandı ve arkadaş isteği blok koruması eklendi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Anket oy kaldırma gerçek zamanlı: Bir kullanıcı oyunu geri çektiğinde diğer tüm kullanıcılarda anlık güncelleniyor',
          'Anket DELETE olayları artık REPLICA IDENTITY FULL ile tam satır verisi taşıdığından optimistik güncelleme çalışıyor',
          'Arkadaş isteği blok koruması: Birbirini engelleyen kullanıcılar arasında arkadaş isteği gönderilemiyor',
          'DM görünümü bildirim geçmişi: Zil simgesi ve okunmamış sayacı eklendi',
        ],
      },
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Push bildirim altyapısı: Web Push API aboneliği ve push_subscriptions tablosu eklendi',
          'Bildirim geçmişinden DM\'ye yönlendirme: Bildirimlere tıklayınca DM konuşmasına veya kanal mesajına direkt gidilir',
          'Gerçek zamanlı atma (kick): REPLICA IDENTITY FULL ile server_members DELETE olayları tam veri taşıyor',
        ],
      },
      {
        title: 'Teknik',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'message_reactions REPLICA IDENTITY FULL: Optimistik oy güncelleme, aksi durumda 120ms gecikmeli yeniden çekme',
          'server_members ve blocked_users tablolarına REPLICA IDENTITY FULL eklendi',
          'Service Worker: navigate_dm mesaj tipi desteği eklendi',
        ],
      },
    ],
  },
  {
    version: '0.5.0',
    date: '27 Mart 2026',
    summary: 'Bildirim sistemi iyileştirildi, ses/metin geçişi eklendi, gerçek zamanlı atma (kick) ve anket (poll) güncellemeleri yapıldı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Ses + Metin paneli bölünmüş görünümü: Sesli sohbetteyken Sohbet düğmesiyle metin kanalını yan panelde açabilirsiniz',
          'Tarayıcı bildirimleri: @etiketlendiğinizde sekme kapalıyken bile masaüstü bildirimi alırsınız',
          'Bildirim Geçmişi tıklanabilir hale getirildi: Bildirimlere tıklayınca doğrudan ilgili mesaja ve kanala yönlendirilirsiniz',
          'Gerçek zamanlı atma (kick): Kullanıcı atıldığında anında toast bildirimi ve otomatik sunucu çıkışı',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Ses ayarları artık veritabanına kaydediliyor: Mikrofon, hoparlör ve bildirim sesi seçimi hesapla senkronize',
          'Toast bildirimleri sol alt köşeye taşındı: Diğer UI elementleriyle çakışmıyor',
          'Anket (poll) gerçek zamanlı: Oy işlemleri WebSocket/Supabase Realtime üzerinden anlık yansır',
          'Toplantı odası tek katılımcıda büyük avatar modu ve daha temiz kontrol barı',
          'Service Worker eklendi: Uygulama push bildirimlerine hazır altyapı',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'server_members tablosunda REPLICA IDENTITY FULL: DELETE eventleri artık user_id içeriyor',
          'VoiceMeetingRoom kullanıcı adı görünüm sorunu düzeltildi',
        ],
      },
    ],
  },
  {
    version: '0.4.9',
    date: '26 Mart 2026',
    summary: 'Discord tarzı tam ekran Sesli Toplantı Odası eklendi, kamera ve ekran paylaşımı desteği geldi, LiveKit ses sorunu düzeltildi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Sesli Toplantı Odası arayüzü: Ses kanalına girildiğinde sohbet alanı Discord tarzı toplantı odasına dönüşüyor',
          'Kamera desteği: Sesli kanalda kamera açıp video akışı yayınlayabilirsiniz',
          'Ekran paylaşımı: Toplantı odasında ekranı diğer katılımcılarla paylaşabilirsiniz',
          'Katılımcı kartları: Avatar veya kamera görüntüsü, konuşma halkası ve durum göstergeleri',
          'Ekran paylaşımı modu: Aktif ekran paylaşımı büyük alanda gösterilir, katılımcılar yan panele geçer',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'LiveKit ses sorunu düzeltildi: Uzak katılımcıların sesi artık düzgün çalınıyor (TrackSubscribed ile otomatik ekleme)',
          'Deafen modunda tüm ses elementleri mute ediliyor',
          'Ses paneli kaldırıldı: Katılımcılar artık toplantı odasında gösteriliyor',
        ],
      },
      {
        title: 'Teknik',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'useVoice hook\'una toggleCamera ve toggleScreenShare eklendi',
          'VoiceMeetingRoom bileşeni oluşturuldu',
          'Tüm bileşenlerdeki sabit Türkçe metinler i18n sistemine geçirildi (10+ bileşen)',
          'VoiceParticipant arayüzüne cameraEnabled ve screenSharing alanları eklendi',
        ],
      },
    ],
  },
  {
    version: '0.4.8',
    date: '26 Mart 2026',
    summary: 'Sesli sohbet altyapısı yenilendi, ayarlara girince sesten düşme sorunu çözüldü ve yeni sesli sohbet arayüzü eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Discord tarzı aktif ses paneli: Sağ panelde ses kanalındaki kullanıcılar avatarları ve konuşma göstergeleriyle listeleniyor',
          'Konuşma efekti: Konuşan kullanıcının avatarı yeşil halka ve animasyonlu nokta ile belirtiliyor',
          'Ses paneli toggle: Sağ üstteki buton ile ses katılımcı panelini açıp kapatabilirsiniz',
          'Global ses bağlantısı: Artık ayarlara veya sunucu ayarlarına geçince ses bağlantısı kesilmiyor',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Ayarlar sayfasına geçildiğinde ses kanalından düşme sorunu giderildi',
          'Sunucu ayarlarına girildiğinde ses bağlantısının kopması düzeltildi',
          'Supabase Edge Function JWT doğrulama hatası (401) giderildi',
        ],
      },
      {
        title: 'Teknik',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'VoiceContext oluşturuldu: ses bağlantı yönetimi uygulama üst seviyesine taşındı',
          'useVoice hook\'u artık route\'dan bağımsız çalışıyor',
          'Supabase Edge Function çağrılarına açık Authorization header eklendi',
        ],
      },
    ],
  },
  {
    version: '0.4.7',
    date: '25 Mart 2026',
    summary: 'Discord tarzı gerçek zamanlı sesli sohbet LiveKit Cloud ile eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Sesli kanallar artık gerçekten çalışıyor — LiveKit Cloud WebRTC altyapısıyla bağlanın',
          'Ses kanalına katılma: Kanal listesinden bir ses kanalına tıklayarak anında bağlanın',
          'Mikrofon kontrolü: Mikrofonu sessize al / aç butonu ile anlık kontrol',
          'Kulaklık (sağırlaştırma) kontrolü: Tüm gelen sesi tek tıkla kapat / aç',
          'Katılımcı listesi: Ses kanalındaki kullanıcılar kanal altında görüntülenir; konuşanlar yeşil halkasıyla belirtilir',
          'Ses paneli: Bağlandığında sol alt köşede kanal adı, bağlantı durumu ve kontrol butonları gösterilir',
          'Ayrılma butonu: Ses kanalından tek tıkla ayrılın',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Ses kanalına bağlanıldığında ve ayrıldığında sunucu genelinde bildirim gösterilir',
          'Sağırlaştırma açıldığında mikrofon otomatik olarak sessize alınır',
          'LiveKit token Supabase Edge Function üzerinden güvenli biçimde üretilir',
        ],
      },
      {
        title: 'Teknik',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'livekit-client npm paketi entegre edildi',
          'Supabase Edge Function: livekit-token (HS256 JWT üretimi)',
          'useVoice hook\'u: Room bağlantısı, katılımcı takibi, mikrofon/ses yönetimi',
        ],
      },
    ],
  },
  {
    version: '0.4.6',
    date: '24 Mart 2026',
    summary: 'Gizlilik iyileştirmeleri, engelleme sistemi düzeltmeleri ve realtime emoji desteği eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Engelleme sistemi: Engellenen kullanıcı DM\'de mesaj göndermeye çalışırsa AuroraChat "Sistem" etiketiyle sistem mesajı gösterilir',
          'Gizlilik ayarları Supabase\'e kaydediliyor — cihazlar arası senkronize',
          'Arkadaşlık isteği ayarı: Herkes / Ortak Arkadaşlar / Hiç Kimse seçenekleri artık gerçekten uygulanıyor',
          '"Direkt Mesajlara İzin Ver" ayarı kapalıysa arkadaş olmayan kullanıcılar DM gönderemiyor',
          'Ortak arkadaş kontrolü: Arkadaşlık isteği ayarı "Ortak Arkadaşlar" ise ortak arkadaşı olmayan kullanıcılar istek gönderemiyor',
          'Realtime emoji tepkileri: Emoji eklendiğinde veya kaldırıldığında sayfa yenilemesine gerek kalmadan tüm kullanıcılara anlık yansıyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'message_reactions tablosunda REPLICA IDENTITY FULL aktifleştirildi — DELETE olayları artık tam veri taşıyor',
          'DM\'de engelleme kontrolü veritabanı (RLS) seviyesinde de uygulanıyor',
          'Gizlilik ayarları kaydedilirken anlık geri bildirim toast\'u gösteriliyor',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Gizlilik ayarları yalnızca localStorage\'a kaydediliyordu — artık Supabase\'e de yazılıyor',
          'Arkadaşlık isteği gönderilirken hedef kullanıcının gizlilik ayarı kontrol edilmiyordu',
          'Emoji tepkisi silindiğinde diğer kullanıcılarda anlık güncellenmiyordu (REPLICA IDENTITY eksikliği)',
        ],
      },
    ],
  },
  {
    version: '0.4.5',
    date: '23 Mart 2026',
    summary: 'Sunucu oluşturma ve katılma akışı büyük ölçüde yenilendi, DM Dashboard genişletildi ve yeni Bağlı Cihazlar sayfası eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Sunucu Oluşturma Sihirbazı: 7 hazır şablon (Oyun, Eğitim, Arkadaşlar, Topluluk, Müzik, Sanat, Özel) ile 2 adımlı kurulum',
          'Şablona göre otomatik kanal oluşturma — örn. Oyun şablonu: genel, oyun-sohbet, lfg, duyurular',
          'Sunucu oluşturma sırasında özel simge (ikon) yükleme desteği',
          'Sunucu Katılma Diyalogu: kod girilince gerçek zamanlı sunucu önizleme kartı (isim, simge, üye sayısı, kanal sayısı)',
          'Sunucu oluşturduktan veya katıldıktan sonra otomatik olarak o sunucuya yönlendirme',
          'Bağlı Cihazlar (Kullanıcı Ayarları): hangi cihazdan hesaba giriş yapıldığını gerçek zamanlı görme ve uzaktan çıkış yapabilme',
          'DM Dashboard — Çevrimiçi sekmesi: yalnızca aktif arkadaşları listeler',
          'DM Dashboard — Arkadaş satırında sağ tık menüsü: Mesaj Gönder, Sesli/Görüntülü Arama, Arkadaşlıktan Çıkar, Engelle',
          'DM geçmişi listesinde zaman damgası (kaç dakika/saat/gün önce)',
          'Bekleyen arkadaşlık istekleri sayısı sol panelde rozet olarak gösteriliyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'DM listesinde arkadaşların anlık durum rengi (çevrimiçi/boşta/rahatsız etme/çevrimdışı) avatar üzerinde nokta olarak gösteriliyor',
          'Sunucuya katılma diyaloğunda süresi dolmuş veya limitli davet hataları detaylı mesajlarla gösteriliyor',
          'DM arama kutusu artık gerçek zamanlı filtre uyguluyor',
          'Arkadaş satırındaki butonlar hover\'da görünür hale getirildi',
          'Sunucu Oluşturma: Karakter sayacı ve şablon rozeti önizlemede gösteriliyor',
          'Katılınacak sunucu zaten üye olunmuşsa "Zaten üyesin" uyarısı ve buton devre dışı bırakılıyor',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Sunucu oluşturma/katılma sonrası sunucu listesinin yenilenip o sunucuya geçilmemesi sorunu giderildi',
          'Davet kodu ile katılım sonrası kullanıcı artık doğru sunucuya yönlendiriliyor',
        ],
      },
    ],
  },
  {
    version: '0.4.4',
    date: '22 Mart 2026',
    summary: 'Büyük güncelleme: Rol gradient renk, yeni bot komutları, gelişmiş kullanıcı ayarları, DM Dashboard iyileştirmeleri ve mobil chat düzeltmesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Rol gradient renk: Roller sayfasında iki renk seçip kullanıcı adına soldan sağa geçişli renk efekti eklenebilir',
          'UserProfileCard\'a Arkadaş Ekle butonu eklendi — doğrudan profil kartından arkadaşlık isteği gönderilebiliyor',
          'UserProfileCard Mesaj butonu DM\'e yönlendiriyor ve arkadaşlık durumunu gösteriyor',
          'DM Dashboard\'ın sol paneline Sunucu görünümündeki gibi UserInfoPanel eklendi',
          'AuroraChat Bot\'a yeni komutlar eklendi: /ping, /flip, /roll, /poll, /say, /announce, /slowmode',
          'Kullanıcı Ayarlarına Bildirimler ve Hakkında sayfaları eklendi',
          'Hesabım sayfasında Premium üyelik varsa gösteriliyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Sunucu başlığındaki butonlar (davet, ayar) artık her zaman görünür — sadece hover\'da değil',
          'Sunucu başlığından ChevronDown (aşağı ok) ikonu kaldırıldı',
          'Settings sidebar\'a Bildirimler ve Hakkında sekmeleri eklendi',
          'Hakkında sayfasında teknik bilgiler ve güncelleme geçmişi gösteriliyor',
          'Bildirim sayfasında masaüstü bildirimleri, sessiz saatler ve sunucu bildirim seçenekleri',
          'DM Dashboard\'ın sol paneli Sunucu sidebar rengi ile uyumlu',
          'Bot yardım listesi daha kapsamlı ve organize',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Mobil chat arayüzündeki bozuk layout düzeltildi — giriş alanının altındaki gereksiz 68px padding kaldırıldı',
          'UserProfileCard\'da kullanıcının kendi profilinde Arkadaş Ekle butonu artık gösterilmiyor',
          'DMDashboard props güncellemesi ile TypeScript hatası giderildi',
        ],
      },
    ],
  },
  {
    version: '0.4.3',
    date: '21 Mart 2026',
    summary: 'Discord UI Kit entegrasyonu, UserProfileCard yeniden tasarımı, UserInfoPanel sadeleştirmesi ve kritik production hatası düzeltmesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Sunucu kenar çubuğuna Discord tarzı aktif sunucu pill indikatörü eklendi (sol kenar)',
          'Sunucu ikonları hover/aktif durumda yuvarlaktan dörtgene yumuşak CSS geçiş yapıyor',
          'Kanal listesi: başlık üzerine gelince butonlar (davet, ayar) görünür hale geliyor',
          'Aktif kanal için sol kenar pill indikatörü eklendi',
          'Kategori başlıkları hover\'da "+" butonunu açığa çıkartıyor',
          'UserProfileCard Discord tarzında yeniden tasarlandı: büyük banner, büyük avatar, durum rozeti, tarih bilgisi',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'UserInfoPanel sadeleştirildi: Crown ve Gem rozetleri kaldırıldı, sadece display name + username gösteriliyor',
          'Üye listesinden premium taç ikonu kaldırıldı',
          'UserProfileCard\'da premium rozet daha belirgin: Gem ikonu + "Premium" etiketi',
          'Profil kartında kullanıcı durumu (Çevrimiçi/Boşta/vb.) metin olarak gösteriliyor',
          'Profil kartında sunucu katılma tarihi ve AuroraChat kaydı tarihi ayrı satırlarda',
          'Not alanı daha büyük ve odaklanınca ring efekti gösteriyor',
          'Mesaj gönder butonu daha belirgin ve aktif hover/scale efekti var',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Kritik: useState → useStateda yazım hatası düzeltildi — production build\'de "useState is not defined" crash\'i giderildi',
          'Üye listesindeki Crown import\'u temizlendi',
        ],
      },
    ],
  },
  {
    version: '0.4.2',
    date: '20 Mart 2026',
    summary: 'Kullanıcı paneli düzeni iyileştirildi, Premium rozet gem ikonuna dönüştürüldü, DM geçmişi IndexedDB ile çevrimdışı desteklendi ve silinebilir hale getirildi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'DM geçmişi artık IndexedDB\'ye kaydediliyor — çevrimdışı veya sayfa yenilemesinde anında yükleniyor',
          'DM geçmişi silinebilir: Her konuşmanın üzerine gelince çöp kutusu ikonu ile geçmiş gizlenebilir',
          'DM geçmişi Supabase kaynaklı ve IndexedDB önbellekli, çift katmanlı veri mimarisi',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Kullanıcı paneli (sol alt) yeniden tasarlandı: Kullanıcı adı artık tam görünüyor, kesilme sorunu giderildi',
          'Kontrol butonları (mikrofon, kulaklık, ayarlar) daha kompakt; üzerine gelindiğinde tooltip gösteriyor',
          'Premium rozet UserProfileCard\'da taç yerine artık Elmas (Gem) ikonu gösteriyor',
        ],
      },
    ],
  },
  {
    version: '0.4.1',
    date: '20 Mart 2026',
    summary: 'AFK mesaj senkronizasyonu düzeltildi, /info komutu onarıldı, kullanıcı paneli ve DM arayüzü modernize edildi, yeni rozet sistemine geçildi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'AFK mesaj senkronizasyonu düzeltildi: AFK bildirimleri artık kanaldaki herkes tarafından görülebilir',
          '/info komutu onarıldı: Sunucu bilgileri artık doğru embed yapısıyla görüntüleniyor',
          'Kullanıcı panelinde kullanıcı adı artık tam görünüyor, kesilme sorunu giderildi',
        ],
      },
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Yeni rozet sistemi: Sunucu sahipleri için taç ikonu, üzerine gelince "Sunucu Sahibi" tooltip\'i',
          'Premium üyeler için taç yerine Elmas (Gem) ikonu; üzerine gelince "AuroraChat Premium Üyeliği" tooltip\'i',
          'DM arayüzü modernize edildi: Sol tarafta DM geçmişi listesi, sağ tarafta Discord tarzı arkadaş paneli',
          'Yükleme ekranına AuroraChat logosu eklendi',
        ],
      },
    ],
  },
  {
    version: '0.4.0',
    date: '20 Mart 2026',
    summary: '2FA güvenlik düzeltmeleri, gerçek zamanlı rol ve mesaj senkronizasyonu, gelişmiş i18n desteği ve performans iyileştirmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Tüm sunucu üyeleri artık davet linki oluşturabilir (önceden yalnızca sahip/yönetici)',
          'Gizlilik Politikası sayfası artık doğru şekilde çevrilmiş başlık gösteriyor (i18n düzeltmesi)',
          'Tüm dil dosyalarına (TR/EN) eksik privacy anahtarları eklendi',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          '2FA giriş akışı: getAuthenticatorAssuranceLevel() kullanılarak daha güvenilir OTP doğrulaması',
          'Mesaj silme olayı tüm bağlı kullanıcılara Supabase Realtime üzerinden anlık iletildi',
          'Yükleme ekranı sırasında loading durumu 2FA kontrolü tamamlanana kadar aktif kalıyor',
          'Davet sistemi: non-owner üyeler için InviteDialog artık erişilebilir',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          '2FA etkinken giriş sırasında OTP ekranının bazen gösterilmemesi sorunu giderildi',
          'Gizlilik Politikası sayfasındaki "privacy.title" ham anahtar hatası düzeltildi',
          'Davet butonu tüm üyeler için görünür hale getirildi',
        ],
      },
    ],
  },
  {
    version: '0.3.9',
    date: '20 Mart 2026',
    summary: 'Bildirim geçmişi paneli, sunucu ayarları roller iyileştirmeleri, mobil kanal sayfası düzeltmesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Bildirim geçmişi paneli: sohbet başlığındaki zil ikonuna tıklayarak geçmiş DM ve etiket bildirimlerini görüntüle',
          'DM geldiğinde ve biri seni etiketlediğinde otomatik bildirim oluşturulur',
          'Denetim kaydı: hedef kullanıcı bilgisi, göreli zaman damgası ve renkli kenarlıklar eklendi',
          '/ban, /kick, /timeout komutları artık denetim kaydına ekleniyor',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'Sunucu ayarları roller sayfası: rol yeniden adlandırma, üye sayısı rozeti ve üye listesi görünümü',
          'Mobil cihazlarda sunucu ayarları kanal sayfasının layout sorunu giderildi',
          'DM başlığındaki çevrimiçi durum artık presence\'dan doğru okunuyor (çevrimdışı gösterme sorunu düzeltildi)',
          '/afk etiket kontrolü artık Türkçe karakter içeren kullanıcı adlarını tanıyor',
        ],
      },
    ],
  },
  {
    version: '0.3.8',
    date: '19 Mart 2026',
    summary: 'GIF sağlayıcısı Giphy\'den Klipy\'ye geçirildi.',
    sections: [
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-500',
        items: [
          'GIF seçici artık Klipy API\'sini kullanıyor; trend ve arama özellikleri daha hızlı ve kararlı çalışıyor',
          'Arama kutusu artık yazmayı bitirdikten sonra sonuçları getiriyor (debounce eklendi)',
        ],
      },
    ],
  },
  {
    version: '0.3.7',
    date: '19 Mart 2026',
    summary: 'Mobil arayüz iyileştirmeleri, DM statü senkronizasyonu ve emoji girdi hataları giderildi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Emoji otomatik tamamlama menüsü artık mesaj girdi alanının üstünü kapatmıyor',
          'Sunucu ekleme (+) butonu mobilde dokunma alanı düzeltildi ve artık sorunsuz çalışıyor',
          'Üye listesi mobil cihazlarda tam ekranı kapsıyor',
          'Kanal listesi mobil görünümde tam genişlikte gösteriliyor',
          'DM arayüzündeki mesaj hizalama bozuklukları giderildi',
        ],
      },
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'DM ekranında karşı kullanıcının anlık durumu (Çevrimiçi, Boşta vb.) WebSocket üzerinden gerçek zamanlı gösteriliyor',
          'DM statü bilgisi localStorage\'a kaydediliyor — sayfa yenilemede kaybolmuyor',
          'Çentikli (notch) telefonlar ve alt navigasyon barları için güvenli alan (safe area) desteği güçlendirildi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-muted-foreground',
        items: [
          'DM mesajları her iki taraf için de aynı renkte ve sola hizalı olarak gösteriliyor',
          'Mobil sidebar birleşik düzen: sunucu ve kanal listesi Discord mobil gibi yan yana',
          'Emoji/mention/slash komut popup\'ları mobilde klavye açıkken doğru konumlandırılıyor',
        ],
      },
    ],
  },
  {
    version: '0.3.6',
    date: '18 Mart 2026',
    summary: 'Gerçek zamanlı özel durum, anlık rol güncellemeleri ve gelişmiş resim görüntüleyici.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Özel durum (custom status) profil kartında gerçek zamanlı güncelleniyor — sayfa yenilemesine gerek yok',
          'Gelişmiş resim görüntüleyici: yakınlaştırma/uzaklaştırma, sürükleme, pinch-to-zoom (mobil), swipe ile gezinme',
          'Resim görüntüleyicide çift tıklayarak hızlı 2.5x yakınlaştırma',
          'Klavye kısayolları: ok tuşları ile gezinme, +/- ile zoom, 0 ile sıfırlama',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Üye listesinde rol ataması sayfa yenilemeden anlık yansıyor',
          'Profil kartı Supabase realtime aboneliği ile custom_status değişikliklerini anında gösteriyor',
          'Resim görüntüleyici tam ekran, orijinali aç ve indir butonları eklendi',
          'Resim geçişlerinde fade animasyonu eklendi',
        ],
      },
    ],
  },
  {
    version: '0.3.5',
    date: '18 Mart 2026',
    summary: 'Emoji render düzeltmesi, bot mesajlarının sohbete düşmesi, MFA dialog state temizliği ve i18n güvenliği.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Özel emoji render: serverEmojis prop artık ChatArea\'ya doğru geçiriliyor',
          'Bot komut yanıtları artık "AuroraChat Bot" adıyla sohbete düşüyor (toast yerine)',
          'MFA dialog kapatıldığında QR, OTP ve factorId state\'leri temizleniyor',
          'i18n fallback güvenliği güçlendirildi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-muted-foreground',
        items: [
          'Bot mesajları Realtime ile tüm üyelere anında görünür',
          'Kullanıcı komutu da sohbete normal mesaj olarak kaydediliyor',
        ],
      },
    ],
  },
  {
    version: '0.3.4',
    date: '18 Mart 2026',
    summary: 'Mobil alt navigasyon barı, dosya yükleme düzeltmesi, DM silme/düzenleme senkronizasyonu ve mesaj balonu iyileştirmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Mobil Alt Navigasyon Barı: Sunucular, Kanallar, Sohbet, Üyeler ve Ayarlar sekmeleri',
          'Mobilde tek panel görünümü: Her sekme tam ekran açılır',
          'Dosya yükleme düzeltmesi: Sunucu kanallarında dosyalar artık doğru şekilde yükleniyor',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'DM mesaj silme artık her iki tarafta da senkronize (Realtime DELETE)',
          'DM mesaj düzenleme artık veritabanına kaydediliyor (Realtime UPDATE)',
          'Dosya ekleri artık sunucu kanallarında kaybolmuyor',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-muted-foreground',
        items: [
          'Mobilde kanal seçimi otomatik olarak sohbet sekmesine geçiyor',
          'DM DELETE ve UPDATE için RLS politikaları eklendi',
        ],
      },
    ],
  },
  {
    version: '0.3.3',
    date: '17 Mart 2026',
    summary: 'MFA onarımı, AFK sistemi, bot komutları, gelişmiş emoji picker ve bildirim iyileştirmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'MFA Login Challenge: 2FA aktif hesaplarda giriş sonrası TOTP doğrulama ekranı',
          '/afk komutu: AFK modunu aç/kapat, etiketlendiğinde otomatik uyarı',
          'Bildirim İzni Banner: Tarayıcı bildirim izni istek banner\'ı',
          'Bildirim Ayarları Popover: Kanal bazlı bildirim seviyesi ve susturma',
          'Genişletilmiş Emoji Picker: 6 kategori, Türkçe arama, sunucu emojileri sekmesi',
          'Fuzzy Emoji Autocomplete: Klavye navigasyonlu akıllı emoji tamamlama',
          'Slash Komut İkonları: Her bot komutu için görsel ikon',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'MFA Enroll Hatası: Yarım kalmış 2FA kurulumu artık otomatik temizleniyor',
          'DM Dosya Yükleme: Yanlış storage bucket referansı düzeltildi',
          'Bot Komut Şeması: unban komutundaki profil sorgusu düzeltildi',
          'Mesaj Balonu: DM mesajlarında kompakt tasarım',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-muted-foreground',
        items: [
          'Bot Komut Sistemi: /help, /info, /lock, /unlock, /kick, /ban, /unban, /timeout, /untimeout, /afk',
          'AFK Mention Kontrolü: AFK kullanıcı etiketlendiğinde otomatik bildirim',
          'MFA Dialog Reset: Dialog kapatıldığında state temizliği',
        ],
      },
    ],
  },
  {
    version: '0.3.2',
    date: '16 Mart 2026',
    summary: 'Rol bazlı yetki sistemi, Slow Mode, Auto-Mod kelime filtresi, reCaptcha v2, özel durum mesajı ve ses ayarları.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Rol Bazlı Yetki Sistemi: hasPermission helper ile tüm işlemler yetki kontrolüne bağlandı',
          'Slow Mode: Kanal bazlı mesaj hız sınırlama ve geri sayım sayacı',
          'Auto-Mod Kelime Filtresi: Yasaklı kelimeleri otomatik sansürleme',
          'reCaptcha v2: Giriş sayfasında bot koruması',
          'Özel Durum Mesajı: Profil kartında ve üye listesinde görünür',
          'Premium Rozet Yönetimi: Admin kullanıcı diğer kullanıcılara rozet ekleyebilir/kaldırabilir',
          'Hoş Geldin Mesajı: Yeni üye katıldığında otomatik sistem mesajı',
          'Ses Cihazı Seçimi: Giriş/çıkış cihazlarını ayarlardan seçme',
          'Bildirim Sesi: Mesaj geldiğinde hafif bildirim sesi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Kullanıcı panelinde @username bilgisi gösteriliyor',
          'Gizlilik politikasına 2FA ve reCaptcha açıklamaları eklendi',
          'Kanal sıralama butonları (yukarı/aşağı) eklendi',
          'Metin ve ses kanalı oluşturma ServerSettings\'e eklendi',
        ],
      },
    ],
  },
  {
    version: '0.3.1',
    date: '9 Mart 2026',
    summary: 'Özel emoji render düzeltmesi ve DM arayüzü iyileştirmesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Sunucu özel emojileri artık mention ve tüm iç içe elementlerde doğru render ediliyor',
          'DM mesaj baloncukları: Kendi mesajların sağa hizalı ve primary renkli',
          'DM header\'da online durumu göstergesi ve @username bilgisi',
          'DM\'de sesli/görüntülü arama butonları (yakında aktif)',
          'Ardışık mesajlar gruplandı, avatar tekrarı kaldırıldı',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'DM mobil arayüzü: Safe area padding, 16px input font, optimize buton boyutları',
          'DM gönder butonu yuvarlak primary stili ile yenilendi',
          'Mesaj düzenleme/silme butonları mobilde her zaman görünür',
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    date: '9 Mart 2026',
    summary: '@here etiketi ve açık tema desteği eklendi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          '@here etiketi: sadece çevrimiçi kullanıcılara bildirim gönderir',
          '@here otomatik tamamlama desteği ve yeşil vurgulama stili',
          'Açık tema (Light Mode) tam işlevsel hale getirildi',
          'Tema tercihi sayfa yenilemelerinde korunuyor',
        ],
      },
    ],
  },
  {
    version: '0.2.9',
    date: '9 Mart 2026',
    summary: '@everyone etiketi artık Discord gibi çalışıyor.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          '@everyone etiketi: tüm sunucu üyelerini etiketler ve bildirim gönderir',
          '@everyone otomatik tamamlama desteği (mention popup)',
          '@everyone mesajları özel sarı/turuncu stil ile vurgulanır',
          'suppress_everyone ayarına göre bildirim bastırma desteği',
        ],
      },
    ],
  },
  {
    version: '0.2.8',
    date: '9 Mart 2026',
    summary: 'Profil kartlarında kullanıcı durumu artık gerçek zamanlı olarak güncelleniyor.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Profil kartlarında kullanıcı durumu (çevrimiçi/meşgul/boşta/çevrimdışı) gerçek zamanlı güncelleniyor',
        ],
      },
    ],
  },
  {
    version: '0.2.7',
    date: '9 Mart 2026',
    summary: 'Dosya ekleri artık orijinal dosya adı ve boyutuyla görünüyor. Mobil arama ve bildirim butonları çalışır hale getirildi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Dosya ekleri artık UUID yerine orijinal dosya adıyla gösteriliyor',
          'Dosya boyutu bilgisi eklendi (KB/MB formatında)',
          'Mobil arama ve bildirim butonları artık çalışıyor (Sheet olarak açılıyor)',
        ],
      },
    ],
  },
  {
    version: '0.2.6',
    date: '9 Mart 2026',
    summary: 'Mobilde filtreli mesaj arama ve bildirim ayarları, Premium rozet sistemi, RGB animasyonlu Premium kartı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Filtreli mesaj arama ve bildirim ayarları artık mobil arayüzde de erişilebilir',
          'Premium rozet: kullanıcı adının yanında altın taç ikonu (profil kartı + üye listesi)',
          'Premium kartında RGB gökkuşağı animasyonlu köşeler',
          'Profil veritabanına has_premium_badge alanı eklendi',
        ],
      },
    ],
  },
  {
    version: '0.2.5',
    date: '9 Mart 2026',
    summary: 'Dosya ekleri (Discord tarzı embed), AuroraChat Premium sistemi, mobil ayarlar yeniden tasarımı ve profil kartı düzeltmesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Dosya Ekleri: Tüm dosya türleri destekleniyor, Discord tarzı embed görünümü',
          'Dosya indirme güvenlik uyarısı ve "bir daha gösterme" seçeneği',
          'AuroraChat Premium: Basic (10 TL/ay) ve Premium (30 TL/ay) üyelik planları',
          'Mobil ayarlar Discord tarzı dikey liste + alt sayfa + geri butonu',
          'Profil kartı gerçek zamanlı durum gösterimi düzeltildi',
        ],
      },
    ],
  },
  {
    version: '0.2.4',
    date: '9 Mart 2026',
    summary: 'Filtreli mesaj arama, kanal bazlı bildirim ayarları ve gerçek zamanlı bildirim geçmişi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Filtreli Mesaj Arama: Gönderen, tarih aralığı, içerik türü (dosya/link/sabitlenmiş) ve kanal bazlı arama',
          'Bildirim Ayarları: Kanal bazlı bildirim seviyesi (tümü/etiketlemeler/kapalı)',
          'Kanal Susturma: 15dk, 1sa, 8sa, 24sa veya süresiz susturma seçenekleri',
          '@everyone/@here bastırma toggle\'ı',
          'Bildirim Geçmişi: Etiketlemeler, yanıtlar ve sabitleme bildirimleri gerçek zamanlı',
          'Okunmamış bildirim sayacı ve tümünü okundu işaretle butonu',
        ],
      },
    ],
  },
  {
    version: '0.2.3',
    date: '9 Mart 2026',
    summary: 'Mobil menü başlığı düzeltmesi, bildirim izni, boşta ay ikonu ve profil kartı tarih lokalizasyonu.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Bildirim izni: Uygulama açılışında tarayıcı bildirimi izni isteniyor',
          'Boşta durumu ay ikonu ile gösteriliyor (kullanıcı paneli + üye listesi + profil kartı)',
          'Arka plan algılama: Uygulama arka plana alındığında otomatik boşta durumuna geçiş',
          'Profil kartında tarihler seçili dile göre lokalize ediliyor',
          'Profil kartında gerçek zamanlı durum gösterimi',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Mobil mesaj menüsündeki "chat.messageActions" çeviri hatası düzeltildi',
        ],
      },
    ],
  },
  {
    version: '0.2.2',
    date: '8 Mart 2026',
    summary: 'Mobil mesaj uzun basma menüsü, pürüzsüz lightbox geçişleri ve profil kartı mobil düzeltmesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Mobil Mesaj Menüsü: Mesaja uzun basarak Discord tarzı aksiyon menüsü aç',
          'Hızlı tepki ekleme, yanıtlama, düzenleme ve silme tek yerden',
          'Lightbox resim geçişlerinde pürüzsüz fade animasyonu',
          'Lightbox buton yazıları artık mobilde de her zaman görünür',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Profil kartı mobilde ekranın dışına taşma sorunu düzeltildi (Sheet olarak açılıyor)',
          'Mobilde mesaj aksiyon butonlarının görünmeme sorunu giderildi',
        ],
      },
    ],
  },
  {
    version: '0.2.1',
    date: '8 Mart 2026',
    summary: 'Sunucu özel emoji sistemi, gelişmiş rol renk seçici ve detaylı yetkilendirme.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Özel Emoji Sistemi: Sunucunuza 50 adede kadar özel emoji yükleyin',
          'Sohbette :emoji_adi: yazarak özel emojileri kullanın',
          'Emoji Seçici\'de sunucu emojileri ayrı sekmede gösterilir',
          'Emoji yönetimi: İsim düzenleme, tekli ve toplu silme',
          'HEX Renk Seçici: Roller için sınırsız renk seçeneği',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Yönetici (Administrator) yetkisi: Aktif olunca tüm izinler otomatik açılır',
          'Yeni yetki türleri: Sunucu yönetimi, dosya ekleme, emoji yönetimi, mesaj gönderme',
          'Yetki açıklamaları ile daha anlaşılır izin paneli',
          'Emoji görselleri otomatik boyutlandırılarak performans optimize edildi',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '8 Mart 2026',
    summary: 'Thread/Konu sistemi, Discord benzeri rol izinleri ve gelişmiş kullanıcı profil kartı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Thread (Konu) Sistemi: Herhangi bir mesajdan konu başlat, sağ panelde yanıtla',
          'Mesaj altında yanıt sayısı gösterimi ve tıklayarak konuya giriş',
          'Rol İzin Sistemi: Discord benzeri izin toggle\'ları ile detaylı yetki yönetimi',
          'İzin kategorileri: Kanal yönetimi, üye atma/yasaklama, mesaj silme/sabitleme',
          'Gelişmiş Profil Kartı: Banner rengi, hakkımda bölümü, özel not alanı',
          'Profil kartından direkt mesaj gönderme butonu',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Rol izinleri artık pin, delete ve kick aksiyonlarını kontrol ediyor',
          'Profil tablosuna bio ve banner_color sütunları eklendi',
          'Tüm çeviri dosyaları (6 dil) thread ve profil kartı için güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.1.9',
    date: '8 Mart 2026',
    summary: 'Mesaj yanıtlama, mesaj sabitleme ve kullanıcı profil kartı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Mesaj Yanıtlama (Reply): Herhangi bir mesajı yanıtla, referans olarak üstte göster',
          'Yanıtlanan mesaja tıklayarak orijinal mesaja anında kaydır',
          'Mesaj Sabitleme (Pin): Sunucu sahipleri önemli mesajları sabitleyebilir',
          'Sabitlenmiş mesajlar paneli: Pin ikonuna tıklayarak tüm sabitlenmiş mesajları listele',
          'Kullanıcı Profil Kartı: Mesaj yazarına veya üye listesine tıklayarak detaylı profil görüntüle',
          'Profil kartında roller, katılım tarihi ve avatar gösterimi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Tüm çeviri dosyaları (6 dil) yeni özellikler için güncellendi',
          'Mesaj hover aksiyonlarına Yanıtla ve Sabitle butonları eklendi',
        ],
      },
    ],
  },
  {
    version: '0.1.8',
    date: '8 Mart 2026',
    summary: 'Çok adımlı kayıt, şifre sıfırlama, emoji arama düzeltmesi, 2FA ve gizlilik güncellemesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Çok adımlı kayıt paneli: İsim → Doğum Tarihi → Profil Fotoğrafı → Şifre → E-posta',
          'Doğum tarihi doğrulaması: 13 yaşından küçük kullanıcılar kayıt olamaz',
          'Kayıt sırasında profil fotoğrafı yükleme ve önizleme',
          'Şifremi Unuttum: E-posta ile şifre sıfırlama bağlantısı',
          'İki Faktörlü Doğrulama (2FA): TOTP QR kodu ile hesap güvenliği',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Emoji arama sistemi keyword tabanlı filtreleme ile tamamen yeniden yazıldı',
          'Arama sonuçları artık doğru filtreleniyor (smile, heart, fire vb.)',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Gizlilik politikası: Yaş sınırı, bildirim izinleri ve 2FA maddeleri eklendi',
          'Bildirim sistemi: @mention etiketlemelerinde masaüstü bildirimleri',
          'Giriş sayfasına "Şifremi Unuttum" bağlantısı eklendi',
        ],
      },
    ],
  },
  {
    version: '0.1.7',
    date: '8 Mart 2026',
    summary: 'Mobil mesaj çubuğu yenilendi, safe area desteği ve kullanıcı paneli optimizasyonu.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Mobil mesaj yazma alanı tamamen yenilendi (Discord Mobile tarzı)',
          'Emoji ikonu artık input alanının içinde, sağ tarafta sabitlendi',
          'Mobil "+" menüsü: Resim Ekle ve GIF Gönder seçenekleri tek butondan erişilebilir',
          'Gönder butonu mobilde her zaman görünür (yuvarlak ok simgesi)',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Mobil Safe Area desteği: Home Indicator\'a çarpmayan alt bar',
          'Kullanıcı bilgi paneli mobil ekranlar için optimize edildi',
          'Ses ayarları dropdown ok simgelerinin dokunma alanı genişletildi',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Mobilde ikon taşma sorunu tamamen giderildi',
          'Emoji ikonu artık mesaj kutusu dışına taşmıyor',
          'Klavye açıldığında mesaj çubuğunun konumu korunuyor',
        ],
      },
    ],
  },
  {
    version: '0.1.6',
    date: '8 Mart 2026',
    summary: 'AuroraChat Bot, slash komutları, kanal kilitleme ve sesli sohbet stabilizasyonu.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'AuroraChat Bot: Her sunucuya entegre edilmiş akıllı bot asistanı',
          'Slash komutları: /help, /info, /list, /lock, /unlock, /kick, /ban, /timeout ve daha fazlası',
          'Kanal kilitleme: /lock komutuyla kanalları anında kilit altına alabilirsin',
          'Kullanıcı yasaklama ve susturma sistemi eklendi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Sesli sohbet altyapısı LiveKit SDK ile yeniden stabilize edildi',
          'Sesli kanallarda konuşma animasyonu eklendi',
          'Bot mesajları özel arayüzle (BOT etiketi) gösteriliyor',
          'Slash komut öneri popup\'ı: / yazarken otomatik tamamlama',
        ],
      },
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Ses kanalı bağlantı hata yönetimi ve otomatik yeniden deneme eklendi',
          'Üye listesi ve kullanıcı etiketleme sistemindeki senkronizasyon hataları giderildi',
        ],
      },
    ],
  },
  {
    version: '0.1.5',
    date: '8 Mart 2026',
    summary: 'Navigasyon döngüsü düzeltmeleri, kanal yönetimi iyileştirmeleri ve sesli sohbet stabilitesi.',
    sections: [
      {
        title: 'Düzeltmeler',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Ayarlar sayfasına girerken oluşan sonsuz yükleme ekranı döngüsü (Splash Screen Loop) giderildi',
          'Sunucu ayarlarında kanalların kategorilere sürüklenememesi sorunu çözüldü',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Uygulama içi navigasyon hızı artırıldı; sayfalar arası geçiş artık anlık',
          'Kanal ve kategori hiyerarşisi, görsel olarak daha anlaşılır hale getirildi',
          'Sesli kanallar arası geçişte eski bağlantı temizlenerek stabilite artırıldı',
        ],
      },
    ],
  },
  {
    version: '0.1.4',
    date: '8 Mart 2026',
    summary: 'WebRTC sesli sohbet, kanal kategorileri, @etiketleme ve akıllı yükleme ekranı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'WebRTC tabanlı, düşük gecikmeli sesli sohbet kanalları eklendi (LiveKit)',
          'Sunucu ayarlarında sürükle-bırak kanal yönetimi ve kategori sistemi aktif',
          '@Etiketleme özelliği: mesajlarda sunucu üyelerini etiketleyebilirsiniz',
          'Akıllı yükleme ekranı (Splash Screen) ile uygulama stabilitesi artırıldı',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Ses kanallarında konuşan kişinin avatarı yeşil halka ile gösteriliyor',
          'Kanal kategorileri: metin ve ses kanallarını gruplandırabilirsiniz',
          'Etiketlenen kullanıcılar bildirim alıyor',
          'Yükleme ekranı tüm veriler hazır olana kadar ana ekrana geçişi engelliyor',
        ],
      },
    ],
  },
  {
    version: '0.1.3',
    date: '8 Mart 2026',
    summary: 'Discord estetiği, ses kontrolleri, güvenli hesap silme, tema seçici ve DM arayüz iyileştirmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Mikrofon ve kulaklık toggle: kapatıldığında kırmızı çizgili ikon gösterimi',
          'Cihaz seçimi: Giriş/Çıkış cihazları Popover ile listelenip seçilebiliyor',
          'Güvenli hesap silme: mesajlar anonim korunur, profil ve auth kaydı silinir',
          'Tema seçici: Koyu / Açık / Sistem modları Görünüm ayarlarına eklendi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'DM ana sayfası boş durum illüstrasyonu yenilendi (gradient ikon + modern tipografi)',
          'User Info paneli ChannelList\'ten ayrı bileşen olarak çıkarıldı ve DM sayfasına da entegre edildi',
          'DM listesinde hover efektleri ve X butonu daha belirgin hale getirildi',
          'Mesaj çubuğu ikon sıralaması Discord\'a uygun düzenlendi: [+] [input] [Resim] [GIF] [Emoji] [Gönder]',
          'GIF ve dosya ekleme ikonları artık mobilde de görünüyor',
          'Düzenleme butonları (pencil) modern rounded-lg bg-secondary/50 stili ile güncellendi',
        ],
      },
    ],
  },
  {
    version: '0.1.2',
    date: '8 Mart 2026',
    summary: 'Discord tarzı gelişmiş medya görüntüleyici: zoom, pan, swipe galeri ve GIF lightbox desteği.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Discord tarzı tam ekran lightbox: mouse tekerleği ile yakınlaştırma (1x–5x) ve sürükleme desteği',
          'Mobil pinch-to-zoom ve tek parmak sürükleme ile görsel inceleme',
          'Galeri modu: ok tuşları ve mobil swipe ile sohbetteki görseller arasında geçiş',
          'GIF görselleri artık lightbox içinde büyük boyutta açılıyor',
          '"Orijinali Aç" ve "İndir" butonları lightbox alt barına eklendi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Lightbox arka planı derin bulanıklık (backdrop-blur-xl) efekti ile karartıldı',
          'Çift tıklama ile zoom toggle, sıfırlama ve klavye kısayolları (+/-/0) eklendi',
          'Zoom aktifken galeri navigasyonu devre dışı bırakılarak yanlış geçiş engellendi',
        ],
      },
    ],
  },
  {
    version: '0.1.1',
    date: '8 Mart 2026',
    summary: 'Gelişmiş rol sistemi, Discord tarzı davet UI, emoji/GIF desteği ve tam sayfa sunucu ayarları.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Discord stili gelişmiş davet linki oluşturma ve yönetme sistemi eklendi',
          'Rol oluşturma, renk atama ve kullanıcıya rol verme özelliği aktif',
          'Tenor GIF ve Emoji picker desteği ile sohbetler renklendirildi',
          'Denetim Kaydı (Audit Log): Sunucu içi tüm aksiyonlar kayıt altına alınıyor',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'DM senkronizasyon hataları ve 500 hataları tamamen giderildi',
          'DM kanalları CHANNEL_ERROR durumunda otomatik yeniden bağlanıyor',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Sunucu ayarları daha geniş kullanım için tam sayfa yapısına geçirildi',
          'Üye listesinde roller renkli kategoriler halinde gösteriliyor',
          'Davet sistemi: süre sona erme ve maksimum kullanım sayısı ayarlanabiliyor',
          'Tüm sunucu üyeleri davet oluşturabiliyor (sadece sahip değil)',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '3 Mart 2026',
    summary: 'Çok dilli destek sistemi ve uygulama genelinde lokalizasyon.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Çok Dilli Destek: Türkçe, İngilizce, Azerbaycan, Rusça, Japonca, Almanca',
          'Ayarlar sayfasına "Görünüm ve Dil" sekmesi eklendi',
          'Dil seçimi kullanıcı profiline kaydedilir ve oturumlar arasında korunur',
          'Uygulama genelindeki tüm metinler (menüler, butonlar, uyarılar, dialoglar) dinamik hale getirildi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Lightweight i18n sistemi: React Context + TypeScript çeviri dosyaları ile harici kütüphane bağımlılığı olmadan',
          'Dil değişikliği anında uygulanır (sayfa yenileme ile)',
        ],
      },
    ],
  },
  {
    version: '0.0.9',
    date: '3 Mart 2026',
    summary: 'Tam gerçek zamanlı DM sistemi, profil senkronizasyonu ve gizlilik özellikleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Tam Gerçek Zamanlı DM Sistemi (Sayfa yenileme zorunluluğu kaldırıldı)',
          'Profil bilgilerinin (Ad/Kullanıcı adı) tüm platformda anlık senkronizasyonu',
          'DM Mesaj Düzenleme ve Silme özellikleri eklendi',
          'Yeni Gizlilik Politikası sayfası ve Geri Dön butonu eklendi',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Sunucu davet linklerindeki görsel hataları giderildi',
          'Changelog navigasyon döngüsü düzeltildi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Gizlilik ve Güvenlik ayarları (DM izni, arkadaşlık istekleri yönetimi, 2FA UI)',
          'Sunucu ikonu render mantığı iyileştirildi',
        ],
      },
    ],
  },
  {
    version: '0.0.8',
    date: '2 Mart 2026',
    summary: 'UI modernizasyonu, dinamik changelog sistemi ve mobil bottom navigation bar.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Dinamik sürüm notları sistemi (/changelog sayfası)',
          'Mobil bottom navigation bar eklendi',
          '100 sunucu limiti ve sabit alt butonlar',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'DM ve kanal mesajlarında realtime sorunları giderildi',
        ],
      },
      {
        title: 'Geliştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Tüm sayfalar mobil cihazlar için optimize edildi',
          'UI modernizasyonu: rounded-xl, tutarlı spacing',
        ],
      },
    ],
  },
  {
    version: '0.0.7',
    date: '2 Mart 2026',
    summary: 'Gelişmiş davet sistemi ve embed önizleme iyileştirmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Gelişmiş davet sistemi: sunucu üyesi olmayan kullanıcılar da davet linklerini ve sunucu bilgilerini görebiliyor',
          'Embed önizleme iyileştirmeleri: davet kartları tüm kullanıcılar için çalışıyor',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Davet linkleri misafir kullanıcılar için artık "Geçersiz" dönmüyor',
          'Ana sayfa (home) seçiliyken oluşan 400 hataları giderildi',
        ],
      },
    ],
  },
  {
    version: '0.0.6',
    date: '2 Mart 2026',
    summary: 'DM sistemi, arkadaşlık sistemi ve yazıyor göstergesi.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'DM (Direkt Mesajlaşma) sistemi eklendi — arkadaşlarla özel sohbet',
          'Arkadaşlık sistemi: kullanıcı adı ile istek gönderme, kabul/reddetme',
          'Arkadaş listesi sekmeleri: Tümü, Bekleyen İstekler, Arkadaş Ekle',
          'Discord stili gerçek zamanlı "yazıyor..." göstergesi eklendi',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Emoji tepkileri realtime senkronizasyonu düzeltildi — kendi aksiyonlarınız artık çift sayılmıyor',
        ],
      },
    ],
  },
  {
    version: '0.0.5',
    date: '2 Mart 2026',
    summary: 'Emoji tepkileri ve presence sistemi düzeltmeleri.',
    sections: [
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Emoji tepkileri artık anında güncelleniyor — sayfa yenilemeye gerek kalmadan ekleme/kaldırma yapılabiliyor',
          'Kullanıcılar uygulamaya giriş yaptığında artık çevrimiçi olarak doğru görünüyor',
          'Diğer kullanıcıların çevrimiçi durumu artık gerçek zamanlı olarak doğru yansıyor',
        ],
      },
      {
        title: 'Küçük İyileştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Emoji tepkilerinde optimistik güncelleme — anlık UI yanıtı',
          'Presence sistemi yeniden yapılandırıldı — yarış durumu (race condition) giderildi',
        ],
      },
    ],
  },
  {
    version: '0.0.4',
    date: '1 Mart 2026',
    summary: 'Emoji tepkileri ve mesaj düzenleme.',
    sections: [
      {
        title: 'Güncellemeler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Mesajlara emoji tepki özelliği eklendi (Discord tarzı)',
          'Emoji tepkileri gerçek zamanlı olarak tüm kullanıcılara yansıyor',
          'Mesaj düzenleme özelliği eklendi — kullanıcılar kendi mesajlarını düzenleyebilir',
          'Düzenlenen mesajlarda "(Düzenlendi)" etiketi gösteriliyor',
        ],
      },
      {
        title: 'Küçük İyileştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Mesaj zaman formatı GG.AA.YYYY SS:DD olarak güncellendi',
          'Emoji seçici popover ile kolay erişim sağlandı',
          'Tepki toggle mantığı: aynı emojiye tekrar tıklayınca tepki kaldırılıyor',
        ],
      },
    ],
  },
  {
    version: '0.0.3',
    date: '28 Şubat 2026',
    summary: 'Mesaj silme, sunucu yönetimi ve üye atma.',
    sections: [
      {
        title: 'Güncellemeler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Kullanıcılar kendi mesajlarını silebilir',
          'Sunucu sahipleri herhangi bir mesajı silebilir',
          'Üyeler sunucudan ayrılabilir',
          'Sunucu sahipleri üyeleri atabilir',
          'Sunucu ayarları (ad, simge güncelleme) eklendi',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Mobil arayüzde sohbet alanı kaydırma sorunu giderildi',
          'Üye atıldığında üye listesinin güncellenmeme sorunu düzeltildi',
        ],
      },
    ],
  },
  {
    version: '0.0.2',
    date: '25 Şubat 2026',
    summary: 'Profil fotoğrafı, link embed ve kanal oluşturma.',
    sections: [
      {
        title: 'Güncellemeler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Profil fotoğrafı yükleme özelliği eklendi',
          'Mesajlardaki linkler için Discord tarzı embed önizleme eklendi',
          'Kanal oluşturma artık gerçek zamanlı olarak diğer üyelere yansıyor',
        ],
      },
      {
        title: 'Küçük İyileştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Sunucu yükleme hızı optimize edildi',
          'Avatar görüntüleme tüm bileşenlere entegre edildi',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Kanal listesi gerçek zamanlı güncellenmeme sorunu giderildi',
        ],
      },
    ],
  },
  {
    version: '0.0.1',
    date: '25 Şubat 2026',
    summary: 'İlk sürüm: sunucu, mesajlaşma ve davet sistemi.',
    sections: [
      {
        title: 'Güncellemeler',
        icon: Sparkles,
        color: 'text-primary',
        items: [
          'Sunucu oluşturma ve katılma sistemi eklendi',
          'Davet linki oluşturma ve paylaşma özelliği eklendi',
          'Gerçek zamanlı mesajlaşma altyapısı kuruldu',
          'Kullanıcı durumu (çevrimiçi/meşgul/rahatsız etmeyin) desteği eklendi',
          'Güncelleme notları sayfası eklendi',
        ],
      },
      {
        title: 'Küçük İyileştirmeler',
        icon: Wrench,
        color: 'text-accent-foreground',
        items: [
          'Sunucular artık sadece üyelere görünür (Discord benzeri)',
          'Mobil arayüz iyileştirmeleri yapıldı',
          'Ayarlar sayfası responsive tasarımı güncellendi',
        ],
      },
      {
        title: 'Düzeltilen Hatalar',
        icon: Bug,
        color: 'text-destructive',
        items: [
          'Farklı hesaplardan sunucu görünürlük sorunu düzeltildi',
          'Kanal listesi sıralama hatası giderildi',
        ],
      },
    ],
  },
];
