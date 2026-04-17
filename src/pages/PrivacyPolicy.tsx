import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('auth.back')}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            {t('privacy.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Son güncelleme: <strong>17 Nisan 2026</strong> — Sürüm 1.4</p>
        </div>

        <div className="space-y-6 text-sm text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Toplanan Veriler</h2>
            <p>AuroraChat, hizmetlerini sunmak için aşağıdaki verileri toplar:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>E-posta adresi, kullanıcı adı, görünen ad ve profil fotoğrafı</li>
              <li>Doğum tarihi (yaş doğrulaması ve profil ayarları için)</li>
              <li>Cinsiyet (isteğe bağlı; profil ayarlarınıza göre gizlenebilir)</li>
              <li>IP adresi ve cihaz bilgileri (güvenlik amacıyla)</li>
              <li>Mesaj içerikleri (şifreli şekilde saklanır)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Verilerin Kullanımı</h2>
            <p>Toplanan veriler yalnızca şu amaçlarla kullanılır:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Hizmetin sağlanması ve hesap yönetimi</li>
              <li>Hesap güvenliği ve kimlik doğrulama</li>
              <li>Kullanıcı deneyiminin iyileştirilmesi</li>
              <li>Platform içi moderasyon ve kural ihlallerinin önlenmesi</li>
            </ul>
            <p className="mt-2">Verileriniz hiçbir üçüncü tarafla ticari amaçla paylaşılmaz.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Doğum Tarihi ve Cinsiyet Gizliliği</h2>
            <p>
              Kayıt sırasında girdiğiniz doğum tarihi ve cinsiyet bilgileri Supabase veritabanımızda güvenli şekilde saklanır.
              Bu bilgilerin kimler tarafından görülebileceğini <strong>Ayarlar → Gizlilik</strong> sayfasından kontrol edebilirsiniz.
              Seçenekler şunlardır:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li><strong>Herkes</strong> — Tüm kullanıcılar bu bilgiye profil kartınızdan erişebilir</li>
              <li><strong>Arkadaşlar</strong> — Yalnızca arkadaş listenizdekilere görünür</li>
              <li><strong>Kimse</strong> — Hiç kimse bu bilgiyi göremez</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Veri Güvenliği</h2>
            <p>
              Tüm veriler Supabase altyapısında güvenli şekilde saklanır. Row Level Security (RLS) politikaları ile
              her kullanıcı yalnızca kendi verilerine erişebilir. Mesajlar aktarım sırasında TLS ile şifrelenir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. İki Faktörlü Doğrulama (2FA) ve Şifreleme</h2>
            <p>
              Verilerinizin güvenliği için 2FA ve modern şifreleme yöntemleri kullanılmaktadır. 2FA etkinleştirildiğinde,
              hesabınıza giriş yapmak için bir kimlik doğrulama uygulamasından oluşturulan zaman tabanlı tek kullanımlık
              şifre (TOTP) gereklidir. 2FA verileri Supabase Auth altyapısında güvenli şekilde saklanır ve üçüncü taraflarla paylaşılmaz.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. reCAPTCHA</h2>
            <p>
              Giriş sayfasında bot saldırılarını önlemek amacıyla Google reCAPTCHA v2 hizmeti kullanılmaktadır.
              reCAPTCHA, Google'ın Gizlilik Politikası ve Hizmet Şartları'na tabidir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Çerezler ve Yerel Depolama</h2>
            <p>
              AuroraChat, oturum yönetimi ve kullanıcı tercihlerini saklamak için yerel depolama (localStorage) ve
              oturum çerezleri kullanır. Bu veriler cihazınızda tutulur ve sunucularımıza gönderilmez.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Üçüncü Taraf Hizmetler</h2>
            <p>
              AuroraChat bazı üçüncü taraf hizmetlerle entegre çalışabilir (örneğin Spotify). Bu entegrasyonlar isteğe
              bağlıdır ve kullanıcı tarafından etkinleştirilmesi gerekir. Üçüncü taraf hizmetlerin kendi gizlilik
              politikaları geçerlidir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Hesap Silme</h2>
            <p>
              Kullanıcılar istedikleri zaman hesaplarını <strong>Ayarlar → Hesabım</strong> sayfasından silebilir.
              Hesap silindiğinde tüm kişisel veriler (doğum tarihi, cinsiyet dahil) kalıcı olarak kaldırılır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Veri Saklama Süresi</h2>
            <p>
              Hesabınız aktif olduğu sürece verileriniz saklanır. Hesap silme veya talep üzerine verileriniz
              30 gün içinde kalıcı olarak silinir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Politika Değişiklikleri</h2>
            <p>
              Bu gizlilik politikası zaman zaman güncellenebilir. Önemli değişiklikler uygulama içi bildirimlerle
              duyurulacaktır. Güncel politika her zaman bu sayfada mevcuttur.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. İletişim</h2>
            <p>Gizlilik politikası hakkında sorularınız için uygulama içi destek kanalını kullanabilirsiniz.</p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground">
          <p>Bu politika <strong>17 Nisan 2026</strong> tarihinde yürürlüğe girmiştir. Önceki sürüm: 14 Mart 2026.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
