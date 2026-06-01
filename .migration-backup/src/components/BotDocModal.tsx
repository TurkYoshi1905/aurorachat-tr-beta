import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BookOpen, Code2, Variable, Zap, Copy, Check,
  ChevronRight, Bot, Server, Shield, Lightbulb, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

interface BotDocModalProps {
  open: boolean;
  onClose: () => void;
}

type DocTab = 'start' | 'api' | 'variables' | 'examples';

const TABS: { id: DocTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'start',     label: 'Başlarken',   icon: BookOpen },
  { id: 'api',       label: 'API',         icon: Code2 },
  { id: 'variables', label: 'Değişkenler', icon: Variable },
  { id: 'examples',  label: 'Örnekler',   icon: Lightbulb },
];

const CodeBlock = ({ code, language = 'json' }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Kopyalandı!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl bg-black/60 border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <pre className="p-3 text-[12px] font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
      <ChevronRight className="w-3.5 h-3.5 text-primary" />
      {title}
    </h3>
    {children}
  </div>
);

const MultilineText = ({ text }: { text: string }) => (
  <span>
    {text.split('\n').map((line, i, arr) => (
      <span key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </span>
    ))}
  </span>
);

const StartContent = () => (
  <div className="space-y-6 text-sm">
    <div className="rounded-xl bg-primary/8 border border-primary/20 p-4 flex gap-3">
      <Bot className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-foreground mb-1">AuroraChat Bot Sistemi</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          AuroraChat botları sunuculara eklenebilen, slash komutlara yanıt veren ve özel davranışlar sergileyebilen uygulamalardır.
        </p>
      </div>
    </div>

    <Section title="1. Bot Oluştur">
      <ol className="space-y-3 text-muted-foreground text-xs leading-relaxed">
        <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">1</span><span><strong className="text-foreground">Bot Geliştirici Merkezi'ne</strong> git ve <strong className="text-foreground">Yeni Bot</strong> butonuna tıkla.</span></li>
        <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">2</span><span>Bot adı, kullanıcı adı ve açıklamasını gir. İsteğe bağlı avatar yükle.</span></li>
        <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">3</span><span><strong className="text-foreground">Token</strong> sekmesinden bot tokenını kopyala — bu tokenı gizli tut.</span></li>
        <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">4</span><span><strong className="text-foreground">Sunucular</strong> sekmesinden botunu sunucularına ekle.</span></li>
        <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">5</span><span><strong className="text-foreground">Komutlar</strong> sekmesinden özel slash komutları tanımla ve değişken kullan.</span></li>
      </ol>
    </Section>

    <Section title="2. Botunu Yapılandır">
      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>Bot oluşturduktan sonra aşağıdaki sekmelere erişebilirsin:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Bot,           label: 'Genel',       desc: 'Ad, açıklama, avatar' },
            { icon: Shield,        label: 'Token',       desc: 'Gizli bot tokenı' },
            { icon: Server,        label: 'Sunucular',   desc: 'Sunuculara ekle/çıkar' },
            { icon: Code2,         label: 'Kod',         desc: 'Bot mantığı (gelecek)' },
            { icon: Variable,      label: 'Değişkenler', desc: 'Dinamik yanıt değişkenleri' },
            { icon: MessageSquare, label: 'Herkese Açık', desc: 'Bot keşif mağazası' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-lg bg-secondary/40 p-2.5 flex gap-2">
              <Icon className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground text-[11px]">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  </div>
);

