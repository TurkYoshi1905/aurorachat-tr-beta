import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n';
import { toast } from 'sonner';

interface ServerInviteEmbedProps { code: string; }

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const formatCreatedAt = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
};

const fetchOnlineCountFromDB = async (serverId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('get_server_online_count', { p_server_id: serverId });
  if (error) {
    // Fallback: two-step query if RPC not yet deployed
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: members } = await supabase.from('server_members').select('user_id').eq('server_id', serverId);
    if (!members || members.length === 0) return 0;
    const userIds = members.map((m: any) => m.user_id);
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).in('id', userIds).neq('status', 'offline').gte('last_seen', fiveMinAgo);
    return count || 0;
  }
  return (data as number) || 0;
};

const ServerInviteEmbed = ({ code }: ServerInviteEmbedProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [server, setServer] = useState<{
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
    onlineCount: number;
    createdAt: string;
  } | null>(null);
  const [joined, setJoined] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const serverIdRef = useRef<string | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const memberChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: invite } = await supabase
        .from('server_invites')
        .select('server_id')
        .eq('code', code)
        .maybeSingle();
      const serverId = (invite as any)?.server_id;
      if (!serverId || cancelled) { setLoading(false); return; }
      serverIdRef.current = serverId;

      const fetchMemberCount = async () => {
        const { data: countData, error } = await supabase.rpc('get_server_member_count', { p_server_id: serverId });
        if (!error && !cancelled) {
          setServer(prev => prev ? { ...prev, memberCount: typeof countData === 'number' ? countData : 0 } : prev);
        }
      };

      const [{ data: s }, { data: countData }] = await Promise.all([
        supabase.from('servers').select('id, name, icon, icon_url, created_at').eq('id', serverId).single(),
        supabase.rpc('get_server_member_count', { p_server_id: serverId }),
      ]);

      if (cancelled) return;

      if (s) {
        setServer({
          id: s.id,
          name: s.name,
          icon: (s as any).icon || (s as any).icon_url || null,
          memberCount: typeof countData === 'number' ? countData : 0,
          onlineCount: 0,
          createdAt: (s as any).created_at || '',
        });
      }

      if (user) {
        const [{ data: mem }, { data: ban }] = await Promise.all([
          supabase.from('server_members').select('id').eq('server_id', serverId).eq('user_id', user.id).maybeSingle(),
          (supabase.from('server_bans') as any).select('id').eq('server_id', serverId).eq('user_id', user.id).maybeSingle(),
        ]);
        if (!cancelled) {
          if (mem) setJoined(true);
          if (ban) setIsBanned(true);
        }
      }

      if (!cancelled) setLoading(false);

      const refreshOnlineCount = async () => {
        if (cancelled) return;
        const online = await fetchOnlineCountFromDB(serverId);
        if (!cancelled) setServer(prev => prev ? { ...prev, onlineCount: online } : prev);
      };

      await refreshOnlineCount();

      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
      const ch = supabase
        .channel(`invite-presence-${serverId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `status=neq.deleted` }, () => {
          refreshOnlineCount();
        })
        .subscribe();

      presenceChannelRef.current = ch;

      if (memberChannelRef.current) supabase.removeChannel(memberChannelRef.current);
      const memberCh = supabase
        .channel(`invite-member-count-${serverId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'server_members', filter: `server_id=eq.${serverId}` }, async (payload: any) => {
          await fetchMemberCount();
          if (user?.id) {
            const changedUserId = payload.new?.user_id || payload.old?.user_id;
            if (changedUserId === user.id) setJoined(payload.eventType !== 'DELETE');
          }
        })
        .subscribe();
      memberChannelRef.current = memberCh;
    };

    load();

    return () => {
      cancelled = true;
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      if (memberChannelRef.current) {
        supabase.removeChannel(memberChannelRef.current);
        memberChannelRef.current = null;
      }
    };
  }, [code, user]);

  if (loading || !server) return null;

  const handleJoin = async () => {
    if (!user || joined || isBanned || joining) return;
    setJoining(true);
    const { error } = await supabase
      .from('server_members')
      .insert({ server_id: server.id, user_id: user.id });
    if (!error) {
      setJoined(true);
      toast.success(t('invite.joinedSuccess', { name: server.name }));
      window.dispatchEvent(new CustomEvent('aurorachat:server-joined', { detail: { serverId: server.id } }));
    } else {
      toast.error(t('invite.joinError'));
    }
    setJoining(false);
  };

  const handleNavigate = () => {
    window.dispatchEvent(new CustomEvent('aurorachat:navigate-to-server', { detail: { serverId: server.id } }));
  };

  const hasIcon = !!server.icon;

  return (
    <div
      className="mt-1.5 rounded-xl border border-white/5 overflow-hidden"
      style={{ maxWidth: '300px', backgroundColor: 'hsl(var(--card))' }}
    >
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
          Sunucu Daveti
        </p>
      </div>

      <div className="px-4 pb-1 flex items-center gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-2xl overflow-hidden border border-white/10"
          style={{ width: '50px', height: '50px', backgroundColor: 'hsl(var(--secondary))' }}
        >
          {hasIcon && server.icon!.startsWith('http') ? (
            <img src={server.icon!} alt={server.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-foreground">
              {server.icon || server.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate leading-tight">{server.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 shrink-0" />
              {server.onlineCount} Çevrim içi
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/60 shrink-0" />
              {server.memberCount} Üye
            </span>
          </div>
          {server.createdAt && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Oluşturulma: {formatCreatedAt(server.createdAt)}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {isBanned ? (
          <div className="w-full py-2 px-3 rounded-lg text-center text-xs font-semibold bg-destructive/20 text-destructive">
            Sunucudan yasaklandınız
          </div>
        ) : joined ? (
          <button
            onClick={handleNavigate}
            className="w-full py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{ backgroundColor: '#248046', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a6b38')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#248046')}
          >
            Sunucuya git
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-60"
            style={{ backgroundColor: '#248046', color: '#fff' }}
            onMouseEnter={e => { if (!joining) e.currentTarget.style.backgroundColor = '#1a6b38'; }}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#248046')}
          >
            {joining ? 'Katılınıyor...' : 'Sunucuya Katıl'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ServerInviteEmbed;
