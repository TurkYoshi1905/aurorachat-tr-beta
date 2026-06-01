import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Puzzle, Plus, Download, Trash2, Check, Loader2, Code2,
  Package, ChevronDown, ChevronUp, ShieldCheck, X, Clock,
  BookOpen, Pencil, Save, User2, Sparkles, Search, Star,
} from 'lucide-react';
import PluginDetailModal from '@/components/PluginDetailModal';

interface Plugin {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  css_code: string;
  js_code: string;
  version: string;
  install_count: number;
  is_approved: boolean;
  created_at: string;
  creator_username?: string;
  creator_display_name?: string;
}

const DOC_SECTIONS = [
  {
    title: 'Eklenti Nedir?',
    content: 'Eklentiler CSS ve/veya JavaScript ile AuroraChat arayüzünü kişiselleştirmeni sağlar. CSS eklentileri tasarımı değiştirirken, JS eklentileri davranış ekler.',
  },
  {
    title: 'CSS Eklentisi',
    example: `:root { --background: 0 0% 4%; --primary: 262 80% 58%; }
.message { border-radius: 16px !important; }`,
    content: 'CSS değişkenleri ile renk temasını değiştirebilir, element stillerini override edebilirsin.',
  },
  {
    title: 'JS Eklentisi',
    example: `// Aurora eklenti API'si
console.log('[MyPlugin] Aktif!');
document.title = 'AuroraChat - Özel';`,
    content: 'JavaScript ile sayfa davranışını genişletebilirsin. Eklenti yüklendiğinde çalışır.',
  },
  {
    title: 'Değişkenler & Sınırlar',
    content: 'CSS ve JS kodları ayrı textarea\'lara yazılır. Her eklenti inceleme sürecinden geçer. Zararlı kod (eval, fetch, localStorage yazma) reddedilir.',
  },
  {
    title: 'Yayınlama',
    content: '"Oluştur ve Gönder" sonrası eklentin inceleme kuyruğuna girer. Admin onayından sonra mağazada yayınlanır. Kendi eklentin hemen aktif olur.',
  },
];

