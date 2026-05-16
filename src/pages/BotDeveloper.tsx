import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Bot, Plus, Trash2, Copy, Eye, EyeOff,
  RefreshCw, Upload, Server, Check, Loader2, Settings2,
  Code2, Terminal, ChevronLeft, X, Pencil, BookOpen,
} from 'lucide-react';
import BotDocModal from '@/components/BotDocModal';

interface BotCommand {
  id: string;
  trigger: string;
  name: string;
  description: string;
  response: string;
}

interface BotRecord {
  id: string;
  name: string;
  username: string;
  description: string;
  avatar_url: string | null;
  token: string;
  is_public: boolean;
  created_at: string;
  code?: string;
  commands?: BotCommand[];
}

interface ServerRecord {
  id: string;
  name: string;
  icon_url: string | null;
}

type BotTab = 'info' | 'token' | 'servers' | 'code' | 'commands';

const BOT_TABS: { id: BotTab; label: string; Icon: typeof Bot }[] = [
  { id: 'info', label: 'Genel', Icon: Bot },
  { id: 'token', label: 'Token', Icon: Settings2 },
  { id: 'servers', label: 'Sunucular', Icon: Server },
  { id: 'code', label: 'Kod', Icon: Code2 },
  { id: 'commands', label: 'Komutlar', Icon: Terminal },
];

