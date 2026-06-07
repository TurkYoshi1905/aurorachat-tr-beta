import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Server, Plus, Check, Loader2, X, Command, Zap, Calendar, Hash, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BotProfile {
  id: string;
  name: string;
  username: string;
  description?: string | null;
  avatar_url?: string | null;
  owner_id: string;
  created_at?: string | null;
  commands?: Array<{ trigger: string; name: string; description?: string }> | null;
}

interface ServerRecord {
  id: string;
  name: string;
  icon_url: string | null;
}

interface BotProfileModalProps {
  bot: BotProfile | null;
  open: boolean;
  onClose: () => void;
}

const BotProfileModal = ({ bot, open, onClose }: BotProfileModalProps) => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'info' | 'commands' | 'servers'>('info');
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [addedServers, setAddedServers] = useState<string[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [addingServer, setAddingServer] = useState<string | null>(null);
  const [botCommands, setBotCommands] = useState<any[]>([]);
  const [botServerCount, setBotServerCount] = useState<number>(0);
  const [commandSearch, setCommandSearch] = useState('');

  useEffect(() => {
    if (!open || !bot) {
      setActiveSection('info');
      setServers([]);
      setAddedServers([]);
      setBotCommands([]);
      setCommandSearch('');
    } else {
      loadBotExtra();
    }
  }, [open, bot]);

  const loadBotExtra = async () => {
    if (!bot) return;
    try {
      const { data: fullBot } = await (supabase as any)
        .from('bots')
        .select('commands, created_at')
        .eq('id', bot.id)
        .maybeSingle();
      if (fullBot?.commands) setBotCommands(fullBot.commands);

      const { count } = await (supabase as any)
        .from('server_bots')
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', bot.id);
      setBotServerCount(count || 0);
    } catch { /* silent */ }
  };

  const loadServersForBot = async () => {
    if (!user || !bot) return;
    setLoadingServers(true);
    try {
      const { data: ownedRows } = await (supabase as any).from('servers').select('id').eq('owner_id', user.id);
      const ownedIds: string[] = (ownedRows || []).map((r: any) => r.id);

      const { data: members } = await (supabase as any).from('server_members').select('id, server_id').eq('user_id', user.id);
      const memberMap: Record<string, string> = {};
      for (const m of members || []) memberMap[m.id] = m.server_id;
      const memberIds = Object.keys(memberMap);

      let rolePermittedIds: string[] = [];
      if (memberIds.length > 0) {
        const { data: memberRoles } = await (supabase as any)
          .from('server_member_roles')
          .select('member_id, role:server_roles(permissions)')
          .in('member_id', memberIds);
        rolePermittedIds = [
          ...new Set(
            (memberRoles || [])
              .filter((mr: any) => {
                const p = mr.role?.permissions || {};
                return p.administrator || p.manage_server || p.manage_bots;
              })
              .map((mr: any) => memberMap[mr.member_id])
              .filter(Boolean)
          ),
        ];
      }

      const allIds = [...new Set([...ownedIds, ...rolePermittedIds])];
      if (allIds.length === 0) { setServers([]); return; }

      const { data: serverList } = await (supabase as any).from('servers').select('id, name, icon_url').in('id', allIds);
      setServers(serverList || []);

      const { data: botServerRows } = await (supabase as any).from('server_bots').select('server_id').eq('bot_id', bot.id);
      setAddedServers((botServerRows || []).map((r: any) => r.server_id));
    } finally {
      setLoadingServers(false);
    }
  };

  const handleAddToServer = async (serverId: string) => {
    if (!bot || !user) return;
    setAddingServer(serverId);
    try {
      const isAdded = addedServers.includes(serverId);
      if (isAdded) {
        await (supabase as any).from('server_bots').delete().eq('server_id', serverId).eq('bot_id', bot.id);
        setAddedServers(prev => prev.filter(id => id !== serverId));
        setBotServerCount(prev => Math.max(0, prev - 1));
        toast.success('Bot sunucudan kaldırıldı');
      } else {
        const { error } = await (supabase as any).from('server_bots').insert({ server_id: serverId, bot_id: bot.id, added_by: user.id });
        if (error) { toast.error('Bot eklenemedi: ' + error.message); return; }
        setAddedServers(prev => [...prev, serverId]);
        setBotServerCount(prev => prev + 1);
        toast.success('Bot sunucuya eklendi!');
      }
    } finally {
      setAddingServer(null);
    }
  };

  const handleSectionChange = (section: typeof activeSection) => {
    setActiveSection(section);
    if (section === 'servers' && servers.length === 0 && !loadingServers) {
      loadServersForBot();
    }
  };

  const filteredCommands = useMemo(() => {
    if (!commandSearch.trim()) return botCommands;
    const q = commandSearch.toLowerCase();
    return botCommands.filter((cmd: any) =>
      cmd.trigger?.toLowerCase().includes(q) ||
      cmd.name?.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q)
    );
  }, [botCommands, commandSearch]);

  if (!bot) return null;

  const createdDate = bot.created_at
    ? new Date(bot.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const initials = bot.name.charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl border-border/60 shadow-2xl">
        {/* Banner */}
        <div className="relative h-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/60 via-violet-600/40 to-cyan-600/30" />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.8) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '32px 32px, 24px 24px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar + badge row */}
        <div className="relative px-5 -mt-10 flex items-end justify-between mb-1">
          <div className="relative">
            <div className="w-[76px] h-[76px] rounded-2xl ring-4 ring-background overflow-hidden bg-gradient-to-br from-primary/30 to-violet-600/20 flex items-center justify-center shadow-xl">
              {bot.avatar_url
                ? <img src={bot.avatar_url} alt={bot.name} className="w-full h-full object-cover" />
                : <span className="text-2xl font-black text-primary">{initials}</span>}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-emerald-500 border-2 border-background flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
          <div className="pb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/30 backdrop-blur-sm">
              <Bot className="w-3 h-3" /> BOT
            </span>
          </div>
        </div>

        {/* Name & username */}
        <div className="px-5 mt-1 space-y-0.5">
          <h2 className="text-lg font-bold text-foreground leading-tight">{bot.name}</h2>
          <p className="text-sm text-muted-foreground">@{bot.username}</p>
        </div>

        {/* Stats row */}
        <div className="px-5 mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Server className="w-3.5 h-3.5 text-primary/70" />
            <span className="font-semibold text-foreground">{botServerCount}</span>
            <span>sunucu</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Command className="w-3.5 h-3.5 text-primary/70" />
            <span className="font-semibold text-foreground">{botCommands.length}</span>
            <span>komut</span>
          </div>
          {createdDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <Calendar className="w-3 h-3" />
              <span>{createdDate}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/60 mx-5 mt-4 gap-0">
          {[
            { id: 'info', label: 'Hakkında' },
            { id: 'commands', label: `Komutlar${botCommands.length > 0 ? ` (${botCommands.length})` : ''}` },
            { id: 'servers', label: 'Ekle' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleSectionChange(tab.id as any)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                activeSection === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-5 py-4 min-h-[140px]">
          {activeSection === 'info' && (
            <div className="space-y-3">
              {bot.description ? (
                <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <p className="text-sm text-foreground/90 leading-relaxed">{bot.description}</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Bot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Bu bot için açıklama eklenmemiş.</p>
                </div>
              )}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-300/80">Bot aktif ve çevrimiçi — komutlara yanıt verebilir.</p>
              </div>
            </div>
          )}

          {activeSection === 'commands' && (
            <div className="space-y-2">
              {botCommands.length === 0 ? (
                <div className="text-center py-4">
                  <Hash className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Bu botun tanımlı komutu yok.</p>
                </div>
              ) : (
                <>
                  {/* Search input */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      value={commandSearch}
                      onChange={e => setCommandSearch(e.target.value)}
                      placeholder="Komut ara..."
                      className="pl-8 h-8 text-xs bg-secondary/40 border-border/50 focus:border-primary/50"
                    />
                    {commandSearch && (
                      <button
                        onClick={() => setCommandSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <ScrollArea className="h-[160px]">
                    <div className="space-y-1.5 pr-1">
                      {filteredCommands.length === 0 ? (
                        <div className="text-center py-6">
                          <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1.5" />
                          <p className="text-xs text-muted-foreground">Komut bulunamadı.</p>
                        </div>
                      ) : filteredCommands.map((cmd: any, i: number) => (
                        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:bg-secondary/50 transition-colors">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-primary/15 text-primary mt-0.5 shrink-0">
                            /{cmd.trigger}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">{cmd.name || cmd.trigger}</p>
                            {cmd.description && (
                              <p className="text-[10px] text-muted-foreground truncate">{cmd.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          )}

          {activeSection === 'servers' && (
            <div className="space-y-2">
              {loadingServers ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : servers.length === 0 ? (
                <div className="text-center py-4">
                  <Server className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Bot ekleme izniniz olan sunucu bulunamadı.</p>
                </div>
              ) : (
                <ScrollArea className="h-[160px]">
                  <div className="space-y-1.5 pr-1">
                    {servers.map(srv => {
                      const isAdded = addedServers.includes(srv.id);
                      return (
                        <div key={srv.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-foreground">
                            {srv.icon_url
                              ? <img src={srv.icon_url} alt="" className="w-full h-full object-cover" />
                              : srv.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="flex-1 text-sm text-foreground truncate">{srv.name}</p>
                          <Button
                            size="sm"
                            variant={isAdded ? 'destructive' : 'default'}
                            className="text-xs h-7 px-2.5 shrink-0"
                            disabled={addingServer === srv.id}
                            onClick={() => handleAddToServer(srv.id)}
                          >
                            {addingServer === srv.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : isAdded
                                ? 'Kaldır'
                                : <><Check className="w-3 h-3 mr-1" />Ekle</>}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-0 border-t border-border/40 mt-1">
          <div className="flex items-center justify-between pt-3">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary/60" />
              AuroraChat Bot · Güvenli & Doğrulanmış
            </p>
            {activeSection !== 'servers' && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => handleSectionChange('servers')}>
                <Plus className="w-3 h-3" /> Sunucuya Ekle
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BotProfileModal;
