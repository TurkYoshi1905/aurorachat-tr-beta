import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BookOpen, Code2, Terminal, Zap, Variable, Copy, Check,
  ChevronRight, Bot, Server, MessageSquare, Shield, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';

interface BotDocModalProps {
  open: boolean;
  onClose: () => void;
}

type DocTab = 'start' | 'api' | 'commands' | 'variables' | 'examples';

const TABS: { id: DocTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'start',     label: 'Başlarken',    icon: BookOpen },
  { id: 'api',       label: 'API',          icon: Code2 },
  { id: 'commands',  label: 'Komutlar',     icon: Terminal },
  { id: 'variables', label: 'Değişkenler',  icon: Variable },
  { id: 'examples',  label: 'Örnekler',     icon: Lightbulb },
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

const Badge = ({ children, color = 'primary' }: { children: React.ReactNode; color?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-${color}/15 text-${color} border border-${color}/25`}>
    {children}
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
        <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">5</span><span><strong className="text-foreground">Komutlar</strong> sekmesinden özel slash komutları tanımla.</span></li>
      </ol>
    </Section>

    <Section title="2. Botunu Yapılandır">
      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>Bot oluşturduktan sonra aşağıdaki sekmelere erişebilirsin:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Bot,         label: 'Genel',       desc: 'Ad, açıklama, avatar' },
            { icon: Shield,      label: 'Token',       desc: 'Gizli bot tokenı' },
            { icon: Server,      label: 'Sunucular',   desc: 'Sunuculara ekle/çıkar' },
            { icon: Code2,       label: 'Kod',         desc: 'Bot mantığı (gelecek)' },
            { icon: Terminal,    label: 'Komutlar',    desc: 'Slash komut tanımları' },
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

const CommandsContent = () => (
  <div className="space-y-6 text-sm">
    <Section title="Slash Komut Sistemi">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Botuna özel slash komutları ekleyerek kullanıcıların <code className="text-primary bg-primary/10 px-1 rounded">/komut_adı</code> yazmasıyla tetiklenecek yanıtlar tanımlayabilirsin.
      </p>
    </Section>

    <Section title="Komut Alanları">
      <div className="space-y-2">
        {[
          { field: 'Tetikleyici (/)',  desc: 'Slash işareti otomatik eklenir. Örn: yardim → /yardim',      example: 'yardim' },
          { field: 'Ad',               desc: 'Komutun görünen adı (slash popup\'ta görünür)',              example: 'Yardım Komutu' },
          { field: 'Açıklama',         desc: 'Komutun ne yaptığını açıklar',                              example: 'Botla ilgili yardım bilgisi gösterir' },
          { field: 'Yanıt',            desc: 'Komut tetiklendiğinde gönderilecek mesaj (değişken destekli)', example: 'Merhaba {user}! Nasıl yardımcı olabilirim?' },
        ].map(({ field, desc, example }) => (
          <div key={field} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{field}</code>
            </div>
            <p className="text-[11px] text-muted-foreground">{desc}</p>
            <p className="text-[10px] text-foreground/60 mt-1">Örn: <em className="text-foreground/80">{example}</em></p>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Komut Yanıt Örneği">
      <CodeBlock language="text" code={`/merhaba → Merhaba {user}! AuroraChat'e hoş geldin! 🎉\n/sunucu  → Şu anda {serverName} sunucusundasın ({memberCount} üye)\n/ben     → Adın: {username}`} />
    </Section>
  </div>
);

const VariablesContent = () => (
  <div className="space-y-6 text-sm">
    <Section title="Kullanılabilir Değişkenler">
      <p className="text-xs text-muted-foreground mb-3">Komut yanıtlarında bu değişkenleri kullanabilirsin. Değişkenler gönderim anında otomatik değerle değiştirilir.</p>
      <div className="space-y-2">
        {[
          { var: '{user}',        desc: 'Komutu kullanan kullanıcının etiket adı (mention)',    example: '@AhmetYılmaz' },
          { var: '{username}',    desc: 'Kullanıcı adı (@ işareti olmadan)',                    example: 'ahmetyilmaz' },
          { var: '{memberCount}', desc: 'Sunucudaki toplam üye sayısı',                         example: '142' },
          { var: '{serverName}',  desc: 'Botun bulunduğu sunucunun adı',                        example: 'AuroraChat Beta' },
        ].map(({ var: v, desc, example }) => (
          <div key={v} className="rounded-xl bg-secondary/30 border border-border/40 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <code className="text-sm font-mono font-bold text-primary">{v}</code>
              <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full font-mono">→ {example}</span>
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Kullanım Örneği">
      <CodeBlock language="text" code={`Giriş: "{user} hoş geldin! {serverName} sunucusunda\nşu an {memberCount} üye var."\n\nÇıktı: "@AhmetYılmaz hoş geldin! AuroraChat Beta\nsunucusunda şu an 142 üye var."`} />
    </Section>
  </div>
);

const ExamplesContent = () => (
  <div className="space-y-6 text-sm">
    <Section title="Hazır Komut Şablonları">
      <p className="text-xs text-muted-foreground mb-3">Kopyala-yapıştır yapmaya hazır komut örnekleri:</p>
      <div className="space-y-4">
        {[
          {
            name: '🎉 Hoş Geldin Botu',
            commands: [
              { trigger: 'merhaba', response: 'Merhaba {user}! {serverName} sunucusuna hoş geldin 🎉 Aramızdaki {memberCount} üyeyle iyi eğlenceler!' },
              { trigger: 'selamla', response: 'Selam {username}! Nasılsın? 😊' },
            ],
          },
          {
            name: '📊 Sunucu Info Botu',
            commands: [
              { trigger: 'sunucu',  response: '🏠 Sunucu: {serverName}\n👥 Üye Sayısı: {memberCount}' },
              { trigger: 'uye',     response: '{serverName} sunucusunda toplam {memberCount} üye bulunuyor.' },
            ],
          },
          {
            name: '🎲 Eğlence Botu',
            commands: [
              { trigger: 'sarsi',   response: 'Şansın: {username} için yüksek! 🍀' },
              { trigger: 'siralama', response: '{serverName} liderlik tablosu yakında! 🏆' },
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
                  <p className="text-muted-foreground leading-relaxed">{response}</p>
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
  commands:  <CommandsContent />,
  variables: <VariablesContent />,
  examples:  <ExamplesContent />,
};

const BotDocModal = ({ open, onClose }: BotDocModalProps) => {
  const [activeTab, setActiveTab] = useState<DocTab>('start');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col" style={{ height: 'min(90vh, 720px)' }}>
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-base">
              <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <BookOpen className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <span className="font-bold text-foreground">Bot Geliştirici Dokümantasyonu</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">AuroraChat Bot API v1</p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Tabs */}
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

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5">
            {CONTENT[activeTab]}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-secondary/10 shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">AuroraChat Bot API · Geliştirici önizlemesi</p>
          <Button size="sm" onClick={onClose} variant="outline">Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BotDocModal;