const ApiContent = () => (
  <div className="space-y-6 text-sm">
    <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3 text-xs text-amber-400 flex gap-2">
      <Zap className="w-4 h-4 shrink-0 mt-0.5" />
      <span>Bot API'si şu anda geliştirme aşamasındadır. Aşağıdaki bilgiler yaklaşan REST API için tasarım belgesidir.</span>
    </div>

    <Section title="Kimlik Doğrulama">
      <p className="text-xs text-muted-foreground mb-2">Tüm isteklerde <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">Authorization</code> başlığı gereklidir:</p>
      <CodeBlock language="http" code={`GET /api/v1/bot/me HTTP/1.1\nHost: api.aurorachat.app\nAuthorization: Bot YOUR_BOT_TOKEN`} />
    </Section>

    <Section title="Bot Bilgisi Al">
      <CodeBlock language="json" code={`// GET /api/v1/bot/me\n{\n  "id": "550e8400-e29b-41d4-a716-446655440000",\n  "name": "Benim Botum",\n  "username": "benim_botum",\n  "description": "Açıklama",\n  "is_public": false,\n  "created_at": "2026-05-16T00:00:00Z"\n}`} />
    </Section>

    <Section title="Mesaj Gönder">
      <CodeBlock language="json" code={`// POST /api/v1/bot/messages\n{\n  "channel_id": "kanal-id-buraya",\n  "content": "Merhaba, ben bir botum!"\n}\n\n// Başarılı yanıt:\n{\n  "id": "mesaj-id",\n  "content": "Merhaba, ben bir botum!",\n  "created_at": "2026-05-16T12:00:00Z"\n}`} />
    </Section>

    <Section title="Hata Kodları">
      <div className="space-y-1.5 text-xs">
        {[
          { code: '401', desc: 'Geçersiz veya eksik token' },
          { code: '403', desc: 'Sunucuya erişim izni yok' },
          { code: '404', desc: 'Kaynak bulunamadı' },
          { code: '429', desc: 'Rate limit aşıldı (6 istek/sn)' },
        ].map(({ code, desc }) => (
          <div key={code} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2">
            <code className="text-red-400 font-mono font-bold w-8">{code}</code>
            <span className="text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>
    </Section>
  </div>
);

interface VarRow {
  var: string;
  desc: string;
  example: string;
  category: string;
}

const ALL_VARIABLES: VarRow[] = [
  { var: '{user}',         desc: 'Komutu kullanan kullanıcının görünen adı (mention stilinde)',   example: '@AhmetYılmaz',     category: 'Genel' },
  { var: '{username}',     desc: 'Kullanıcı adı (@ işareti olmadan)',                            example: 'ahmetyilmaz',      category: 'Genel' },
  { var: '{userId}',       desc: 'Kullanıcının benzersiz sistem kimliği (UUID)',                  example: 'a1b2c3d4-...',     category: 'Genel' },
  { var: '{time}',         desc: 'Şu anki saat — SS:dd formatında',                             example: '14:30',            category: 'Genel' },
  { var: '{date}',         desc: 'Bugünün tarihi — GG.AA.YYYY formatında',                      example: '22.05.2026',       category: 'Genel' },
  { var: '{dayOfWeek}',    desc: 'Haftanın günü (Türkçe)',                                       example: 'Cuma',             category: 'Genel' },
  { var: '{greeting}',     desc: 'Saate göre otomatik selamlama',                               example: 'İyi akşamlar',     category: 'Genel' },

  { var: '{serverName}',   desc: 'Sunucunun tam adı',                                           example: 'AuroraChat Beta',  category: 'Sunucu' },
  { var: '{memberCount}',  desc: 'Sunucudaki toplam kayıtlı üye sayısı',                        example: '142',              category: 'Sunucu' },
  { var: '{onlineCount}',  desc: 'Şu anda çevrimiçi olan üye sayısı',                           example: '37',               category: 'Sunucu' },
  { var: '{channelName}',  desc: 'Komutun yazıldığı kanalın adı',                               example: 'genel',            category: 'Sunucu' },
  { var: '{serverId}',     desc: 'Sunucunun benzersiz kimliği (UUID)',                           example: 'f1e2d3c4-...',     category: 'Sunucu' },
  { var: '{serverAge}',    desc: 'Sunucunun kurulduğundan bu yana geçen gün sayısı',             example: '120 gün',          category: 'Sunucu' },

  { var: '{randomNumber}', desc: 'Rastgele bir tam sayı (1 ile 100 arasında)',                  example: '42',               category: 'Eğlence' },
  { var: '{randomEmoji}',  desc: 'Listeden rastgele seçilen bir emoji',                         example: '🎉',               category: 'Eğlence' },
  { var: '{roll}',         desc: 'Zar at — 1 ile 6 arasında rastgele sayı döner',              example: '4',                category: 'Eğlence' },
  { var: '{coinflip}',     desc: 'Yazı/Tura — "Yazı" veya "Tura" döner',                       example: 'Tura',             category: 'Eğlence' },
  { var: '{8ball}',        desc: 'Sihirli 8 top yanıtı (rastgele evet/hayır/belki)',            example: 'Evet, kesinlikle!', category: 'Eğlence' },
  { var: '{lucky}',        desc: 'Günlük şans puanı (1-100 arası)',                             example: '73',               category: 'Eğlence' },

  { var: '{botName}',     desc: 'Bu botun görünen adı',                                         example: 'AuroraBot',        category: 'Bot' },
  { var: '{botUsername}', desc: 'Bu botun kullanıcı adı',                                       example: 'aurorabot',        category: 'Bot' },
  { var: '{botVersion}',  desc: 'AuroraChat platform sürümü',                                   example: 'v1.2.3',           category: 'Bot' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Genel':   { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  'Sunucu':  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Eğlence': { bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  'Bot':     { bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20' },
};

const VariablesContent = () => {
  const categories = ['Genel', 'Sunucu', 'Eğlence', 'Bot'];
  return (
    <div className="space-y-6 text-sm">
      <div className="rounded-xl bg-primary/8 border border-primary/20 p-3 text-xs text-muted-foreground">
        Komut yanıtlarında bu değişkenleri kullanabilirsin. Değişkenler gönderim anında otomatik gerçek veriye dönüştürülür.
      </div>
      {categories.map(cat => {
        const vars = ALL_VARIABLES.filter(v => v.category === cat);
        const cc = CATEGORY_COLORS[cat] || { bg: 'bg-secondary/30', text: 'text-foreground', border: 'border-border/40' };
        return (
          <Section key={cat} title={`${cat} Değişkenleri`}>
            <div className="space-y-2">
              {vars.map(({ var: v, desc, example }) => (
                <div key={v} className={`rounded-xl ${cc.bg} border ${cc.border} p-3`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <code className={`text-sm font-mono font-bold ${cc.text}`}>{v}</code>
                    <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full font-mono">→ {example}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <MultilineText text={desc} />
                  </p>
                </div>
              ))}
            </div>
          </Section>
        );
      })}
      <Section title="Kullanım Örneği">
        <CodeBlock language="text" code={`Giriş: "{greeting} {user}! {serverName} sunucusuna\nhoş geldin! Şu an {onlineCount}/{memberCount} üye çevrimiçi."\n\nÇıktı: "İyi akşamlar @AhmetYılmaz! AuroraChat Beta\nsunucusuna hoş geldin! Şu an 37/142 üye çevrimiçi."`} />
      </Section>
    </div>
  );
};

const ExamplesContent = () => (
  <div className="space-y-6 text-sm">
    <Section title="Hazır Komut Şablonları">
      <p className="text-xs text-muted-foreground mb-3">Kopyala-yapıştır yapmaya hazır komut örnekleri:</p>
      <div className="space-y-4">
        {[
          {
            name: '🎉 Hoş Geldin Botu',
            commands: [
              { trigger: 'merhaba', response: '{greeting} {user}! {serverName} sunucusuna hoş geldin 🎉\nArамızdaki {memberCount} üyeyle iyi eğlenceler!\nŞu an {onlineCount} kişi çevrimiçi.' },
              { trigger: 'selamla', response: 'Selam {username}! Nasılsın? 😊\n{serverName}\'da harika vakit geçiriyoruz!' },
            ],
          },
          {
            name: '📊 Sunucu Info Botu',
            commands: [
              { trigger: 'sunucu', response: '🏠 Sunucu: {serverName}\n👥 Toplam Üye: {memberCount}\n🟢 Çevrimiçi: {onlineCount}\n📅 Bugün: {date}' },
              { trigger: 'kanal',  response: '#{channelName} kanalındasın!\nSunucu: {serverName} ({memberCount} üye)' },
            ],
          },
          {
            name: '🎲 Eğlence Botu',
            commands: [
              { trigger: 'zar',     response: '🎲 {user} zar attı: **{roll}**\nŞansın bugün: {lucky}/100' },
              { trigger: 'yaztura', response: '🪙 {user} para attı: **{coinflip}**!' },
              { trigger: '8top',    response: '🎱 {user} sordu, 8-top cevapladı:\n"{8ball}"' },
            ],
          },
          {
            name: '⏰ Zaman & Tarih Botu',
            commands: [
              { trigger: 'saat', response: '🕐 Şu anki saat: {time}\n📅 Bugün: {date} ({dayOfWeek})' },
              { trigger: 'bugun', response: '📅 Bugün {dayOfWeek}, {date}\nSunucumuz {serverAge} gündür aktif!' },
            ],
          },
        ].map(({ name, commands }) => (
          <div key={name} className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="px-3 py-2 bg-secondary/30 border-b border-border/40">
              <p className="text-xs font-bold text-foreground">{name}</p>
            </div>
            <div className="p-2 space-y-1.5">
              {commands.map(({ trigger, response }) => (
                <div key={trigger} className="rounded-lg bg-secondary/20 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1 mb-1">
                    <code className="text-primary font-mono font-bold">/{trigger}</code>
                  </div>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{response}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  </div>
);

const CONTENT: Record<DocTab, React.ReactNode> = {
  start:     <StartContent />,
  api:       <ApiContent />,
  variables: <VariablesContent />,
  examples:  <ExamplesContent />,
};

const BotDocModal = ({ open, onClose }: BotDocModalProps) => {
  const [activeTab, setActiveTab] = useState<DocTab>('start');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col" style={{ height: 'min(90vh, 720px)' }}>
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-base">
              <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <BookOpen className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <span className="font-bold text-foreground">Bot Geliştirici Dokümantasyonu</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">AuroraChat Bot API v1 · v1.2.3</p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex gap-0.5 px-3 py-2 bg-secondary/20 border-b border-border shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5">
            {CONTENT[activeTab]}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-secondary/10 shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">AuroraChat Bot API · Geliştirici önizlemesi</p>
          <Button size="sm" onClick={onClose} variant="outline">Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BotDocModal;
