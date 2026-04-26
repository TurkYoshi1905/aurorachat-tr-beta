import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, Users, Shield, Zap, Globe, Mic, ArrowRight, Star, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const features = [
  {
    icon: MessageSquare,
    title: 'Gerçek Zamanlı Mesajlaşma',
    desc: 'Anlık mesaj gönder, dosya paylaş ve emoji reaksiyonları kullan.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Mic,
    title: 'Sesli & Görüntülü Aramalar',
    desc: 'Kristal netliğinde ses kalitesiyle arkadaşlarınla konuş.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  {
    icon: Users,
    title: 'Topluluklar & Sunucular',
    desc: 'Kendi topluluğunu oluştur veya mevcut sunuculara katıl.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: Shield,
    title: 'Güvenlik & Gizlilik',
    desc: 'Verileriniz şifreli ve güvende. Gizlilik ayarlarınızı kontrol edin.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  {
    icon: Zap,
    title: 'Hızlı & Modern',
    desc: 'Son teknoloji altyapı ile gecikme olmadan iletişim kur.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  {
    icon: Globe,
    title: 'Çoklu Dil Desteği',
    desc: 'Türkçe, İngilizce, Rusça ve daha fazlası.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
];

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M+`;
  if (n >= 10_000) return `${Math.floor(n / 1_000)}K+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K+`;
  return n.toLocaleString('tr-TR');
};

interface LiveStats {
  users: number;
  messages: number;
  servers: number;
  loading: boolean;
}

const Landing = () => {
  const navigate = useNavigate();
  const [liveStats, setLiveStats] = useState<LiveStats>({ users: 0, messages: 0, servers: 0, loading: true });

  const fetchStats = async () => {
    const { data, error } = await (supabase.rpc as any)('get_landing_stats');
    if (!error && data) {
      setLiveStats({
        users: data.users ?? 0,
        messages: data.messages ?? 0,
        servers: data.servers ?? 0,
        loading: false,
      });
    } else {
      setLiveStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll every 120 seconds - landing stats don't need frequent refresh
    const interval = setInterval(fetchStats, 120_000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Kayıtlı Kullanıcı', value: liveStats.loading ? null : formatNumber(liveStats.users) },
    { label: 'Toplam Mesaj', value: liveStats.loading ? null : formatNumber(liveStats.messages) },
    { label: 'Sunucu', value: liveStats.loading ? null : formatNumber(liveStats.servers) },
    { label: 'Uptime', value: '99.9%' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Gradient bg effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/6 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-bold tracking-tight">AuroraChat</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
          >
            Giriş Yap
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            Ücretsiz Başla
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 pt-16 pb-24 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold mb-6">
            <Sparkles className="w-3 h-3" />
            Türkiye'nin modern iletişim platformu
            <ChevronRight className="w-3 h-3" />
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            <span className="text-foreground">Konuş, Bağlan,</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              Topluluğunu Oluştur
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            AuroraChat ile arkadaşlarınla gerçek zamanlı mesajlaş, sesli konuş ve topluluklar oluştur.
            Hızlı, güvenli ve ücretsiz.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/25 text-base"
            >
              Hemen Kayıt Ol — Ücretsiz
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-8 py-3.5 bg-secondary/60 text-foreground font-semibold rounded-2xl hover:bg-secondary transition-all border border-border/50 text-base"
            >
              Giriş Yap
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">Kredi kartı gerekmez • Anında başla • Ücretsiz kullan</p>
        </motion.div>
      </section>

      {/* Live Stats */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center p-4 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm relative overflow-hidden group"
            >
              {/* live pulse indicator for dynamic stats */}
              {stat.label !== 'Uptime' && (
                <span className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </span>
              )}
              {stat.value === null ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin my-1" />
              ) : (
                <motion.span
                  key={stat.value}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-extrabold text-primary"
                >
                  {stat.value}
                </motion.span>
              )}
              <span className="text-xs text-muted-foreground mt-1 text-center">{stat.label}</span>
            </div>
          ))}
        </motion.div>
        <p className="text-center text-[11px] text-muted-foreground/50 mt-2 flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
          Veriler gerçek zamanlı olarak Supabase'den çekiliyor
        </p>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Her şey bir arada</h2>
            <p className="text-muted-foreground">İhtiyacın olan tüm iletişim araçları tek bir platformda</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className={`p-5 rounded-2xl border ${f.border} ${f.bg} backdrop-blur-sm`}
              >
                <div className={`w-10 h-10 rounded-xl ${f.bg} border ${f.border} flex items-center justify-center mb-3`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-10 text-center"
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, hsl(var(--primary)), transparent 60%), radial-gradient(circle at 70% 50%, hsl(var(--accent)), transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <h2 className="text-3xl font-bold mb-3">Topluluğumuza Katıl</h2>
            <p className="text-muted-foreground mb-8">
              {liveStats.loading
                ? 'Kullanıcılar zaten AuroraChat kullanıyor. Sen de başla!'
                : `${formatNumber(liveStats.users)} kullanıcı zaten AuroraChat kullanıyor. Sen de başla!`}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/25"
              >
                Ücretsiz Kayıt Ol
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-8 py-3.5 bg-background/50 text-foreground font-semibold rounded-2xl hover:bg-background/80 transition-all border border-border/50 backdrop-blur-sm"
              >
                Zaten hesabım var
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">AuroraChat</span>
            <span>• v0.8.9</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/privacy')} className="hover:text-foreground transition-colors">Gizlilik Politikası</button>
            <button onClick={() => navigate('/changelog')} className="hover:text-foreground transition-colors">Sürüm Notları</button>
            <button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors">Giriş Yap</button>
          </div>
          <span>© 2026 AuroraChat. Tüm hakları saklıdır.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