const EditPluginModal = ({
  plugin,
  open,
  onClose,
  onSaved,
}: {
  plugin: Plugin | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState({ name: '', description: '', css_code: '', js_code: '', version: '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (plugin) {
      setForm({
        name: plugin.name,
        description: plugin.description || '',
        css_code: plugin.css_code || '',
        js_code: plugin.js_code || '',
        version: plugin.version || '1.0.0',
      });
    }
  }, [plugin]);

  const handleSave = async () => {
    if (!plugin || !user) return;
    if (!form.name.trim()) { toast.error('Eklenti adı boş olamaz'); return; }
    setSaving(true);
    const { error } = await (supabase as any)
      .from('plugins')
      .update({
        name: form.name.trim(),
        description: form.description.trim(),
        css_code: form.css_code.trim(),
        js_code: form.js_code.trim(),
        version: form.version.trim() || '1.0.0',
      })
      .eq('id', plugin.id)
      .eq('creator_id', user.id);
    setSaving(false);
    if (error) { toast.error('Kaydedilemedi: ' + error.message); return; }
    toast.success(`"${form.name}" güncellendi!`);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="w-4 h-4 text-primary" /> Eklentiyi Düzenle
            </DialogTitle>
          </DialogHeader>
        </div>
        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ad *</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Versiyon</label>
                <Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="1.0.0" className="bg-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Açıklama</label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" /> CSS Kodu
              </label>
              <textarea value={form.css_code} onChange={e => setForm(p => ({ ...p, css_code: e.target.value }))} rows={7} placeholder=":root { --background: 0 0% 5%; }" className="w-full bg-input border border-input rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" /> JavaScript Kodu
              </label>
              <textarea value={form.js_code} onChange={e => setForm(p => ({ ...p, js_code: e.target.value }))} rows={7} placeholder="// console.log('Eklenti aktif!');" className="w-full bg-input border border-input rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none" />
            </div>
          </div>
        </ScrollArea>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DocsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
    <DialogContent className="max-w-lg p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-violet-500/10 to-transparent">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-violet-400" /> Eklenti Geliştirme Rehberi
          </DialogTitle>
        </DialogHeader>
      </div>
      <ScrollArea className="max-h-[65vh]">
        <div className="p-5 space-y-4">
          {DOC_SECTIONS.map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-black shrink-0">{i + 1}</span>
                {s.title}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.content}</p>
              {s.example && (
                <pre className="bg-background/60 border border-border rounded-lg p-3 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap">
                  {s.example}
                </pre>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/8 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-primary/80">İyi eklentiler sadece görsel değişiklikler yapar. Güvenli ve hafif kod yazın.</p>
          </div>
        </div>
      </ScrollArea>
      <div className="px-5 py-4 border-t border-border">
        <Button variant="outline" size="sm" className="w-full" onClick={onClose}>Kapat</Button>
      </div>
    </DialogContent>
  </Dialog>
);

/* ─── Store Grid Card ───────────────────────────────────────── */
const StoreGridCard = ({
  plugin,
  installed,
  onCardClick,
  onInstall,
  onRemove,
  installing,
}: {
  plugin: Plugin;
  installed: boolean;
  onCardClick: (p: Plugin) => void;
  onInstall: (p: Plugin) => void;
  onRemove: (p: Plugin) => void;
  installing: boolean;
}) => (
  <div
    className={`group relative rounded-2xl border bg-card flex flex-col overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 ${
      installed ? 'border-primary/30 shadow-sm shadow-primary/8' : 'border-border hover:border-primary/25'
    }`}
    onClick={() => onCardClick(plugin)}
  >
    {/* Top accent */}
    <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-violet-500/40 to-cyan-500/30" />

    <div className="p-4 flex flex-col flex-1 gap-3">
      {/* Icon + status */}
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/10 flex items-center justify-center border border-primary/15">
          <Puzzle className="w-5 h-5 text-primary" />
        </div>
        {installed && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold flex items-center gap-0.5 border border-primary/20">
            <Check className="w-2.5 h-2.5" /> Aktif
          </span>
        )}
      </div>

      {/* Name + version */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{plugin.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/80 text-muted-foreground shrink-0">v{plugin.version}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{plugin.description}</p>
      </div>

      {/* Footer meta */}
      <div className="mt-auto space-y-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Download className="w-3 h-3" /> {plugin.install_count}
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Star className="w-3 h-3" /> —
          </span>
        </div>
        {(plugin.creator_display_name || plugin.creator_username) && (
          <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 truncate">
            <User2 className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {plugin.creator_display_name && <span className="text-foreground/60 font-medium">{plugin.creator_display_name}</span>}
              {plugin.creator_username && <span className="ml-0.5">@{plugin.creator_username}</span>}
            </span>
          </p>
        )}

        {/* Action button */}
        <Button
          size="sm"
          variant={installed ? 'destructive' : 'default'}
          className="w-full text-xs h-8"
          disabled={installing}
          onClick={(e) => { e.stopPropagation(); installed ? onRemove(plugin) : onInstall(plugin); }}
        >
          {installing
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : installed
              ? <><Trash2 className="w-3 h-3 mr-1.5" />Kaldır</>
              : <><Download className="w-3 h-3 mr-1.5" />Yükle</>}
        </Button>
      </div>
    </div>
  </div>
);

/* ─── Admin Plugin Card (unchanged) ─────────────────────────── */
const AdminPluginCard = ({
  plugin, onApprove, onReject, approving,
}: {
  plugin: Plugin;
  onApprove: (p: Plugin) => void;
  onReject: (p: Plugin) => void;
  approving: boolean;
}) => {
  const [showCode, setShowCode] = useState(false);
  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{plugin.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">v{plugin.version}</span>
            {(plugin.creator_display_name || plugin.creator_username) && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <User2 className="w-2.5 h-2.5" />
                {plugin.creator_display_name && <span className="font-medium">{plugin.creator_display_name}</span>}
                {plugin.creator_username && <span>@{plugin.creator_username}</span>}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{plugin.description || 'Açıklama yok'}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setShowCode(p => !p)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors flex items-center gap-1">
            <Code2 className="w-3 h-3" />
            {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <Button size="sm" variant="default" className="text-xs h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700" disabled={approving} onClick={() => onApprove(plugin)}>
            {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Onayla</>}
          </Button>
          <Button size="sm" variant="destructive" className="text-xs h-7 px-2.5" disabled={approving} onClick={() => onReject(plugin)}>
            <X className="w-3 h-3 mr-1" />Reddet
          </Button>
        </div>
      </div>
      {showCode && (
        <div className="space-y-2 border-t border-yellow-500/15 pt-3">
          {plugin.css_code && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">CSS</p>
              <pre className="bg-secondary/50 rounded-lg p-3 text-xs font-mono overflow-x-auto text-foreground whitespace-pre-wrap break-all">{plugin.css_code}</pre>
            </div>
          )}
          {plugin.js_code && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">JavaScript</p>
              <pre className="bg-secondary/50 rounded-lg p-3 text-xs font-mono overflow-x-auto text-foreground whitespace-pre-wrap break-all">{plugin.js_code}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Main PluginsTab ──────────────────────────────────────── */
const PluginsTab = () => {
  const { user, profile } = useAuth();
  const isAdmin = !!profile?.is_app_admin;

  const [storePlugins, setStorePlugins] = useState<Plugin[]>([]);
  const [myPlugins, setMyPlugins] = useState<Plugin[]>([]);
  const [pendingPlugins, setPendingPlugins] = useState<Plugin[]>([]);
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'store' | 'mine' | 'create' | 'admin'>('store');

  const [searchQuery, setSearchQuery] = useState('');
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState<Plugin | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', css_code: '', js_code: '', version: '1.0.0' });
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const queries: Promise<any>[] = [
      (supabase as any)
        .from('plugins')
        .select('*, creator:profiles!plugins_creator_id_fkey(username, display_name)')
        .eq('is_approved', true)
        .order('install_count', { ascending: false }),
      (supabase as any).from('plugins').select('*').eq('creator_id', user.id).order('created_at', { ascending: false }),
      (supabase as any).from('user_plugins').select('plugin_id').eq('user_id', user.id),
    ];

    if (isAdmin) {
      queries.push(
        (supabase as any)
          .from('plugins')
          .select('*, creator:profiles!plugins_creator_id_fkey(username, display_name)')
          .eq('is_approved', false)
          .order('created_at', { ascending: true })
      );
    }

    const [{ data: store }, { data: mine }, { data: installed }, pendingRes] = await Promise.all(queries);

    setStorePlugins(
      (store || []).map((p: any) => ({
        ...p,
        creator_username: p.creator?.username || null,
        creator_display_name: p.creator?.display_name || null,
      }))
    );
    setMyPlugins(mine || []);
    setInstalledIds((installed || []).map((r: any) => r.plugin_id));

    if (isAdmin && pendingRes) {
      const { data: pending } = pendingRes;
      setPendingPlugins(
        (pending || []).map((p: any) => ({
          ...p,
          creator_username: p.creator?.username || null,
          creator_display_name: p.creator?.display_name || null,
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, isAdmin]);

  useEffect(() => {
    const styleId = 'aurora-plugin-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const allPlugins = [...storePlugins, ...myPlugins];
    const installed = allPlugins.filter(p => installedIds.includes(p.id));
    styleEl.textContent = installed.map(p => p.css_code).join('\n');
  }, [installedIds, storePlugins, myPlugins]);

  const installPlugin = async (plugin: Plugin) => {
    if (!user) return;
    setInstalling(plugin.id);
    const { error } = await (supabase as any).from('user_plugins').insert({ user_id: user.id, plugin_id: plugin.id });
    if (error) { toast.error('Yüklenemedi'); }
    else { toast.success(`"${plugin.name}" yüklendi`); setInstalledIds(p => [...p, plugin.id]); }
    setInstalling(null);
  };

  const removePlugin = async (plugin: Plugin) => {
    if (!user) return;
    setInstalling(plugin.id);
    await (supabase as any).from('user_plugins').delete().eq('user_id', user.id).eq('plugin_id', plugin.id);
    toast.success(`"${plugin.name}" kaldırıldı`);
    setInstalledIds(p => p.filter(id => id !== plugin.id));
    setInstalling(null);
  };

  const createPlugin = async () => {
    if (!user) return;
    if (!form.name.trim()) { toast.error('Eklenti adı zorunludur'); return; }
    if (!form.css_code.trim() && !form.js_code.trim()) { toast.error('En az CSS veya JS kodu yazmalısın'); return; }
    setCreating(true);
    const { error } = await (supabase as any).from('plugins').insert({
      creator_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      css_code: form.css_code.trim(),
      js_code: form.js_code.trim(),
      version: form.version.trim() || '1.0.0',
      is_approved: false,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Eklenti oluşturuldu! İnceleme sonrası mağazada görünecek.');
    setForm({ name: '', description: '', css_code: '', js_code: '', version: '1.0.0' });
    setActiveView('mine');
    loadData();
  };

  const deleteMyPlugin = async (plugin: Plugin) => {
    if (!confirm(`"${plugin.name}" eklentisini silmek istediğine emin misin?`)) return;
    await (supabase as any).from('plugins').delete().eq('id', plugin.id).eq('creator_id', user?.id);
    toast.success('Eklenti silindi');
    loadData();
  };

  const approvePlugin = async (plugin: Plugin) => {
    setApproving(plugin.id);
    const { error } = await (supabase as any).from('plugins').update({ is_approved: true }).eq('id', plugin.id);
    if (error) { toast.error('Onaylanamadı: ' + error.message); }
    else { toast.success(`"${plugin.name}" onaylandı ve mağazada yayınlandı!`); loadData(); }
    setApproving(null);
  };

  const rejectPlugin = async (plugin: Plugin) => {
    if (!confirm(`"${plugin.name}" eklentisini silmek/reddetmek istiyor musun?`)) return;
    setApproving(plugin.id);
    const { error } = await (supabase as any).from('plugins').delete().eq('id', plugin.id);
    if (error) { toast.error('Reddedilemedi: ' + error.message); }
    else { toast.success(`"${plugin.name}" reddedildi ve silindi.`); loadData(); }
    setApproving(null);
  };

  const openDetail = (plugin: Plugin) => {
    setDetailPlugin(plugin);
    setShowDetail(true);
  };

  const filteredStore = storePlugins.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
  });

  const tabs = [
    { id: 'store', label: 'Mağaza', icon: Package },
    { id: 'mine', label: 'Eklentilerim', icon: Puzzle },
    { id: 'create', label: 'Oluştur', icon: Plus },
    ...(isAdmin ? [{ id: 'admin', label: `İnceleme${pendingPlugins.length > 0 ? ` (${pendingPlugins.length})` : ''}`, icon: ShieldCheck }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeView === id
                ? id === 'admin'
                  ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25'
                  : id === 'store'
                    ? 'bg-primary/15 text-primary border border-primary/25'
                    : id === 'mine'
                      ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {installedIds.length > 0 && (
            <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
              {installedIds.length} aktif
            </span>
          )}
          <button
            onClick={() => setShowDocs(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
          >
            <BookOpen className="w-3.5 h-3.5" /> Dokümantasyon
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : activeView === 'store' ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Eklenti ara... (ad veya açıklama)"
              className="pl-9 bg-secondary/40 border-border"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Header */}
          <div className="flex items-center gap-2 px-1">
            <Package className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? `Arama Sonuçları` : 'Tüm Eklentiler'}
            </p>
            <span className="text-xs text-muted-foreground">({filteredStore.length})</span>
          </div>

          {filteredStore.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? `"${searchQuery}" için sonuç bulunamadı` : 'Mağazada henüz eklenti yok'}
              </p>
              {!searchQuery && (
                <button onClick={() => setActiveView('create')} className="text-xs text-primary hover:underline mt-1">
                  İlk eklentiyi oluştur
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredStore.map(plugin => (
                <StoreGridCard
                  key={plugin.id}
                  plugin={plugin}
                  installed={installedIds.includes(plugin.id)}
                  onCardClick={openDetail}
                  onInstall={installPlugin}
                  onRemove={removePlugin}
                  installing={installing === plugin.id}
                />
              ))}
            </div>
          )}
        </div>
      ) : activeView === 'mine' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Puzzle className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-semibold text-foreground">Eklentilerim</p>
            <span className="text-xs text-muted-foreground">({myPlugins.length} oluşturulan)</span>
          </div>

          {installedIds.filter(id => !myPlugins.find(p => p.id === id)).length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Yüklü Eklentiler
              </p>
              <div className="space-y-1.5">
                {storePlugins
                  .filter(p => installedIds.includes(p.id) && p.creator_id !== user?.id)
                  .map(p => (
                    <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border/50">
                      <Puzzle className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.install_count} kurulum</p>
                      </div>
                      <Button size="sm" variant="destructive" className="text-xs h-7 px-2" onClick={() => removePlugin(p)} disabled={installing === p.id}>
                        {installing === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kaldır'}
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {myPlugins.length === 0 ? (
            <div className="text-center py-12">
              <Puzzle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Henüz eklenti oluşturmadın</p>
              <button onClick={() => setActiveView('create')} className="text-xs text-primary hover:underline mt-1">Oluştur</button>
            </div>
          ) : (
            <div className="space-y-2">
              {myPlugins.map(plugin => (
                <div key={plugin.id} className="rounded-xl border border-violet-500/15 bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20">
                      <Puzzle className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{plugin.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${plugin.is_approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                          {plugin.is_approved ? '✓ Onaylı' : '⏳ İncelemede'}
                        </span>
                        {installedIds.includes(plugin.id) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">Aktif</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{plugin.description || 'Açıklama yok'}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{plugin.install_count} kurulum · v{plugin.version}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setEditPlugin(plugin)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Düzenle">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMyPlugin(plugin)} className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Sil">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeView === 'admin' && isAdmin ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300/80">Yönetici Paneli — Kullanıcıların gönderdiği eklentileri incele ve onayla.</p>
          </div>
          {pendingPlugins.length === 0 ? (
            <div className="text-center py-12">
              <Check className="w-10 h-10 text-emerald-400/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">İnceleme bekleyen eklenti yok</p>
            </div>
          ) : (
            pendingPlugins.map(plugin => (
              <AdminPluginCard
                key={plugin.id}
                plugin={plugin}
                onApprove={approvePlugin}
                onReject={rejectPlugin}
                approving={approving === plugin.id}
              />
            ))
          )}
        </div>
      ) : (
        /* Create view */
        <div className="rounded-xl border border-emerald-500/15 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Yeni Eklenti Oluştur
            </h3>
            <button onClick={() => setShowDocs(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> Yardım
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Eklenti Adı *</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Örn: Kompakt Mod" className="bg-input" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Versiyon</label>
              <Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="1.0.0" className="bg-input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Açıklama</label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Eklentinin ne yaptığını açıkla" className="bg-input" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" /> CSS Kodu
            </label>
            <textarea value={form.css_code} onChange={e => setForm(p => ({ ...p, css_code: e.target.value }))} rows={6} placeholder=":root { --background: 0 0% 5%; }" className="w-full bg-input border border-input rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" /> JavaScript Kodu
            </label>
            <textarea value={form.js_code} onChange={e => setForm(p => ({ ...p, js_code: e.target.value }))} rows={6} placeholder="// console.log('Eklenti aktif!');" className="w-full bg-input border border-input rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            Oluşturulan eklentiler inceleme sonrası mağazada yayınlanır. Kendi yüklü eklentilerinde hemen aktif olur.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveView('store')}>İptal</Button>
            <Button size="sm" onClick={createPlugin} disabled={creating || !form.name || (!form.css_code && !form.js_code)}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Oluştur ve Gönder
            </Button>
          </div>
        </div>
      )}

      <EditPluginModal plugin={editPlugin} open={!!editPlugin} onClose={() => setEditPlugin(null)} onSaved={loadData} />
      <DocsModal open={showDocs} onClose={() => setShowDocs(false)} />
      <PluginDetailModal
        plugin={detailPlugin}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        installed={detailPlugin ? installedIds.includes(detailPlugin.id) : false}
        onInstall={installPlugin}
        onRemove={removePlugin}
        installing={detailPlugin ? installing === detailPlugin.id : false}
      />
    </div>
  );
};

export default PluginsTab;
