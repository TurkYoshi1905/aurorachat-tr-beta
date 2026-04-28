import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  KeyRound,
  Database,
  Eye,
  UserCheck,
  Cookie,
  Globe2,
  Trash2,
  Clock,
  RefreshCw,
  Mail,
  Bell,
  Server,
  Sparkles,
  AlertTriangle,
  Info,
  Gavel,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';

const LAST_UPDATED = '27 Nisan 2026';
const POLICY_VERSION = '1.5';
const PREVIOUS_VERSION = '17 Nisan 2026';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-12">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('auth.back')}
          </button>

          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-primary/15 ring-1 ring-primary/30 items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                  <Sparkles className="w-3 h-3" /> Sürüm {POLICY_VERSION}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" /> KVKK Uyumlu
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-secondary/60 text-foreground/80 border border-border">
                  <Clock className="w-3 h-3" /> {LAST_UPDATED}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-foreground to-accent">
                {t('privacy.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                AuroraChat, kişisel verilerinizin gizliliğini ve güvenliğini son derece ciddiye alır. Bu politika; verilerinizi nasıl topladığımızı, kullandığımızı, sakladığımızı ve KVKK kapsamındaki haklarınızı şeffaf bir şekilde açıklar.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Quick highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {[
            { icon: Lock,        title: 'Uçtan Uca Güvenlik', desc: 'TLS 1.3 + RLS' },
            { icon: KeyRound,    title: '2FA / TOTP Desteği',  desc: 'Hesap koruma' },
            { icon: ShieldCheck, title: 'KVKK Uyumlu',         desc: 'Türkiye standartları' },
          ].map((h, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-secondary/20 p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <h.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{h.title}</p>
                <p className="text-xs text-muted-foreground">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          <Section icon={Database} num={1} title="Veri Sorumlusu">
            <p>
              KVKK 3. madde uyarınca veri sorumlusu sıfatıyla AuroraChat ("Platform"), Türkiye Cumhuriyeti hukukuna tabi olarak faaliyet gösterir. Bu politika kapsamında işlenen tüm kişisel veriler, AuroraChat tarafından <strong>açık rıza</strong>, <strong>sözleşmenin ifası</strong> veya <strong>meşru menfaat</strong> hukuki sebeplerinden birine dayalı olarak işlenmektedir.
            </p>
          </Section>

          <Section icon={Eye} num={2} title="Toplanan Kişisel Veriler">
            <p>AuroraChat, hizmetlerini sunmak için yalnızca aşağıdaki verileri toplar:</p>
            <Bullets items={[
              <><strong>Kimlik verileri:</strong> kullanıcı adı, görünen ad, e-posta adresi, profil ve banner görseli</>,
              <><strong>Demografik veriler:</strong> doğum tarihi (yaş doğrulaması), cinsiyet (isteğe bağlı, gizlilik ayarına tabi)</>,
              <><strong>İletişim verileri:</strong> mesaj içerikleri, ek dosyalar, sesli/görüntülü oda katılımları (oda kapandığında uçucu)</>,
              <><strong>İşlem verileri:</strong> giriş tarihleri, oturum cihaz/işletim sistemi/tarayıcı bilgileri</>,
              <><strong>Teknik veriler:</strong> IP adresi (güvenlik kayıtları için 30 gün), hata izleri</>,
            ]} />
          </Section>

          <Section icon={UserCheck} num={3} title="Verilerin İşlenme Amaçları ve Hukuki Sebepleri">
            <Bullets items={[
              'Hesap oluşturma, doğrulama ve yönetimi (sözleşmenin ifası)',
              'Hizmetin temel işlevlerinin sağlanması (sözleşmenin ifası)',
              'Bot saldırılarının önlenmesi, dolandırıcılığın tespiti (meşru menfaat)',
              'Kural ihlallerinin tespiti ve moderasyon (meşru menfaat / hukuki yükümlülük)',
              'Kullanıcı deneyiminin iyileştirilmesi (açık rıza)',
              'Yasal yükümlülüklerin yerine getirilmesi (hukuki yükümlülük)',
            ]} />
            <p className="mt-3">Verileriniz hiçbir koşulda üçüncü kişilerle ticari amaçla paylaşılmaz, satılmaz veya pazarlama amacıyla kullanılmaz.</p>
          </Section>

          <Section icon={ShieldCheck} num={4} title="KVKK Kapsamındaki Haklarınız">
            <p>KVKK 11. madde uyarınca veri sahibi olarak aşağıdaki haklara sahipsiniz:</p>
            <Bullets items={[
              'Kişisel verilerinizin işlenip işlenmediğini öğrenme',
              'İşlenen verileriniz hakkında bilgi talep etme',
              'İşlenme amacını ve uygun kullanılıp kullanılmadığını öğrenme',
              'Yurtiçi/yurtdışı aktarılan üçüncü kişileri öğrenme',
              'Eksik/yanlış işlenen verilerinizin düzeltilmesini isteme',
              'KVKK 7. madde kapsamında silinmesini veya yok edilmesini isteme',
              'Yapılan düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme',
              'Otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme',
              'Kanuna aykırı işleme nedeniyle uğradığınız zararın giderilmesini talep etme',
            ]} />
            <p className="mt-3">
              Bu haklarınızı kullanmak için <strong>Ayarlar → Hesabım</strong> içindeki ilgili araçları kullanabilir veya destek kanalı üzerinden başvuruda bulunabilirsiniz. Talepleriniz en geç <strong>30 gün</strong> içinde sonuçlandırılır.
            </p>
          </Section>

          <Section icon={Eye} num={5} title="Doğum Tarihi ve Cinsiyet Gizliliği">
            <p>
              Bu hassas bilgileri kimin görebileceğini her zaman <strong>Ayarlar → Gizlilik</strong> sayfasından kontrol edersiniz:
            </p>
            <Bullets items={[
              <><strong>Herkes</strong> — Tüm kullanıcılar profil kartınızdan görebilir</>,
              <><strong>Arkadaşlar</strong> — Yalnızca arkadaş listenizdekilere görünür</>,
              <><strong>Kimse</strong> — Hiç kimse görmez (varsayılan: Arkadaşlar)</>,
            ]} />
          </Section>

          <Section icon={Server} num={6} title="Veri Güvenliği ve Saklama Yeri">
            <p>
              Tüm veriler <strong>Supabase</strong> altyapısı üzerinde, AB merkezli (Frankfurt) veri merkezlerinde barındırılır. Şu güvenlik önlemleri uygulanır:
            </p>
            <Bullets items={[
              'Aktarımda TLS 1.3 ile uçtan uca şifreleme',
              'Row Level Security (RLS) ile satır bazında erişim denetimi',
              'Şifreler için bcrypt algoritmasıyla tek yönlü hash',
              'Supabase Auth altyapısı ile güvenli oturum yönetimi',
              'Veri kayıplarına karşı düzenli yedekleme (PITR — Point-in-Time Recovery)',
              'Otomatik kötüye kullanım tespiti ve hız sınırlaması (rate limiting)',
            ]} />
          </Section>

          <Section icon={KeyRound} num={7} title="İki Faktörlü Doğrulama (2FA) ve reCAPTCHA">
            <p>
              Hesabınızı korumak için 2FA / TOTP desteği sunulur. Etkinleştirildiğinde girişler için kimlik doğrulama uygulamasından üretilen tek kullanımlık şifre istenir. Giriş ve kayıt sayfalarında bot saldırılarına karşı <strong>Google reCAPTCHA v2</strong> kullanılır; reCAPTCHA verileri Google'ın gizlilik politikasına tabidir.
            </p>
          </Section>

          <Section icon={Cookie} num={8} title="Çerezler ve Yerel Depolama">
            <p>
              AuroraChat oturum yönetimi, dil tercihi ve ayarlarınızı hatırlamak için tarayıcınızın <strong>localStorage</strong>, <strong>sessionStorage</strong> ve birkaç adet temel oturum çerezi alanını kullanır. Üçüncü taraf izleme/reklam çerezleri kullanılmaz.
            </p>
          </Section>

          <Section icon={Globe2} num={9} title="Üçüncü Taraf Hizmetler">
            <p>
              Aşağıdaki entegrasyonlar isteğe bağlıdır ve kullanıcının açık rızasıyla etkinleştirilir. Etkinleştirildiklerinde ilgili hizmetin kendi gizlilik politikası geçerli olur:
            </p>
            <Bullets items={[
              <><strong>Spotify</strong> — Müzik durumu paylaşımı (yalnızca etkinleştirilirse)</>,
              <><strong>LiveKit</strong> — Sesli/görüntülü oda altyapısı (oda süresince geçici)</>,
              <><strong>GIPHY/Tenor</strong> — GIF aramaları (anonim sorgu)</>,
            ]} />
          </Section>

          <Section icon={Bell} num={10} title="Bildirimler (Web ve Masaüstü)">
            <p>
              AuroraChat masaüstü (Tauri) sürümünde sistem bildirimlerini gösterebilmek için tarayıcınızdan veya işletim sisteminizden bildirim izni ister. Bu izin yalnızca uygulama içi olaylar (mesaj, çağrı vb.) için kullanılır ve istediğiniz zaman sistem ayarlarınızdan geri çekilebilir.
            </p>
          </Section>

          <Section icon={Trash2} num={11} title="Hesap Silme ve Veri İmha">
            <p>
              <strong>Ayarlar → Hesabım → Hesabımı Sil</strong> üzerinden talebinizi her zaman iletebilirsiniz. Silme işleminin ardından:
            </p>
            <Bullets items={[
              'Profil bilgileriniz, mesajlarınız ve dosyalarınız 30 gün içinde geri dönüşsüz olarak silinir',
              'Hukuki yükümlülük gereği saklanması gereken kayıtlar (örn. denetim/güvenlik logları) yasal süre boyunca anonim hale getirilerek tutulur',
              'Yedeklerden tam silinme döngüsü en geç 90 gün içinde tamamlanır',
            ]} />
          </Section>

          <Section icon={Clock} num={12} title="Veri Saklama Süreleri">
            <Bullets items={[
              <><strong>Hesap verileri:</strong> hesap aktif olduğu sürece</>,
              <><strong>Mesajlar:</strong> kullanıcı silmediği sürece sınırsız (kullanıcı kontrollü)</>,
              <><strong>Güvenlik / IP logları:</strong> 30 gün</>,
              <><strong>Denetim (audit) logları:</strong> 1 yıl</>,
              <><strong>Yedekler:</strong> 30 günlük PITR penceresi</>,
            ]} />
          </Section>

          <Section icon={UserCheck} num={13} title="Çocukların Gizliliği">
            <p>
              AuroraChat 13 yaşın altındaki kullanıcılara hizmet sunmaz. Kayıt sırasında yaş doğrulaması yapılır; 13 yaşından küçük olduğu tespit edilen hesaplar derhal askıya alınır ve verileri silinir. 18 yaşından küçük kullanıcılar için ebeveyn / vasi onayı tavsiye edilir.
            </p>
          </Section>

          <Section icon={RefreshCw} num={14} title="Politika Değişiklikleri">
            <p>
              Bu politika zaman zaman güncellenebilir. Önemli değişiklikler oturum açtığınızda uygulama içi bildirim ve sürüm notları modali ile duyurulacaktır. Önemli olmayan düzenlemeler bu sayfada yayınlanır.
            </p>
          </Section>

          <Section icon={Mail} num={15} title="İletişim ve Başvuru">
            <p>
              Bu politikaya, KVKK kapsamındaki haklarınıza veya verilerinize ilişkin her türlü talep ve şikayetiniz için:
            </p>
            <div className="mt-3 rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm">
              <p className="text-foreground/90"><strong>Veri Sorumlusu:</strong> AuroraChat</p>
              <p className="text-muted-foreground"><strong>Başvuru kanalı:</strong> Uygulama içi <em>Destek &amp; Yardım</em> bölümü ya da <code className="px-1.5 py-0.5 rounded bg-secondary/60 text-foreground text-xs">Ayarlar → Geri Bildirim</code></p>
              <p className="text-muted-foreground mt-1"><strong>Yanıt süresi:</strong> 30 gün içinde</p>
            </div>
          </Section>
        </div>

        {/* Rules link CTA */}
        <button
          onClick={() => navigate('/rules')}
          className="mt-10 w-full group rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent hover:border-red-500/50 transition-all p-5 text-left flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-red-500/15 ring-1 ring-red-500/30 flex items-center justify-center shrink-0">
            <Gavel className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground mb-0.5">AuroraChat Kuralları</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Topluluk kurallarımızı, ihlal türlerini ve uygulanan ban sürelerini detaylı olarak okuyun.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-red-400 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Footer note */}
        <div className="mt-6 pt-6 border-t border-border/60 flex items-start gap-3 text-xs text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Bu gizlilik politikasının <strong>{POLICY_VERSION}</strong> sürümü <strong>{LAST_UPDATED}</strong> tarihinde yürürlüğe girmiştir. Önceki sürüm: <strong>{PREVIOUS_VERSION}</strong>. Politika her zaman bu sayfada güncel olarak yayınlanır.
          </p>
        </div>
      </div>
    </div>
  );
};

const Section = ({
  icon: Icon,
  num,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  num: number;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6 hover:border-border transition-colors">
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/60">#{num}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-2.5">{title}</h2>
        <div className="text-sm text-foreground/75 leading-relaxed space-y-2">{children}</div>
      </div>
    </div>
  </section>
);

const Bullets = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="space-y-1.5 mt-1">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2 text-muted-foreground">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
        <span className="flex-1">{item}</span>
      </li>
    ))}
  </ul>
);

export default PrivacyPolicy;
