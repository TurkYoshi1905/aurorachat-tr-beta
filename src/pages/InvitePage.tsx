import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n';
import { Users, Sparkles, LogIn, UserPlus, Shield, CheckCircle2 } from 'lucide-react';
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

  useEffect(() => {
    const fetchInvite = async () => {
      if (!code) { setLoading(false); setInvalidCode(true); return; }

      const { data: invite } = await (supabase
        .from('server_invites') as any)
        .select('*, landing_channel_id, servers(id, name, icon_url)')
        .eq('code', code)
        .maybeSingle();

      if (!invite || !invite.servers) {
        setInvalidCode(true);
        setLoading(false);
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        toast.error(t('joinServer.expired'));
        setInvalidCode(true);
        setLoading(false);
        return;
      }
      if (invite.max_uses && invite.uses !== null && invite.uses >= invite.max_uses) {
        toast.error(t('joinServer.maxUses'));
        setInvalidCode(true);
        setLoading(false);
        return;
      }

      const srv = invite.servers as any;
      // Use RPC to bypass RLS – non-members can't SELECT from server_members directly
      const { data: memberCount } = await supabase.rpc('get_server_member_count', { p_server_id: srv.id });

      setServer({ id: srv.id, name: srv.name, icon_url: srv.icon_url, memberCount: (memberCount as number) || 0 });
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

    // Welcome message is handled by SQL trigger (handle_welcome_message_v8)

    setJoined(true);
    toast.success(t('joinServer.joined', { server: server.name }));
    applyLandingChannel();
    setTimeout(() => navigate('/'), 1500);
  };

  const applyLandingChannel = () => {
    if (!user || !server) return;
    const landingId = (invite as any)?.landing_channel_id || null;
    const navKey = `aurorachat_nav_${user.id}`;
    const payload: { serverId: string; channelId?: string } = { serverId: server.id };
    if (landingId) payload.channelId = landingId;
    try { localStorage.setItem(navKey, JSON.stringify(payload)); } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Davet bilgileri alınıyor...</p>
        </div>
      </div>
    );
  }

  if (invalidCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center space-y-4">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card overflow-hidden shadow-xl">
        {/* Gradient header */}
        <div className="h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/25 to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70 bg-primary/10 px-2 py-1 rounded-full">
              {t('invite.serverInvite')}
            </span>
          </div>
          {!server && (
            <div className="absolute top-3 right-3">
              <div className="w-6 h-6 rounded-full bg-card/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary/60" />
              </div>
            </div>
          )}
        </div>

        <div className="px-8 pb-8 -mt-12 space-y-4">
          {/* Server icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl border-4 border-card shadow-lg overflow-hidden bg-secondary flex items-center justify-center">
              {server?.icon_url ? (
                <img
                  src={server.icon_url}
                  alt={server?.name}
                  className="w-full h-full object-cover"
                  data-testid="img-server-icon"
                />
              ) : (
                <span className="text-3xl font-bold text-foreground" data-testid="text-server-initial">
                  {server?.name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>
          </div>

          {/* Server info */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground" data-testid="text-server-name">
              {server?.name ?? 'Sunucu'}
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <Users className="h-3.5 w-3.5" />
              <span data-testid="text-member-count">{server?.memberCount?.toLocaleString('tr-TR') ?? '0'} üye</span>
            </div>
          </div>

          {/* Action area */}
          {!user ? (
            /* Not logged in: show login/register buttons */
            <div className="space-y-2.5 pt-1">
              <p className="text-xs text-muted-foreground text-center">
                Bu sunucuya katılmak için hesabınıza giriş yapın.
              </p>
              <Link
                to={`/login?redirect=/invite/${code}`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
                data-testid="link-login"
              >
                <LogIn className="w-4 h-4" />
                Giriş Yap
              </Link>
              <Link
                to={`/register?redirect=/invite/${code}`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-secondary/50 transition-colors"
                data-testid="link-register"
              >
                <UserPlus className="w-4 h-4" />
                Hesap Oluştur
              </Link>
            </div>
          ) : joined ? (
            /* Joined state */
            <div className="flex flex-col items-center gap-2 py-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-in zoom-in duration-300" />
              <p className="text-sm font-semibold text-emerald-500">Sunucuya katıldınız!</p>
              <p className="text-xs text-muted-foreground">Yönlendiriliyorsunuz...</p>
            </div>
          ) : (
            /* Logged in: join button */
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
              data-testid="button-join-server"
            >
              {joining ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  {t('joinServer.joining')}
                </span>
              ) : (
                t('invite.join')
              )}
            </button>
          )}

          <p className="text-[11px] text-muted-foreground/60 text-center">
            Katılarak topluluk kurallarını kabul etmiş olursunuz.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