const BotDeveloper = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<BotRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [serverBots, setServerBots] = useState<string[]>([]);
  const [addingServer, setAddingServer] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [botTab, setBotTab] = useState<BotTab>('info');
  const [botCode, setBotCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [botCommands, setBotCommands] = useState<BotCommand[]>([]);
  const [showAddCommand, setShowAddCommand] = useState(false);
  const [newCmd, setNewCmd] = useState({ trigger: '/', name: '', description: '', response: '' });
  const [savingCommands, setSavingCommands] = useState(false);

  const [editInfo, setEditInfo] = useState({ name: '', username: '', description: '' });
  const [editMode, setEditMode] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const responseTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editResponseTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState({ name: '', username: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [editingCmd, setEditingCmd] = useState<BotCommand | null>(null);
  const [editCmdData, setEditCmdData] = useState({ description: '', response: '' });
  const [savingEditCmd, setSavingEditCmd] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  const loadBots = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any).from('bots').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    setBots(data || []);
    setLoading(false);
  };

  const loadServers = async () => {
    if (!user) return;

    // Servers where user is the owner — always permitted
    const { data: ownedRows } = await supabase.from('servers' as any).select('id').eq('owner_id', user.id);
    const ownedIds: string[] = (ownedRows || []).map((r: any) => r.id);

    // Servers where user is a member — check role permissions
    const { data: members } = await supabase
      .from('server_members' as any)
      .select('id, server_id')
      .eq('user_id', user.id);

    const memberMap: Record<string, string> = {};
    for (const m of members || []) memberMap[(m as any).id] = (m as any).server_id;
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
    const { data } = await supabase.from('servers' as any).select('id, name, icon_url').in('id', allIds);
    setServers(data || []);
  };

  const loadServerBots = async (botId: string) => {
    const { data } = await (supabase as any).from('server_bots').select('server_id').eq('bot_id', botId);
    setServerBots((data || []).map((r: any) => r.server_id));
  };

  useEffect(() => { loadBots(); loadServers(); }, [user]);

  useEffect(() => {
    if (selectedBot) {
      loadServerBots(selectedBot.id);
      setBotCode(selectedBot.code || '');
      setBotCommands(Array.isArray(selectedBot.commands) ? selectedBot.commands : []);
      setBotTab('info');
      if (isMobile) setMobileView('detail');
    }
  }, [selectedBot?.id]);

  const selectBot = (bot: BotRecord) => {
    setShowCreate(false);
    setSelectedBot(bot);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (botId: string): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    const ext = avatarFile.name.split('.').pop();
    const path = `bot-avatars/${botId}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const createBot = async () => {
    if (!user) return;
    if (!form.name.trim() || !form.username.trim()) { toast.error('İsim ve kullanıcı adı zorunludur'); return; }
    if (!/^[a-z0-9_]+$/.test(form.username.toLowerCase())) { toast.error('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir'); return; }
    setCreating(true);
    try {
      const { data, error } = await (supabase as any).from('bots').insert({
        owner_id: user.id,
        name: form.name.trim(),
        username: form.username.toLowerCase().trim(),
        description: form.description.trim(),
      }).select().single();
      if (error) { toast.error(error.message); return; }
      if (avatarFile && data) {
        const url = await uploadAvatar(data.id);
        if (url) {
          await (supabase as any).from('bots').update({ avatar_url: url }).eq('id', data.id);
          data.avatar_url = url;
        }
      }
      toast.success('Bot oluşturuldu!');
      setForm({ name: '', username: '', description: '' });
      setAvatarFile(null); setAvatarPreview(null);
      setShowCreate(false);
      if (isMobile) setMobileView('list');
      await loadBots();
    } finally { setCreating(false); }
  };

  const deleteBot = async (bot: BotRecord) => {
    if (!confirm(`"${bot.name}" botunu silmek istediğine emin misin?`)) return;
    await (supabase as any).from('bots').delete().eq('id', bot.id);
    toast.success('Bot silindi');
    if (selectedBot?.id === bot.id) { setSelectedBot(null); if (isMobile) setMobileView('list'); }
    loadBots();
  };

  const regenerateToken = async (bot: BotRecord) => {
    if (!confirm('Token yenilendikten sonra eski token geçersiz olur. Devam edilsin mi?')) return;
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    await (supabase as any).from('bots').update({ token: newToken }).eq('id', bot.id);
    toast.success('Token yenilendi');
    loadBots();
    if (selectedBot?.id === bot.id) setSelectedBot({ ...selectedBot, token: newToken });
  };

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); });
  };

  const addBotToServer = async (serverId: string) => {
    if (!selectedBot) return;
    setAddingServer(serverId);
    const { error } = await (supabase as any).from('server_bots').insert({ server_id: serverId, bot_id: selectedBot.id, added_by: user?.id });
    if (error) toast.error('Eklenemedi: ' + error.message);
    else { toast.success('Bot sunucuya eklendi!'); loadServerBots(selectedBot.id); }
    setAddingServer(null);
  };

  const removeBotFromServer = async (serverId: string) => {
    if (!selectedBot) return;
    setAddingServer(serverId);
    await (supabase as any).from('server_bots').delete().eq('server_id', serverId).eq('bot_id', selectedBot.id);
    toast.success('Bot sunucudan kaldırıldı');
    loadServerBots(selectedBot.id);
    setAddingServer(null);
  };

  const saveCode = async () => {
    if (!selectedBot) return;
    setSavingCode(true);
    try {
      const { error } = await (supabase as any).from('bots').update({ code: botCode }).eq('id', selectedBot.id);
      if (error) toast.error('Kod kaydedilemedi: ' + error.message);
      else { toast.success('Kod kaydedildi!'); setSelectedBot({ ...selectedBot, code: botCode }); }
    } finally { setSavingCode(false); }
  };

  const addCommand = async () => {
    if (!selectedBot || !newCmd.name.trim() || !newCmd.response.trim()) {
      toast.error('Komut adı ve yanıt zorunludur'); return;
    }
    setSavingCommands(true);
    try {
      const cmd: BotCommand = {
        id: Date.now().toString(),
        trigger: newCmd.trigger || '/',
        name: newCmd.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        description: newCmd.description.trim(),
        response: newCmd.response.trim(),
      };
      const updated = [...botCommands, cmd];
      const { error } = await (supabase as any).from('bots').update({ commands: updated }).eq('id', selectedBot.id);
      if (error) toast.error('Komut eklenemedi: ' + error.message);
      else {
        setBotCommands(updated);
        setSelectedBot({ ...selectedBot, commands: updated });
        setNewCmd({ trigger: '/', name: '', description: '', response: '' });
        setShowAddCommand(false);
        toast.success('Komut eklendi!');
      }
    } finally { setSavingCommands(false); }
  };

  const removeCommand = async (id: string) => {
    if (!selectedBot) return;
    const updated = botCommands.filter(c => c.id !== id);
    const { error } = await (supabase as any).from('bots').update({ commands: updated }).eq('id', selectedBot.id);
    if (error) toast.error('Komut silinemedi');
    else {
      setBotCommands(updated);
      setSelectedBot({ ...selectedBot, commands: updated });
      toast.success('Komut silindi');
    }
  };

  const startEditCmd = (cmd: BotCommand) => {
    setEditingCmd(cmd);
    setEditCmdData({ description: cmd.description, response: cmd.response });
  };

  const saveEditCmd = async () => {
    if (!selectedBot || !editingCmd) return;
    setSavingEditCmd(true);
    try {
      const updated = botCommands.map(c =>
        c.id === editingCmd.id ? { ...c, description: editCmdData.description, response: editCmdData.response } : c
      );
      const { error } = await (supabase as any).from('bots').update({ commands: updated }).eq('id', selectedBot.id);
      if (error) { toast.error('Kaydedilemedi'); return; }
      setBotCommands(updated);
      setSelectedBot({ ...selectedBot, commands: updated });
      setEditingCmd(null);
      toast.success('Komut güncellendi!');
    } finally { setSavingEditCmd(false); }
  };

  const insertVariable = (variable: string, targetRef: React.RefObject<HTMLTextAreaElement>, setter: (fn: (prev: string) => string) => void) => {
    const el = targetRef.current;
    if (!el) { setter(prev => prev + variable); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = el.value.slice(0, start) + variable + el.value.slice(end);
    setter(() => newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + variable.length;
    });
  };

  const VARIABLES = [
    { label: '{user}', desc: 'Görünen ad' },
    { label: '{username}', desc: 'Kullanıcı adı' },
    { label: '{memberCount}', desc: 'Üye sayısı' },
    { label: '{serverName}', desc: 'Sunucu adı' },
  ];

  const startEditInfo = () => {
    if (!selectedBot) return;
    setEditInfo({ name: selectedBot.name, username: selectedBot.username, description: selectedBot.description || '' });
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditMode(true);
  };

  const handleEditAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const saveEditInfo = async () => {
    if (!selectedBot || !user) return;
    if (!editInfo.name.trim() || !editInfo.username.trim()) { toast.error('İsim ve kullanıcı adı zorunludur'); return; }
    if (!/^[a-z0-9_]+$/.test(editInfo.username.toLowerCase())) { toast.error('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir'); return; }
    setSavingInfo(true);
    try {
      let avatarUrl = selectedBot.avatar_url;
      if (editAvatarFile) {
        const ext = editAvatarFile.name.split('.').pop();
        const path = `bot-avatars/${selectedBot.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, editAvatarFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }
      const updates: any = {
        name: editInfo.name.trim(),
        username: editInfo.username.toLowerCase().trim(),
        description: editInfo.description.trim(),
        avatar_url: avatarUrl,
      };
      const { error } = await (supabase as any).from('bots').update(updates).eq('id', selectedBot.id);
      if (error) { toast.error('Kaydedilemedi: ' + error.message); return; }
      setSelectedBot({ ...selectedBot, ...updates });
      setBots(prev => prev.map(b => b.id === selectedBot.id ? { ...b, ...updates } : b));
      setEditMode(false);
      setEditAvatarFile(null);
      setEditAvatarPreview(null);
      toast.success('Bot bilgileri güncellendi!');
    } finally { setSavingInfo(false); }
  };

  const renderBotList = () => (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-2">
        Botlarım ({bots.length})
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-8 px-3">
          <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-xs text-muted-foreground">Henüz bot yok</p>
          <button
            onClick={() => { setShowCreate(true); if (isMobile) setMobileView('detail'); }}
            className="text-xs text-primary hover:underline mt-1"
          >
            İlk botu oluştur
          </button>
        </div>
      ) : (
        bots.map(bot => (
          <button
            key={bot.id}
            onClick={() => selectBot(bot)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
              selectedBot?.id === bot.id && !isMobile
                ? 'bg-primary/15 text-primary'
                : 'hover:bg-secondary text-foreground'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
              {bot.avatar_url
                ? <img src={bot.avatar_url} alt="" className="w-full h-full object-cover" />
                : <Bot className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{bot.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">@{bot.username}</p>
            </div>
          </button>
        ))
      )}
    </div>
  );

  const renderTabContent = () => {
    if (!selectedBot) return null;
    switch (botTab) {
      case 'info':
        if (editMode) {
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Profili Düzenle</h3>
                <button onClick={() => setEditMode(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => editAvatarInputRef.current?.click()}
                  className="w-14 h-14 rounded-2xl bg-secondary border-2 border-dashed border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center shrink-0"
                >
                  {editAvatarPreview
                    ? <img src={editAvatarPreview} alt="" className="w-full h-full object-cover" />
                    : selectedBot.avatar_url
                      ? <img src={selectedBot.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <Upload className="w-5 h-5 text-muted-foreground" />}
                </div>
                <input ref={editAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditAvatarChange} />
                <div>
                  <p className="text-xs font-medium text-foreground">Profil Resmi</p>
                  <button onClick={() => editAvatarInputRef.current?.click()} className="text-xs text-primary hover:underline">Değiştir</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bot Adı *</label>
                <Input value={editInfo.name} onChange={e => setEditInfo(p => ({ ...p, name: e.target.value }))} placeholder="Bot adı" className="bg-input" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kullanıcı Adı *</label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-sm">@</span>
                  <Input value={editInfo.username} onChange={e => setEditInfo(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} placeholder="bot_kullanici_adi" className="bg-input" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Açıklama</label>
                <textarea
                  value={editInfo.description}
                  onChange={e => setEditInfo(p => ({ ...p, description: e.target.value }))}
                  placeholder="Bot açıklaması..."
                  rows={3}
                  className="w-full bg-input border border-input rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEditInfo} disabled={savingInfo} className="flex-1 gap-1.5 text-xs">
                  {savingInfo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Kaydet
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)} className="text-xs">İptal</Button>
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                {selectedBot.avatar_url
                  ? <img src={selectedBot.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <Bot className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground">{selectedBot.name}</h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold border border-primary/30">Bot</span>
                </div>
                <p className="text-sm text-muted-foreground">@{selectedBot.username}</p>
                {selectedBot.description && <p className="text-sm text-foreground/80 mt-1">{selectedBot.description}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={startEditInfo} className="gap-1.5 text-xs">
                <Settings2 className="w-3.5 h-3.5" /> Profili Düzenle
              </Button>
              <Button variant="outline" size="sm" onClick={() => regenerateToken(selectedBot)} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Token Yenile
              </Button>
              <Button variant="destructive" size="sm" onClick={() => deleteBot(selectedBot)} className="gap-1.5 text-xs">
                <Trash2 className="w-3.5 h-3.5" /> Sil
              </Button>
            </div>
          </div>
        );

      case 'token':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Bot Token'ını API entegrasyonlarında kullan. Güvende tut!</p>
            <div className="bg-secondary/50 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <code className="flex-1 text-xs text-foreground font-mono truncate">
                {showTokens[selectedBot.id] ? selectedBot.token : '•'.repeat(48)}
              </code>
              <button
                onClick={() => setShowTokens(p => ({ ...p, [selectedBot.id]: !p[selectedBot.id] }))}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                {showTokens[selectedBot.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => copyToken(selectedBot.token, selectedBot.id)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                {copiedId === selectedBot.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-yellow-400/80">⚠ Token'ı kimseyle paylaşma. Ele geçirilirse hemen yenile.</p>
            <Button variant="outline" size="sm" onClick={() => regenerateToken(selectedBot)} className="gap-1.5 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Token Yenile
            </Button>
          </div>
        );

      case 'servers':
        return (
          <div className="space-y-2">
            {servers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Üye olduğun sunucu bulunamadı.</p>
            ) : (
              servers.map(srv => {
                const isAdded = serverBots.includes(srv.id);
                return (
                  <div key={srv.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-secondary/20">
                    <div className="w-8 h-8 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-foreground">
                      {srv.icon_url
                        ? <img src={srv.icon_url} alt="" className="w-full h-full object-cover" />
                        : srv.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="flex-1 text-sm text-foreground truncate">{srv.name}</p>
                    <Button
                      size="sm"
                      variant={isAdded ? 'destructive' : 'default'}
                      className="text-xs h-7 px-2.5"
                      disabled={addingServer === srv.id}
                      onClick={() => isAdded ? removeBotFromServer(srv.id) : addBotToServer(srv.id)}
                    >
                      {addingServer === srv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : isAdded ? 'Kaldır' : 'Ekle'}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        );

      case 'code':
        return (
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary/40 border border-border/50 p-3 text-xs text-muted-foreground font-mono leading-relaxed">
              <p>{'// Bot Kod Editörü — komutlar tetiklendiğinde çalışır'}</p>
              <p>{'// Kullanılabilir API:'}</p>
              <p>{'// onCommand(name, userId, message)  →  komut tetiklenince'}</p>
              <p>{'// sendMessage(channelId, text)       →  kanala mesaj gönder'}</p>
              <p>{'// getBotInfo()                       →  bot bilgilerini al'}</p>
            </div>
            <textarea
              value={botCode}
              onChange={e => setBotCode(e.target.value)}
              rows={14}
              placeholder={"// Bot kodunu buraya yaz...\n\nonCommand('merhaba', (userId, message) => {\n  sendMessage(message.channelId, 'Merhaba! 👋');\n});"}
              className="w-full bg-[#1a1b2e] border border-border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-1 focus:ring-primary/50 text-emerald-300 placeholder:text-muted-foreground/50 resize-none leading-relaxed"
              spellCheck={false}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={saveCode} disabled={savingCode} className="gap-1.5 text-xs">
                {savingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Kaydet
              </Button>
            </div>
          </div>
        );

      case 'commands':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{botCommands.length} komut tanımlı</p>
              <Button size="sm" onClick={() => { setShowAddCommand(true); setEditingCmd(null); }} className="gap-1.5 text-xs h-7">
                <Plus className="w-3.5 h-3.5" /> Komut Ekle
              </Button>
            </div>

            {/* Variable legend */}
            <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Kullanılabilir Değişkenler</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <span key={v.label} className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20" title={v.desc}>
                    {v.label}
                  </span>
                ))}
              </div>
            </div>

            {showAddCommand && (
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Yeni Komut</p>
                  <button onClick={() => setShowAddCommand(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Trigger</label>
                    <select
                      value={newCmd.trigger}
                      onChange={e => setNewCmd(p => ({ ...p, trigger: e.target.value }))}
                      className="w-full bg-input border border-input rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="/">/</option>
                      <option value="!">!</option>
                      <option value=".">.</option>
                      <option value="$">$</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Komut Adı *</label>
                    <Input
                      value={newCmd.name}
                      onChange={e => setNewCmd(p => ({ ...p, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                      placeholder="merhaba"
                      className="bg-input"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Açıklama</label>
                  <Input
                    value={newCmd.description}
                    onChange={e => setNewCmd(p => ({ ...p, description: e.target.value }))}
                    placeholder="Bu komut ne yapıyor?"
                    className="bg-input"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Yanıt *</label>
                    <div className="flex gap-1">
                      {VARIABLES.map(v => (
                        <button
                          key={v.label}
                          type="button"
                          title={v.desc}
                          onClick={() => insertVariable(v.label, responseTextareaRef, setter => setNewCmd(p => ({ ...p, response: setter(p.response) })))}
                          className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 hover:bg-primary/20 transition-colors"
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    ref={responseTextareaRef}
                    value={newCmd.response}
                    onChange={e => setNewCmd(p => ({ ...p, response: e.target.value }))}
                    rows={3}
                    placeholder="Bot bu komutu aldığında ne yanıtlayacak? {user} ile kullanıcı adını ekleyebilirsin."
                    className="w-full bg-input border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddCommand(false)}>İptal</Button>
                  <Button
                    size="sm"
                    onClick={addCommand}
                    disabled={savingCommands || !newCmd.name || !newCmd.response}
                    className="gap-1.5"
                  >
                    {savingCommands ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Ekle
                  </Button>
                </div>
              </div>
            )}

            {botCommands.length === 0 && !showAddCommand ? (
              <div className="text-center py-8">
                <Terminal className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Henüz komut eklenmedi</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Botun için özel komutlar oluştur</p>
              </div>
            ) : (
              <div className="space-y-2">
                {botCommands.map(cmd => (
                  <div key={cmd.id} className="rounded-lg border border-border/50 bg-secondary/20 overflow-hidden">
                    {editingCmd?.id === cmd.id ? (
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-primary">{cmd.trigger}{cmd.name}</span>
                          <span className="text-[10px] text-muted-foreground">düzenleniyor</span>
                        </div>
                        <Input
                          value={editCmdData.description}
                          onChange={e => setEditCmdData(p => ({ ...p, description: e.target.value }))}
                          placeholder="Açıklama"
                          className="bg-input h-8 text-xs"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Yanıt</label>
                            <div className="flex gap-1">
                              {VARIABLES.map(v => (
                                <button
                                  key={v.label}
                                  type="button"
                                  title={v.desc}
                                  onClick={() => insertVariable(v.label, editResponseTextareaRef, setter => setEditCmdData(p => ({ ...p, response: setter(p.response) })))}
                                  className="text-[9px] font-mono bg-primary/10 text-primary px-1 py-0.5 rounded border border-primary/20 hover:bg-primary/20 transition-colors"
                                >
                                  {v.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            ref={editResponseTextareaRef}
                            value={editCmdData.response}
                            onChange={e => setEditCmdData(p => ({ ...p, response: e.target.value }))}
                            rows={2}
                            className="w-full bg-input border border-input rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary/50 text-foreground resize-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingCmd(null)}>İptal</Button>
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={saveEditCmd} disabled={savingEditCmd}>
                            {savingEditCmd ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Kaydet
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-3 group">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 font-mono text-sm text-primary font-bold">
                          {cmd.trigger}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground font-mono">{cmd.trigger}{cmd.name}</p>
                          {cmd.description && <p className="text-xs text-muted-foreground mt-0.5">{cmd.description}</p>}
                          <p className="text-xs text-foreground/70 mt-1.5 bg-secondary/50 rounded px-2 py-1">↩ {cmd.response}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <button
                            onClick={() => startEditCmd(cmd)}
                            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeCommand(cmd.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderDetail = () => {
    if (showCreate) {
      return (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Yeni Bot Oluştur</h2>
            <button
              onClick={() => { setShowCreate(false); if (isMobile) setMobileView('list'); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div
              onClick={() => avatarInputRef.current?.click()}
              className="w-20 h-20 rounded-2xl bg-secondary border-2 border-dashed border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center shrink-0"
            >
              {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <div>
              <p className="text-sm font-medium text-foreground">Bot Profil Resmi</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, GIF · Maks 5MB</p>
              <button onClick={() => avatarInputRef.current?.click()} className="text-xs text-primary hover:underline mt-1">Resim Seç</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bot Adı *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Örn: Müzik Botu" className="bg-input" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kullanıcı Adı *</label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">@</span>
              <Input
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                placeholder="muzik_botu"
                className="bg-input"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Sadece küçük harf, rakam ve alt çizgi kullanabilirsin.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Açıklama</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Bu bot ne yapıyor?"
              className="w-full bg-input border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); if (isMobile) setMobileView('list'); }}>İptal</Button>
            <Button size="sm" onClick={createBot} disabled={creating || !form.name || !form.username}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bot className="w-4 h-4 mr-1" />}
              Oluştur
            </Button>
          </div>
        </div>
      );
    }

    if (!selectedBot) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bot className="w-10 h-10 text-primary/60" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Bot Seç veya Oluştur</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">Sol panelden bir bot seç veya yeni bir bot oluşturarak sunuculara ekle.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-1.5 mt-2">
            <Plus className="w-4 h-4" /> Yeni Bot Oluştur
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex gap-0.5 bg-secondary/50 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {BOT_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setBotTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                botTab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-4 md:p-5">
          {renderTabContent()}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {isMobile && mobileView === 'detail' ? (
            <button
              onClick={() => { setMobileView('list'); setSelectedBot(null); setShowCreate(false); }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">
                {isMobile && mobileView === 'detail' && selectedBot ? selectedBot.name : 'Bot Geliştirici Merkezi'}
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">
                {isMobile && mobileView === 'detail' && selectedBot
                  ? `@${selectedBot.username}`
                  : 'Botlarını yönet ve sunuculara ekle'}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDocModal(true)}
              className="gap-1.5 hidden sm:flex"
            >
              <BookOpen className="w-3.5 h-3.5" /> Dokümantasyon
            </Button>
            <button
              onClick={() => setShowDocModal(true)}
              className="sm:hidden p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="Dokümantasyon"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            {(!isMobile || mobileView === 'list') && (
              <Button size="sm" onClick={() => { setShowCreate(true); if (isMobile) setMobileView('detail'); }} className="gap-1.5">
                <Plus className="w-4 h-4" /> Yeni Bot
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 md:py-6">
        {isMobile ? (
          mobileView === 'list' ? renderBotList() : renderDetail()
        ) : (
          <div className="flex gap-5">
            <div className="w-56 shrink-0">{renderBotList()}</div>
            <div className="flex-1 min-w-0">{renderDetail()}</div>
          </div>
        )}
      </div>

      <BotDocModal open={showDocModal} onClose={() => setShowDocModal(false)} />
    </div>
  );
};

export default BotDeveloper;
