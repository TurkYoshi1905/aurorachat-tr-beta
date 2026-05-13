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
    version: '1.1.7',
    date: '13 Mayıs 2026',
    summary: 'Özel Profil Banner (resim/GIF), Bot Profil Modalı sohbet entegrasyonu, Moderasyon 403 düzeltmesi, Gizlilik senkronizasyonu fix, Kayıt avatar kalıcılığı, Sesli sohbet region cache optimizasyonu.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Özel Profil Banner: Ayarlar > Görünüm bölümünden resim veya GIF yükleyerek profil bannerını özelleştirebilirsin. Yükleme tamamlandığında şık bir başarı modalı gösterilir.',
          'Banner Gerçek Zamanlı: Yüklenen banner tüm kullanıcılara Supabase Realtime ile anında yansır.',
          'Bot Profil Modalı (Sohbet): Sohbette özel bot mesajlarının avatarına veya adına tıklayınca artık tam BotProfileModal açılıyor — bot bilgileri, komutlar ve sunucuya ekleme sekmesi ile.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'Sesli Sohbet Region Optimizasyonu: LiveKit region isteği artık sesli oturum boyunca sadece bir kere atılıyor — tekrarlayan istek döngüsü kırıldı.',
          'Gizlilik Ayarları Senkronizasyonu: Cinsiyet ve doğum tarihi görünürlük ayarları doğrudan Supabase\'den yükleniyor; AuthContext üzerinden gelen stale veri sorunu giderildi.',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'Moderasyon 403 Forbidden: mod_role_assignments tablosuna INSERT/UPDATE/DELETE RLS politikası güncellendi — app adminler artık rol atayabiliyor.',
          'Profil update 403: profiles tablosu için admin güncelleme politikası yeniden yazıldı.',
          'Kayıt Avatar Kaybı: Kayıt sırasında seçilen profil resmi artık kalıcı — session doğrulaması eklenerek race condition giderildi.',
        ],
      },
      {
        title: 'Altyapı',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'SQL migration: 20260513000000_v117_banner_mod_fixes.sql',
          'Yeni kolon: profiles.banner_url (resim veya GIF URL).',
          'Yeni storage bucket: profile-banners (10MB limit, jpeg/png/gif/webp).',
          'RLS güncellemeleri: mod_role_assignments tam CRUD, profiles admin update fix.',
        ],
      },
    ],
  },
  {
    version: '1.1.6',
    date: '10 Mayıs 2026',
    summary: 'Moderasyon rol yönetimi Users sekmesine taşındı, gizlilik ayarları kalıcı hale getirildi, Eklenti Mağazası revize edildi, sunucu sıralama DB\'ye kaydediliyor, Bot Profil Modalı yeniden tasarlandı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Moderasyon Rol Yönetimi: Kullanıcılar sekmesinde her kullanıcıya doğrudan "Deneme Moderatör / Moderatör / Admin / Yetkili" rolü atanabilir/kaldırılabilir.',
          'Moderasyon Rol Tagları: Moderasyon rolüne sahip kullanıcıların adının yanında renkli etiket görünür (üye listesi, mesajlar, profil).',
          'Mod Rol Erişimi: Moderasyon rolü olan kullanıcılar artık panele otomatik erişim kazanıyor; sadece Kurucu ile sınırlı değil.',
          'Kullanıcı IP Arama: Güvenlik sekmesinde kullanıcı adı ile IP adresini arama ve IP Ban atma entegre edildi.',
          'Eklenti Düzenleme Modalı: Kendi eklentini "Eklentilerim" sekmesinden satır içi düzenleyip kaydedebildin.',
          'Eklenti Dokümantasyonu: Mağazada "Dokümantasyon" butonu ile eklenti geliştirme rehberi açılıyor.',
          'Bot Profil Modalı Yeniden Tasarımı: Modern banner, sekme yapısı (Hakkında / Komutlar / Sunucuya Ekle), bot istatistikleri (sunucu sayısı, komut sayısı, oluşturma tarihi).',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'Gizlilik Ayarları: Cinsiyet ve Doğum Tarihi görünürlük tercihleri artık kalıcı — profiles tablosuna yeni kolonlar eklendi, sayfa yenilense bile korunuyor.',
          'Sunucu Sıralama: Sürükle-bırak sırası Supabase\'e kaydediliyor ve sayfa yenilenince DB\'den geri yükleniyor.',
          'Eklenti Mağazası: Oluşturan kişinin kullanıcı adı ve görünen adı kart üzerinde gösteriliyor. Mağaza / Eklentilerim görsel olarak ayrıştırıldı.',
          'Sunucu Sıralama Performans: IndexedDB anında yükler, Supabase arka planda senkronize eder.',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'Moderasyon 403 Forbidden: profiles RLS politikası güncellendi — app adminler başkasının profilini güncelleyebiliyor.',
          'Gizlilik kaydetme hatası: gender_visibility ve birth_date_visibility kolonları DB\'ye eklendi.',
          'Sunucu sıralama kaybı: server_members.order_index kolonu eklendi.',
          'IP Ban RLS: banned_ips tablosu admin yazma politikasıyla güncellendi.',
          'mod_role_assignments okuma: SELECT politikası herkese açık yapıldı.',
        ],
      },
      {
        title: 'Altyapı',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'SQL migration: 20260510000000_v116_updates.sql',
          'Yeni tablolar: user_login_ips (kullanıcı IP geçmişi).',
          'Yeni kolonlar: profiles.gender_visibility, profiles.birth_date_visibility, server_members.order_index.',
          'Güncel RLS: profiles, mod_role_assignments, banned_ips, user_login_ips.',
        ],
      },
    ],
  },
  {
    version: '1.1.5',
    date: '8 Mayıs 2026',
    summary: 'Aurora Guard güvenlik katmanı (IP Ban, Rate Limit, XSS), profesyonel moderasyon rol hiyerarşisi, bot profil modalı, komut değişken sistemi ve kritik hata düzeltmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Aurora Guard: IP Ban sistemi — Yasaklanan kullanıcının IP\'si veritabanına işlenir; erişim anında "Erişim Engellendi" modalıyla kesilir.',
          'Rate Limit Koruması: Mesaj gönderiminde saniyede 6 istek sınırı; sınırı aşan kullanıcı 30 dakika cooldown\'a alınır.',
          'Cooldown Yönetimi: Moderasyon panelinden aktif cooldown durumları görülebilir ve kaldırılabilir.',
          'XSS & DDoS Koruması: Tüm metin girişleri (mesaj, yorum, duyuru) sanitize edilir; <script> enjeksiyonu engellenir.',
          'Bot Profil Modalı: Bota tıklayınca BotProfileModal açılır — bot adı, kullanıcı adı, açıklama ve "Sunucuya Ekle" butonu.',
          'Bot Komut Değişkenleri: {user}, {username}, {memberCount}, {serverName} değişkenleri komut yanıtlarında canlı verilerle render edilir.',
          'Komut Değişken Butonları: Komut oluşturma ekranında değişken butonlarına tıklayınca yanıt alanına otomatik eklenir.',
          'Komut Düzenleme: Kullanıcılar kendi botlarının komutlarını satır içi düzenleyip kaydedebilir.',
          'Moderasyon Rol Hiyerarşisi: Yetkili, Admin, Moderatör, Deneme Moderatör rolleri eklendi; sadece kurucu dağıtabilir.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'Bot "Her Zaman Online": Botlar artık sekme değişince çevrimdışı görünmüyor; veritabanı presence kontrolüyle her zaman online.',
          'Sesli Sohbet UI: Mikrofon yanındaki ses ayarları oku daha büyük ve görünür yapıldı; cihaz ayarları paneli iyileştirildi.',
          'Mesaj Anlık Render: Supabase INSERT payload\'ı anında state\'e yansıtılır; sayfa yenileme gereksinimsiz.',
          'Bildiriler Durum Fix: Bildirim durumu artık dinamik — Reddedildi/Onaylandı/Beklemede doğru gösterilir.',
          'SEO Güncellemesi: index.html tam profesyonel meta etiketleri, Open Graph, Twitter Card ve JSON-LD yapısal verisiyle güncellendi.',
          'Güvenlik Koruması: Hesap açma ve girişte de oran sınırı uygulanıyor; brute-force saldırılarına karşı önlem.',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'Duyuru yorumu silme 42501 hatası: announcement_comments DELETE RLS politikası kullanıcı kendi yorumunu silecek şekilde düzeltildi.',
          'Bot moderasyon koruması: Aynı seviye yetkililer birbirini banlayamaz; kurucu yetkisi alınamaz.',
          'Sesli sohbet döngüsü: Tekrarlı region isteği kırıldı, sadece bir kere fetch edilir.',
        ],
      },
      {
        title: 'Altyapı',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'SQL migration: 20260508000000_v115_aurora_guard_security.sql',
          'Yeni tablolar: banned_ips, rate_limit_cooldowns, mod_role_assignments.',
          'Yeni yardımcılar: src/utils/rateLimiter.ts, src/utils/sanitize.ts.',
          'lift_user_cooldown RPC: Admin cooldown kaldırma fonksiyonu.',
        ],
      },
    ],
  },
  {
    version: '1.1.4',
    date: '7 Mayıs 2026',
    summary: 'Duyuru detay sayfası, sesli sohbet kazanç kontrolü (hoparlör %200\'e kadar), bot üye listesi ve komut sistemi düzeltmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Duyuru Detay Sayfası: Her duyuruya tıklayarak /announcements/:id adresinde tam içerik, tüm yorumlar ve yanıtlar görüntülenebilir.',
          'Sesli Sohbet Kazanç Kontrolü: Mikrofon butonu yanındaki ayar okuna tıklayarak hoparlör ses seviyesini %0-%200 arasında ayarlayabilirsin. Gelen sesler artık %200\'e kadar amplifikasyon destekliyor.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'Botlar üye listesinde her zaman "Çevrimiçi" olarak görünüyor.',
          'Özel bot komutları slash (/) popup\'ta BOT rozeti ile gösteriliyor.',
          'server_bots SELECT politikası güçlendirildi; tüm üyeler bot listesini görebiliyor.',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'bots.commands sütunu NOT NULL + varsayılan boş dizi olarak düzeltildi.',
          'get_server_members_full RPC EXCEPTION bloğu eklendi; hata durumunda fallback üye listesi döndürülüyor.',
          'get_server_bot_commands RPC eklendi; özel komutlar doğrudan sorgulanabiliyor.',
        ],
      },
    ],
  },
  {
    version: '1.1.3',
    date: '6 Mayıs 2026',
    summary: 'Duyuru Sistemi, Grup DM gerçek zamanlı durum düzeltmesi, sesli oda yeniden boyutlandırma, Tekrar Ara düzeltmesi ve sunucu sırası kalıcılığı.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Duyuru Sistemi: Ayarlar > Duyurular üzerinden resmi AuroraChat duyurularını görebilirsin. Yöneticiler zengin metin (kalın/italik/link), resim eki ve duyuru yayınlayabilir.',
          'Duyuru Yorumları: Her duyuruya yorum yapabilir, yanıt verebilir ve kendi yorumlarını silebilirsin.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'Grup DM Sesli Oda yeniden boyutlandırma: Oda penceresinin altındaki tutamacı sürükleyerek yüksekliği ayarlayabilirsin (140–520px).',
          'Sunucu sırası kalıcılığı: Sunucu sıralaması artık Supabase\'e de yazılıyor; farklı cihazlarda sıralama senkron kalıyor.',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'Grup DM Tekrar Ara düzeltmesi: "Tekrar Ara" butonu artık dinleyici kanalıyla eşleşen doğru kanala yayın gönderiyor.',
          'Grup DM üye durumu gerçek zamanlı: Supabase Presence ile üyeler ayrıldığında durum anında "Çevrimdışı" oluyor.',
          'server_bot_roles 42P01 hatası: Tablo CREATE IF NOT EXISTS ile güvenli oluşturma, tekrarlı politika DROP IF EXISTS ile düzeltildi.',
        ],
      },
      {
        title: 'Altyapı',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'get_server_members_full RPC son stabil sürümü; last_seen ve platform alanları eklendi.',
          'announcements ve announcement_comments tabloları; RLS, realtime yayınları ve helper RPC\'ler.',
        ],
      },
    ],
  },
  {
    version: '1.1.2',
    date: '5 Mayıs 2026',
    summary: 'Grup DM Sesli Arama, Bot profil düzenleme, Bot sunucuya ekleme modalı, Bot Ekleme İzni rolü, gerçek zamanlı durum senkronizasyonu düzeltmesi ve kritik veritabanı hata giderimleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Grup DM Sesli Arama: Grup sohbetlerinde sesli arama başlatabilir, üyeleri arayabilir ve tekrar arayabilirsin. Arama arayüzü VoiceMeetingRoom ile tam entegredir.',
          'Bot Profil Düzenleme: Bot Geliştirici Merkezi\'ndeki "Genel" sekmesinde botun adını, kullanıcı adını ve profil fotoğrafını düzenleyebilirsin. Değişiklikler tüm sunuculara anlık yansır.',
          'Bot Sunucuya Ekle Modalı: Bot profil kartında "Sunucuya Ekle" butonuyla bot sahibi olmayan kullanıcılar da izinleri varsa bot davet edebilir.',
          'Bot Ekleme İzni: Sunucu Ayarları > Roller > İzinler bölümüne "Bot Ekleme İzni" (manage_bots) eklendi. Bu izne sahip roller sunucuya bot davet edebilir.',
          'Bot Slash Komutları: Bot Geliştirici Merkezi\'nde tanımlanan özel komutlar (/komut) artık mesaj kutusundan tetiklenebilir ve bot yanıtı otomatik gönderilir.',
        ],
      },
      {
        title: 'İyileştirmeler',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'Grup DM üye listesinde isme tıklanınca UserProfileCard açmak yerine mesaj kutusuna @kullanıcıadı ekleniyor.',
          'Sunucu üye listesi tıklama mantığı standartlaştırıldı ve bot üyeler için hata koruması eklendi.',
          'Gerçek zamanlı durum senkronizasyonu optimize edildi: Supabase Presence channel artık kullanıcı girip çıktığı an üye listesini günceller.',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'get_server_members_full RPC 404 hatası giderildi; botlar sunucu üye listesinde doğru listeleniyor.',
          'server_bot_roles tablosu 42P01 hatası: Tablo varsa atla mantığı eklendi, RLS politikaları düzeltildi.',
          'server_bots INSERT politikası: Bot sahipleri artık kendi botlarını sunuculara ekleyebilir.',
          'Üye listesindeki çevrimiçi/çevrimdışı durumlarının sadece sayfa yenileyince düzelmesi sorunu çözüldü.',
        ],
      },
      {
        title: 'Altyapı',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'group_dm_voice_calls tablosu oluşturuldu — Grup DM sesli arama durumu için.',
          'bots ve server_bots tabloları realtime yayınına eklendi (REPLICA IDENTITY FULL).',
          'SQL migration: 20260505000000_v112_group_dm_voice_bots.sql',
        ],
      },
    ],
  },
  {
    version: '1.1.1',
    date: '2 Mayıs 2026',
    summary: 'Mobil arayüz iyileştirmeleri, Bot Kod Editörü ve Komut Yönetimi, WebView render düzeltmesi, Bildirim durumu gerçek zamanlı güncelleme fix.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Bot Kod Editörü: Bot Geliştirici Merkezinde JavaScript tabanlı bot kodu yazma ve kaydetme.',
          'Komut Yönetimi: Botlara trigger, ad, açıklama ve yanıt içeren özel komutlar ekleyip kaldırabilirsin.',
          'Mobil Bot Geliştirici: Tek panel düzeniyle mobil cihazlarda tam uyumlu — bot listesi ve detay arasında geri tuşu ile geçiş.',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'Mobil alt navigasyon: DM görünümünde "Arkadaşlar" sekmesine basınca arkadaş listesi açılıyor.',
          'WebView render artefaktı: Hakkında sayfasındaki CSS değişkeni kaynaklı radial gradient kaldırıldı, yatay çizgi titreşmeleri giderildi.',
          'Bildirilerim: Yönetici onay/ret yaptığında status "Beklemede" yerine gerçek zamanlı güncelleniyor (REPLICA IDENTITY FULL).',
          'Bot profil kartı yükleme, üye listesi bot entegrasyonu, sunucu ayarlarında bot rol yönetimi, Spotify PKCE düzeltmeleri.',
        ],
      },
      {
        title: 'Altyapı',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'message_reports tablosu: REPLICA IDENTITY FULL eklendi — gerçek zamanlı durum güncellemeleri filtreli kanalda artık çalışıyor.',
          'bots tablosu: code TEXT ve commands JSONB kolonları eklendi.',
          'SQL migration: 20260502800000_v111_reports_replica_identity.sql',
          'SQL migration: 20260502800001_v111_bot_code_commands.sql',
        ],
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2 Mayıs 2026',
    summary: 'Bot & Geliştirici sistemi, Plugin/Eklenti mağazası, Ekran paylaşımı arka plan düzeltmesi, Boşluklu kullanıcı adı etiketleme regex düzeltmesi ve gerçek zamanlı durum iyileştirmeleri.',
    sections: [
      {
        title: 'Yeni Özellikler',
        icon: Sparkles,
        color: 'text-yellow-400',
        items: [
          'Bot Geliştirici Merkezi: Bot oluştur, profil resmi yükle, token yönet, sunuculara ekle/çıkar.',
          'Botlar üye listesinde "Bot" rozeti ile görünür (UserProfileCard üzerinde özel uygulama rozeti).',
          'Eklenti Sistemi: Ayarlar → Eklentiler sekmesinde CSS/JS tabanlı tema ve işlevsel eklentiler oluşturup mağazaya gönderebilirsin.',
          'Eklenti Mağazası: Diğer kullanıcıların eklentilerini "Yükle" diyerek kendi arayüzüne uygulayabilir, "Kaldır" diyerek devre dışı bırakabilirsin.',
          'Ayarlar → Hakkında bölümüne Geliştirici Araçları kartı eklendi (Bot Merkezi ve Eklenti Sistemi hızlı erişim).',
        ],
      },
      {
        title: 'Hata Düzeltmeleri',
        icon: Bug,
        color: 'text-red-400',
        items: [
          'Boşluklu kullanıcı adı etiketleme düzeltildi: "@Caner Demir" gibi isimler artık @[Caner Demir] formatında doğru şekilde işleniyor.',
          'Ekran paylaşımı arka plan sekmesi: Tab arka plana alındığında video akışının donması engellendi — visibilitychange ile video yeniden oynatılıyor.',
          'Ekran paylaşımı tam ekran: object-fit: contain ile görüntü bozulması engellendi, tam ekranda içerik doğru oranlarla gösteriliyor.',
          'Grup DM üye listesi gerçek zamanlı durum: profiles tablosu REPLICA IDENTITY FULL ile güncellendi, durum değişiklikleri sayfa yenilemeden anlık yansıyor.',
        ],
      },
      {
        title: 'Altyapı',
        icon: Wrench,
        color: 'text-blue-400',
        items: [
          'Yeni SQL tabloları: bots, server_bots, plugins, user_plugins — RLS politikaları ve realtime yayını ile.',
          'Plugin kurulum/kaldırma trigger\'ları: install_count otomatik artırılıp azaltılıyor.',
          'profiles REPLICA IDENTITY FULL güncellendi — realtime status diff\'leri artık eksiksiz iletiliyor.',
          'SQL migration: 20260502300000_v110_bots_plugins_realtime.sql',
        ],
      },
    ],
  },
];
