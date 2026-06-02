import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n';
import { Users, Sparkles, LogIn, UserPlus, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const InvitePage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [server, setServer] = useState<{ id: string; name: string; icon_url: string | null; memberCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false);
  const [invite, setInvite] = useState<any>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!code) { setLoading(false); setInvalidCode(true); return; }

      const { data: inviteData } = await (supabase
        .from('server_invites') as any)
        .select('*, landing_channel_id, servers(id, name, icon, icon_url)')
        .eq('code', code)
        .maybeSingle();

      if (!inviteData || !inviteData.servers) {
        setInvalidCode(true);
        setLoading(false);
        return;
      }

      if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
        toast.error(t('joinServer.expired'));
        setInvalidCode(true);
        setLoading(false);
        return;
      }
      if (inviteData.max_uses && inviteData.uses !== null && inviteData.uses >= inviteData.max_uses) {
        toast.error(t('joinServer.maxUses'));
        setInvalidCode(true);
        setLoading(false);
        return;
      }

      const srv = inviteData.servers as any;
      const { data: memberCount } = await supabase.rpc('get_server_member_count', { p_server_id: srv.id });

      setInvite(inviteData);
      const iconUrl = srv.icon || srv.icon_url || null;
      setServer({ id: srv.id, name: srv.name, icon_url: iconUrl, memberCount: (memberCount as number) || 0 });
      setLoading(false);
    };
    fetchInvite();
  }, [code]);

  const handleJoin = async () => {
    if (!user) { navigate(`/login?redirect=/invite/${code}`); return; }
    if (!server) return;
    setJoining(true);

    const { data: existing } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', server.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      toast.info(t('joinServer.alreadyMember'));
      applyLandingChannel();
      navigate('/');
      return;
    }

    const { data: banRecord } = await (supabase.from('server_bans') as any)
      .select('id')
      .eq('server_id', server.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (banRecord) {
      toast.error('Bu sunucudan yasaklandınız. Bu sunucuya katılamazsınız.');
      setJoining(false);
      return;
    }

    const { error } = await supabase.from('server_members').insert({ server_id: server.id, user_id: user.id });
    if (error) {
      toast.error(t('joinServer.joinError'));
      setJoining(false);
      return;
    }

    setJoined(true);
    toast.success(t('joinServer.joined', { server: server.name }));
    applyLandingChannel();
    setTimeout(() => navigate('/'), 1500);
  };

  const applyLandingChannel = () => {
    if (!user || !server) return;
    const landingId = invite?.landing_channel_id || null;
    const navKey = `aurorachat_nav_${user.id}`;
    const payload: { serverId: string; channelId?: string } = { serverId: server.id };
    if (landingId) payload.channelId = landingId;
    try { localStorage.setItem(navKey, JSON.stringify(payload)); } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Davet bilgileri alınıyor...</p>
        </div>
      </div>
    );
  }

  if (invalidCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          {/* Invalid code card */}
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">{t('joinServer.invalidCode')}</h2>
              <p className="text-sm text-muted-foreground">Bu davet bağlantısı geçersiz veya süresi dolmuş.</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              {t('nav.home')}
            </button>
          </div>

          {/* Register CTA for unauthenticated */}
          {!user && (
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-1">AuroraChat'e Katıl</h3>
                <p className="text-xs text-muted-foreground">Hesap oluştur, arkadaşlarınla sohbet et ve sunuculara katıl.</p>
              </div>
              <Link
                to="/register"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
              >
                <UserPlus className="w-4 h-4" />
                Ücretsiz Hesap Oluştur
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Link>
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-secondary/50 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Zaten hesabın var mı? Giriş Yap
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Main invite card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
          {/* Header: server icon as blurred background or dark gradient */}
          <div className="h-28 relative overflow-hidden bg-gradient-to-br from-card via-secondary/60 to-card">
            {server?.icon_url && (
              <img
                src={server.icon_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110 blur-md"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/80" />
            <div className="absolute top-3 left-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/15 backdrop-blur-sm px-2.5 py-1 rounded-full border border-primary/25">
                {t('invite.serverInvite')}
              </span>
            </div>
            <div className="absolute top-3 right-3">
              <div className="w-7 h-7 rounded-full bg-background/30 backdrop-blur-sm flex items-center justify-center border border-border/40">
                <Sparkles className="w-3.5 h-3.5 text-primary/70" />
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 -mt-12 space-y-5">
            {/* Server icon */}
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-2xl border-4 border-card shadow-2xl overflow-hidden bg-secondary flex items-center justify-center ring-2 ring-primary/30">
                {server?.icon_url ? (
                  <img src={server.icon_url} alt={server?.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-foreground">{server?.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
                )}
              </div>
            </div>

            {/* Server info */}
            <div className="text-center space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Davetlisiniz</p>
              <h1 className="text-2xl font-black text-foreground leading-tight">
                {server?.name ?? 'Sunucu'} <span className="text-primary">Sunucusuna</span> Katılın
              </h1>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  <span className="text-emerald-500 font-medium">{server?.memberCount?.toLocaleString('tr-TR') ?? '0'}</span>
                  <Users className="h-3.5 w-3.5" />
                  <span>üye</span>
                </span>
              </div>
            </div>

            {/* Action area */}
            {!user ? (
              <div className="space-y-2.5 pt-1">
                <p className="text-xs text-muted-foreground text-center">
                  <strong className="text-foreground">{server?.name}</strong> sunucusuna katılmak için hesabınıza giriş yapın.
                </p>
                <Link
                  to={`/register?redirect=/invite/${code}`}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/25"
                >
                  <UserPlus className="w-4 h-4" />
                  Ücretsiz Hesap Oluştur
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Link>
                <Link
                  to={`/login?redirect=/invite/${code}`}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-secondary/50 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Zaten hesabın var mı? Giriş Yap
                </Link>
              </div>
            ) : joined ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 animate-in zoom-in duration-300" />
                </div>
                <p className="text-sm font-bold text-emerald-500">Sunucuya katıldınız!</p>
                <p className="text-xs text-muted-foreground">Yönlendiriliyorsunuz...</p>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
              >
                {joining ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    {t('joinServer.joining')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {t('invite.join')}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            )}

            <p className="text-[11px] text-muted-foreground/50 text-center">
              Katılarak topluluk kurallarını kabul etmiş olursunuz.
            </p>
          </div>
        </div>

        {/* Register CTA below card if not logged in */}
        {!user && !joined && (
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              AuroraChat yeni mi?{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Ücretsiz hesap oluştur
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
