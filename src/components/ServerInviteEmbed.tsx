import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n';
import { Users } from 'lucide-react';
import { toast } from 'sonner';

interface ServerInviteEmbedProps { code: string; }

const ServerInviteEmbed = ({ code }: ServerInviteEmbedProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [server, setServer] = useState<{ id: string; name: string; icon: string | null; memberCount: number } | null>(null);
  const [joined, setJoined] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInviteData = async () => {
      const { data: invite } = await supabase.from('server_invites').select('server_id').eq('code', code).maybeSingle();
      const serverId = (invite as any)?.server_id;
      if (!serverId) { setLoading(false); return; }
      const { data: s } = await supabase.from('servers').select('id, name, icon').eq('id', serverId).single();
      // Use RPC to bypass RLS – non-members can't SELECT from server_members directly
      const { data: countData } = await supabase.rpc('get_server_member_count', { p_server_id: serverId });
      const memberCount = (countData as number) ?? 0;
      if (s) setServer({ id: s.id, name: s.name, icon: (s as any).icon, memberCount });
      if (user) {
        const { data: mem } = await supabase.from('server_members').select('id').eq('server_id', serverId).eq('user_id', user.id).maybeSingle();
        if (mem) setJoined(true);
        const { data: ban } = await (supabase.from('server_bans') as any).select('id').eq('server_id', serverId).eq('user_id', user.id).maybeSingle();
        if (ban) setIsBanned(true);
      }
      setLoading(false);
    };
    loadInviteData();
  }, [code, user]);

  if (loading || !server) return null;

  const handleJoin = async () => {
    if (!user || joined || isBanned) return;
    if (isBanned) { toast.error(t('invite.banned')); return; }
    const { error } = await supabase.from('server_members').insert({ server_id: server.id, user_id: user.id });
    if (!error) {
      setJoined(true);
      toast.success(t('invite.joinedSuccess', { name: server.name }));
      window.dispatchEvent(new CustomEvent('aurorachat:server-joined', { detail: { serverId: server.id } }));
    } else toast.error(t('invite.joinError'));
  };

  return (
    <div className="mt-1 rounded-xl border border-border bg-card p-3 max-w-xs">
      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t('invite.serverInvite')}</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground shrink-0">
          {server.icon?.startsWith('http') ? <img src={server.icon} alt="" className="w-full h-full rounded-full object-cover" /> : (server.icon || server.name.charAt(0))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{server.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {server.memberCount}</p>
        </div>
        <button onClick={handleJoin} disabled={joined || isBanned} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${joined ? 'bg-secondary text-muted-foreground' : isBanned ? 'bg-destructive/20 text-destructive cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
          {joined ? t('invite.joined') : isBanned ? t('invite.banned') : t('invite.join')}
        </button>
      </div>
    </div>
  );
};

export default ServerInviteEmbed;