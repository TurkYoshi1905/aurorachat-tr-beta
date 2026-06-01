import {
  ArrowLeft,
  Gavel,
  ShieldAlert,
  AlertTriangle,
  Ban,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  MessageSquareWarning,
  Megaphone,
  EyeOff,
  Skull,
  UserX,
  HeartCrack,
  Bot,
  ImageOff,
  Info,
  ScrollText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = '28 Nisan 2026';
const RULES_VERSION = '1.0';

type Severity = 'warn' | '1d' | '3d' | '7d' | '30d' | 'perma';

const severityConfig: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  warn:  { label: 'Uyarı',         color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30' },
  '1d':  { label: '1 Gün Ban',      color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  '3d':  { label: '3 Gün Ban',      color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
  '7d':  { label: '7 Gün Ban',      color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30' },
  '30d': { label: '30 Gün Ban',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30' },
  perma: { label: 'Kalıcı Ban',     color: 'text-red-500',     bg: 'bg-red-600/15',     border: 'border-red-600/40' },
};

interface RuleEntry {
  icon: typeof Gavel;
  title: string;
  description: string;
  firstOffense: Severity;
  repeatOffense: Severity;
}

const RULES: RuleEntry[] = [
  {
    icon: MessageSquareWarning,
    title: 'Küfür / Hakaret',
    description: 'Diğer kullanıcılara doğrudan hakaret, küfür veya aşağılayıcı dil kullanmak.',
    firstOffense: '1d',
    repeatOffense: '7d',
  },
  {
    icon: Megaphone,
    title: 'Spam / Flood',
    description: 'Aynı mesajı tekrar tekrar göndermek, kanal/DM doldurmak, gereksiz mention yapmak.',
    firstOffense: '3d',
    repeatOffense: '7d',
  },
  {
    icon: HeartCrack,
    title: 'Taciz / Zorbalık',
    description: 'Bir kullanıcıyı sürekli rahatsız etmek, tehdit etmek veya psikolojik baskı uygulamak.',
    firstOffense: '7d',
    repeatOffense: '30d',
  },
  {
    icon: Skull,
    title: 'Nefret Söylemi',
    description: 'Irk, din, cinsiyet, etnik köken veya yönelim üzerinden ayrımcı içerik paylaşmak.',
    firstOffense: '30d',
    repeatOffense: 'perma',
  },
  {
    icon: ImageOff,
    title: 'Uygunsuz / NSFW İçerik',
    description: '18+ içerik, şiddet, kan veya rahatsız edici görsel/medya paylaşmak.',
    firstOffense: '7d',
    repeatOffense: '30d',
  },
  {
    icon: EyeOff,
    title: 'Yanlış Bilgi / Manipülasyon',
    description: 'Bilinçli olarak yalan haber yaymak, dolandırıcılık veya phishing girişimi.',
    firstOffense: '3d',
    repeatOffense: 'perma',
  },
  {
    icon: UserX,
    title: 'Sahte Kimlik / Taklit',
    description: 'Başka bir kullanıcıyı, çalışanı veya kuruluşu taklit etmek.',
    firstOffense: '7d',
    repeatOffense: 'perma',
  },
  {
    icon: Bot,
    title: 'Bot / Otomasyon Kötüye Kullanımı',
    description: 'İzinsiz bot, self-bot, raid script veya otomasyon kullanmak.',
    firstOffense: '30d',
    repeatOffense: 'perma',
  },
  {
    icon: Ban,
    title: 'Yasal Olmayan İçerik',
    description: 'Çocuk istismarı, terör, uyuşturucu veya silah ticareti içerikleri (anında ihbar edilir).',
    firstOffense: 'perma',
    repeatOffense: 'perma',
  },
  {
    icon: ShieldAlert,
    title: 'Ban Atlatma / Çoklu Hesap',
    description: 'Banlı bir hesabı atlatmak için yeni hesap açmak veya VPN/proxy kullanarak geri gelmek.',
    firstOffense: 'perma',
    repeatOffense: 'perma',
  },
];

const Rules = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero — solid gradient (no blur blobs to avoid Android WebView GPU banding) */}
      <div
        className="isolate border-b border-border/60"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 80% 0%, rgba(239,68,68,0.18), transparent 60%), radial-gradient(ellipse 70% 50% at 0% 100%, rgba(249,115,22,0.12), transparent 60%), linear-gradient(135deg, rgba(239,68,68,0.06), rgba(249,115,22,0.03) 50%, transparent 100%)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-7 sm:pb-12">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 sm:mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Geri
          </button>

          <div className="flex items-start gap-3 sm:gap-4">
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-red-500/15 ring-1 ring-red-500/30 items-center justify-center shrink-0">
              <Gavel className="w-7 h-7 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                  <Sparkles className="w-3 h-3" /> Sürüm {RULES_VERSION}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-secondary/60 text-foreground/80 border border-border">
                  <Clock className="w-3 h-3" /> {LAST_UPDATED}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-foreground to-orange-400">AuroraChat Kuralları</span>
              </h1>
              <p className="text-[13px] sm:text-sm text-muted-foreground mt-2 sm:mt-3 max-w-2xl leading-relaxed">
                Topluluğumuzun güvenli ve saygılı kalması için aşağıdaki kuralları her kullanıcımızın okuması ve uygulaması beklenir. İhlaller belirlenen yaptırımlarla cezalandırılır.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-10">
        {/* Quick principles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: CheckCircle2, title: 'Saygılı Ol',     desc: 'Her kullanıcıya nezaket' },
            { icon: ShieldAlert,  title: 'Güvenli Tut',    desc: 'Yasalara uygun içerik' },
            { icon: XCircle,      title: 'İhlal = Yaptırım', desc: 'Kademeli ban sistemi' },
          ].map((h) => (
            <div key={h.title} className="rounded-xl border border-border/60 bg-card/40 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <h.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{h.title}</p>
                <p className="text-xs text-muted-foreground">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Process */}
        <section className="rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-2.5">İhlal Durumunda Süreç</h2>
              <ol className="space-y-2 text-sm text-foreground/80 leading-relaxed list-decimal list-inside marker:text-muted-foreground">
                <li><strong>Bildirim:</strong> Kullanıcı veya otomatik sistem ihlali "Bildirilerim" üzerinden raporlar.</li>
                <li><strong>İnceleme:</strong> Moderasyon ekibi raporu inceler (genellikle 24 saat içinde).</li>
                <li><strong>Karar:</strong> İhlal kademesine göre uyarı, sunucu/hesap banı veya kalıcı ban verilir.</li>
                <li><strong>Bildirim:</strong> Yaptırım uygulandığında kullanıcı, açıklamayla birlikte uyarılır.</li>
                <li><strong>İtiraz:</strong> Kullanıcı, banın hatalı olduğunu düşünüyorsa destek e-postasıyla itiraz edebilir.</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Rules table */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
              <ScrollText className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Kural Listesi ve Yaptırımlar</h2>
          </div>

          <div className="space-y-3">
            {RULES.map((rule, idx) => {
              const first = severityConfig[rule.firstOffense];
              const repeat = severityConfig[rule.repeatOffense];
              return (
                <article
                  key={rule.title}
                  className="rounded-2xl border border-border/50 bg-card/40 hover:border-border transition-colors overflow-hidden"
                >
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex flex-col items-center shrink-0 gap-1">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                          <rule.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground/60">#{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground mb-1">{rule.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{rule.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0 sm:items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 w-16 sm:text-right">1. ihlal</span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${first.bg} ${first.color} border ${first.border}`}>
                          <Ban className="w-3 h-3" /> {first.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 w-16 sm:text-right">Tekrar</span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${repeat.bg} ${repeat.color} border ${repeat.border}`}>
                          <Ban className="w-3 h-3" /> {repeat.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Severity legend */}
        <section className="rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-secondary/60 text-foreground/70 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-2.5">Yaptırım Düzeyleri</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(severityConfig) as [Severity, typeof severityConfig[Severity]][]).map(([key, cfg]) => (
                  <div key={key} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border ${cfg.border} ${cfg.bg}`}>
                    <Ban className={`w-3.5 h-3.5 ${cfg.color}`} />
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                Tekrarlanan ihlallerde süreler artırılır. Ağır ihlallerde (yasal olmayan içerik, ban atlatma, çocuk istismarı) doğrudan kalıcı ban uygulanır ve gerekiyorsa yetkili makamlara bildirilir.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-2 border-t border-border/60 flex items-start gap-3 text-xs text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Bu kuralların <strong>{RULES_VERSION}</strong> sürümü <strong>{LAST_UPDATED}</strong> tarihinde yayınlanmıştır. AuroraChat ekibi, kuralları önceden bildirmeksizin güncelleme hakkını saklı tutar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Rules;
