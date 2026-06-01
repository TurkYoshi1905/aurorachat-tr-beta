import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, RefreshCw, Settings, Search, ArrowLeft, Hash, Volume2, MapPin } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface InviteDialogProps { open: boolean; onOpenChange: (open: boolean) => void; serverId: string; serverName: string; }

interface Friend { userId: string; displayName: string; username: string; avatarUrl: string | null; }

interface ChannelOpt { id: string; name: string; type: 'text' | 'voice' | string; }

const EXPIRE_OPTIONS = [
  { value: '1800', label: '30 dakika' },
  { value: '3600', label: '1 saat' },
  { value: '21600', label: '6 saat' },
  { value: '43200', label: '12 saat' },
  { value: '86400', label: '1 gün' },
  { value: '604800', label: '7 gün' },
  { value: 'never', label: 'Asla' },
];

const MAX_USES_OPTIONS = [
  { value: '0', label: 'Sınırsız' },
  { value: '1', label: '1 kullanım' },
  { value: '5', label: '5 kullanım' },
  { value: '10', label: '10 kullanım' },
  { value: '25', label: '25 kullanım' },
  { value: '50', label: '50 kullanım' },
  { value: '100', label: '100 kullanım' },
];

const InviteDialog = ({ open, onOpenChange, serverId, serverName }: InviteDialogProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [expireSeconds, setExpireSeconds] = useState('604800');
  const [maxUses, setMaxUses] = useState('0');
  const [channels, setChannels] = useState<ChannelOpt[]>([]);
  const [landingChannelId, setLandingChannelId] = useState<string>('default');

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const createInvite = useCallback(async (expire: string, max: string) => {
    if (!user) return '';
    setLoading(true);
    const code = generateCode();
    const expiresAt = expire === 'never' ? null : new Date(Date.now() + parseInt(expire) * 1000).toISOString();
    const maxUsesVal = parseInt(max) || null;
    const insertPayload: any = {
      server_id: serverId, code, created_by: user.id,
      expires_at: expiresAt, max_uses: maxUsesVal,
    };
    if (landingChannelId && landingChannelId !== 'default') {
      insertPayload.landing_channel_id = landingChannelId;
    }
    const { error } = await supabase.from('server_invites').insert(insertPayload);
    setLoading(false);
    if (error) { toast.error(t('invite.createFailed')); return ''; }
    return code;
  }, [user, serverId, t, landingChannelId]);

  const fetchChannels = async () => {
    const { data } = await supabase.from('channels').select('id, name, type').eq('server_id', serverId).order('position', { ascending: true });
    if (data) setChannels(data as any);
  };

  const fetchOrCreateInvite = async () => {
    if (!user) return;
    setLoading(true);
    const { data: existing } = await (supabase.from('server_invites') as any).select('code, landing_channel_id')
      .eq('server_id', serverId).eq('created_by', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      setInviteCode(existing.code);
      if (existing.landing_channel_id) setLandingChannelId(existing.landing_channel_id);
      setLoading(false);
      return;
    }
    const code = await createInvite(expireSeconds, maxUses);
    if (code) setInviteCode(code);
  };

  const fetchFriends = async () => {
    if (!user) return;
    // friends table uses user_id and friend_id columns
    const { data: friendships } = await supabase.from('friends').select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');
    if (!friendships || friendships.length === 0) return;
    const friendIds = friendships.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
    // profiles PK is 'id', not 'user_id'
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', friendIds);
    if (profiles) {
      setFriends(profiles.map(p => ({
        userId: p.id, displayName: (p as any).display_name || p.username, username: p.username, avatarUrl: p.avatar_url,
      })));
    }
  };

  useEffect(() => {
    if (open) {
      fetchOrCreateInvite();
      fetchFriends();
      fetchChannels();
      setView('main');
      setSearchQuery('');
      setInvitedUsers(new Set());
    }
  }, [open]);

  const inviteLink = `${window.location.origin}/invite/${inviteCode}`;
  const handleCopy = () => { navigator.clipboard.writeText(inviteLink); toast.success(t('invite.copied')); };

  const handleNewCode = async () => {
    const code = await createInvite(expireSeconds, maxUses);
    if (code) { setInviteCode(code); toast.success(t('invite.newCodeCreated')); setView('main'); }
  };

  const handleInviteFriend = async (userId: string) => {
    if (!user || !inviteCode) return;
    setInvitedUsers(prev => new Set(prev).add(userId));
    try {
      // Find or create DM conversation
      const { data: existing } = await supabase.from('dm_conversations').select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`)
        .maybeSingle();
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created } = await supabase.from('dm_conversations')
          .insert({ user1_id: user.id, user2_id: userId })
          .select('id').single();
        conversationId = created?.id;
      }
      if (conversationId) {
        await supabase.from('direct_messages').insert({
          sender_id: user.id,
          conversation_id: conversationId,
          content: `Seni **${serverName}** sunucusuna davet ediyorum! 🎉\n${inviteLink}`,
        } as any);
        toast.success('Davet DM olarak gönderildi!');
      }
    } catch {
      toast.error('Davet gönderilemedi.');
    }
  };

  const filteredFriends = friends.filter(f =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border p-0 gap-0">
        {view === 'main' && (
          <>
            <DialogHeader className="px-4 pt-4 pb-0">
              <DialogTitle className="text-foreground text-base">{t('invite.title', { server: serverName })}</DialogTitle>
            </DialogHeader>

            <div className="px-4 py-3 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Arkadaşlarını ara"
                  className="pl-9 bg-input border-border text-sm h-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-1">
                {filteredFriends.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    {friends.length === 0 ? 'Davet edilecek arkadaş bulunamadı' : 'Sonuç bulunamadı'}
                  </p>
                ) : (
                  filteredFriends.map(f => (
                    <div key={f.userId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors">
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium shrink-0">{f.displayName.charAt(0).toUpperCase()}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.displayName}</p>
                        <p className="text-[11px] text-muted-foreground">@{f.username}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={invitedUsers.has(f.userId) ? 'secondary' : 'default'}
                        onClick={() => handleInviteFriend(f.userId)}
                        disabled={invitedUsers.has(f.userId)}
                        className="h-7 text-xs px-3"
                      >
                        {invitedUsers.has(f.userId) ? 'Gönderildi' : 'Davet Et'}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-border px-4 py-3 space-y-2">
              <Label className="text-[11px] font-semibold uppercase text-muted-foreground">{t('invite.inviteLink')}</Label>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="bg-input border-border text-sm flex-1 h-9" />
                <Button size="icon" variant="secondary" onClick={handleCopy} disabled={!inviteCode} className="h-9 w-9 shrink-0"><Copy className="w-4 h-4" /></Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">{t('invite.shareHint')}</p>
                <button onClick={() => setView('settings')} className="text-muted-foreground hover:text-foreground transition-colors" title="Link Ayarları">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {view === 'settings' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setView('main')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="text-base font-semibold text-foreground">Link Ayarları</h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">Süre Sona Erme</Label>
                <Select value={expireSeconds} onValueChange={setExpireSeconds}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPIRE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">Maksimum Kullanım Sayısı</Label>
                <Select value={maxUses} onValueChange={setMaxUses}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAX_USES_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Karşılama Kanalı
                </Label>
                <Select value={landingChannelId} onValueChange={setLandingChannelId}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Varsayılan (ilk kanal)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Hash className="w-3.5 h-3.5" /> Varsayılan (ilk kanal)
                      </span>
                    </SelectItem>
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        <span className="flex items-center gap-2">
                          {ch.type === 'voice' ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <Hash className="w-3.5 h-3.5 text-muted-foreground" />}
                          {ch.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                  Kullanıcı bu davet ile sunucuya katıldığında doğrudan seçtiğin kanala yönlendirilir. Sunucudaki yeni kanallar her zaman mevcut bağlantı için ayarlanabilir.
                </p>
              </div>
              <Button onClick={handleNewCode} disabled={loading} className="w-full">
                <RefreshCw className="w-4 h-4 mr-1" />
                Yeni Bağlantı Oluştur
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteDialog;
