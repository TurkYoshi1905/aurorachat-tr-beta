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

        <h1 className="text-3xl font-bold mb-8 text-gradient bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          {t('privacy.title')}
        </h1>

        <div className="space-y-6 text-sm text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Toplanan Veriler</h2>
            <p>AuroraChat, hizmetlerini sunmak için e-posta adresi, kullanıcı adı, görünen ad ve profil fotoğrafı gibi temel bilgileri toplar. Mesaj içerikleri şifrelenmiş şekilde saklanır.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Verilerin Kullanımı</h2>
            <p>Toplanan veriler yalnızca hizmetin sağlanması, hesap güvenliği ve kullanıcı deneyiminin iyileştirilmesi amacıyla kullanılır. Verileriniz üçüncü taraflarla paylaşılmaz.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Veri Güvenliği</h2>
            <p>Tüm veriler Supabase altyapısında güvenli şekilde saklanır. Row Level Security (RLS) politikaları ile her kullanıcı yalnızca kendi verilerine erişebilir.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. İki Faktörlü Doğrulama (2FA) ve Şifreleme</h2>
            <p>Verilerinizin güvenliği için 2FA ve modern şifreleme yöntemleri kullanılmaktadır. 2FA etkinleştirildiğinde, hesabınıza giriş yapmak için bir kimlik doğrulama uygulamasından oluşturulan zaman tabanlı tek kullanımlık şifre (TOTP) gereklidir. 2FA verileri (faktör kimliği ve kayıt durumu) Supabase Auth altyapısında güvenli şekilde saklanır ve üçüncü taraflarla paylaşılmaz.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. reCaptcha</h2>
            <p>Giriş sayfasında bot saldırılarını önlemek amacıyla Google reCAPTCHA v2 hizmeti kullanılmaktadır. reCAPTCHA, Google'ın Gizlilik Politikası ve Hizmet Şartları'na tabidir.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Çerezler</h2>
            <p>AuroraChat, oturum yönetimi ve kullanıcı tercihlerini saklamak için yerel depolama (localStorage) kullanır.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Hesap Silme</h2>
            <p>Kullanıcılar istedikleri zaman hesaplarını ayarlar sayfasından silebilir. Hesap silindiğinde tüm kişisel veriler kalıcı olarak kaldırılır.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. İletişim</h2>
            <p>Gizlilik politikası hakkında sorularınız için uygulama içi destek kanalını kullanabilirsiniz.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
