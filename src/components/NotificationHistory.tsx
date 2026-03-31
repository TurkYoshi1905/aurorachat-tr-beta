import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Bell, Check, CheckCheck, MessageSquare, AtSign, X, ArrowRight,
  Trash2, Hash, Search, SlidersHorizontal, BellOff, Reply
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  read: boolean;
  created_at: string;
}

interface NotificationHistoryProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  onNavigateToMessage?: (channelId: string, messageId?: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: any; bg: string; color: string; label: string; bar: string }> = {
  dm:      { icon: MessageSquare, bg: 'bg-indigo-500/15',  color: 'text-indigo-400',  label: 'Direkt Mesaj', bar: 'bg-indigo-500' },
  mention: { icon: AtSign,        bg: 'bg-orange-500/15', color: 'text-orange-400',  label: 'Etiket',        bar: 'bg-orange-500' },
  reply:   { icon: Reply,         bg: 'bg-cyan-500/15',   color: 'text-cyan-400',    label: 'Yanıt',         bar: 'bg-cyan-500' },
};

const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] ?? { icon: Bell, bg: 'bg-primary/15', color: 'text-primary', label: 'Bildirim', bar: 'bg-primary' };

const NotificationHistory = ({ onClose, onUnreadCountChange, onNavigateToMessage }: NotificationHistoryProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const getRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s önce`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}sa önce`;
    const days = Math.floor(h / 24);
    if (days === 1) return 'Dün';
    return `${days} gün önce`;
  };

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(150);
    if (data) {
      setNotifications(data as Notification[]);
      const unread = data.filter((n: any) => !n.read).length;
      onUnreadCountChange?.(unread);
    }
    setLoading(false);
  }, [user, onUnreadCountChange]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('notif-history-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        onUnreadCountChange?.((c) => (c as any) + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, onUnreadCountChange]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true } as any).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onUnreadCountChange?.(0);
  };

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true } as any).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const remaining = notifications.filter(n => !n.read && n.id !== id).length;
    onUnreadCountChange?.(remaining);
  };

  const deleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('notifications').delete().eq('id', id);
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    onUnreadCountChange?.(updated.filter(n => !n.read).length);
  };

  const deleteAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
    onUnreadCountChange?.(0);
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) await markOneRead(n.id);
    if (!onNavigateToMessage) return;
    if (n.data?.channel_id) {
      onNavigateToMessage(n.data.channel_id, n.data.message_id);
    } else if (n.data?.conversation_id) {
      onNavigateToMessage(n.data.conversation_id, n.data.message_id);
    }
  };

  const isNavigable = (n: Notification) => !!(onNavigateToMessage && (n.data?.channel_id || n.data?.conversation_id));

  const unreadCount = notifications.filter(n => !n.read).length;

  const availableTypes = useMemo(() => {
    const types = new Set(notifications.map(n => n.type));
    return Array.from(types);
  }, [notifications]);

  const filtered = useMemo(() => {
    let list = notifications;
    if (filter === 'unread') list = list.filter(n => !n.read);
    if (typeFilter !== 'all') list = list.filter(n => n.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q)
      );
    }
    return list;
  }, [notifications, filter, typeFilter, search]);

  const groupByDate = (notifs: Notification[]) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups: { label: string; items: Notification[] }[] = [
      { label: 'Bugün', items: [] },
      { label: 'Dün', items: [] },
      { label: 'Daha Eski', items: [] },
    ];
    for (const n of notifs) {
      const d = new Date(n.created_at); d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) groups[0].items.push(n);
      else if (d.getTime() === yesterday.getTime()) groups[1].items.push(n);
      else groups[2].items.push(n);
    }
    return groups.filter(g => g.items.length > 0);
  };

  const hasActiveFilters = typeFilter !== 'all' || search.trim().length > 0;

  return (
    <div className={`flex flex-col h-full bg-background ${isMobile ? 'w-full' : 'border-l border-border w-80 shrink-0'}`}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0 space-y-2">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-none">Bildirimler</h2>
              {unreadCount > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{unreadCount} okunmamış</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}
              className={`p-1.5 rounded-md transition-colors ${showSearch ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              title="Ara"
              data-testid="button-notif-search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`p-1.5 rounded-md transition-colors relative ${showFilters ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              title="Filtrele"
              data-testid="button-notif-filter"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {hasActiveFilters && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Tümünü okundu işaretle" data-testid="button-mark-all-read">
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={deleteAll} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Tümünü sil" data-testid="button-delete-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors" data-testid="button-close-notifs">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Bildirimlerde ara..."
              className="w-full bg-secondary/40 border border-border rounded-lg pl-8 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:bg-secondary/60 transition-colors"
              data-testid="input-notif-search"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Filter panel */}
        {showFilters && (
          <div className="space-y-2 p-2 bg-secondary/20 rounded-lg border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tür</p>
            <div className="flex flex-wrap gap-1">
              {(['all', ...availableTypes] as string[]).map(t => {
                const cfg = t === 'all' ? null : getTypeConfig(t);
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                      typeFilter === t
                        ? (cfg ? `${cfg.bg} ${cfg.color}` : 'bg-primary/15 text-primary')
                        : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'all' ? 'Tümü' : cfg?.label ?? t}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Read/Unread tabs */}
        <div className="flex gap-1 p-0.5 bg-secondary/30 rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${filter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            data-testid="tab-notif-all"
          >
            Tümü {notifications.length > 0 && <span className="opacity-60">({notifications.length})</span>}
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${filter === 'unread' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            data-testid="tab-notif-unread"
          >
            Okunmamış {unreadCount > 0 && <span className={filter === 'unread' ? 'text-primary font-bold' : 'opacity-60'}>({unreadCount})</span>}
          </button>
        </div>
      </div>

      {/* Search result hint */}
      {search.trim() && (
        <div className="px-3 py-1.5 bg-primary/5 border-b border-border/50 shrink-0">
          <p className="text-[10px] text-primary">
            "<span className="font-semibold">{search}</span>" için {filtered.length} sonuç bulundu
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground">Yükleniyor...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
              {search.trim() ? (
                <Search className="w-6 h-6 text-muted-foreground opacity-50" />
              ) : (
                <BellOff className="w-6 h-6 text-muted-foreground opacity-50" />
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">
              {search.trim()
                ? 'Sonuç bulunamadı'
                : filter === 'unread'
                ? 'Okunmamış bildirim yok'
                : 'Henüz bildirim yok'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {search.trim()
                ? 'Farklı anahtar kelimeler deneyin'
                : filter === 'unread'
                ? 'Tüm bildirimler okundu!'
                : 'Etiketlendiğinde veya mesaj aldığında burada görünür'}
            </p>
            {search.trim() && (
              <button onClick={() => setSearch('')} className="mt-3 text-xs text-primary hover:underline">
                Aramayı temizle
              </button>
            )}
          </div>
        ) : (
          <div className="pb-4">
            {groupByDate(filtered).map(group => (
              <div key={group.label}>
                <div className="px-3 py-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/60" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{group.label}</p>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="space-y-px">
                  {group.items.map(n => {
                    const nav = isNavigable(n);
                    const { icon: Icon, bg, color, label, bar } = getTypeConfig(n.type);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`group relative flex items-start gap-3 px-3 py-3 mx-1 rounded-xl transition-all ${!n.read ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-secondary/30'} ${nav ? 'cursor-pointer' : 'cursor-default'}`}
                        data-testid={`notification-item-${n.id}`}
                      >
                        {/* Unread bar */}
                        {!n.read && (
                          <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${bar}`} />
                        )}

                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>{label}</span>
                            {!n.read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${bar}`} />}
                          </div>
                          {/* Highlight search term in title */}
                          <p className={`text-xs font-semibold truncate ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {highlightText(n.title, search)}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                            {highlightText(n.body, search)}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[10px] text-muted-foreground/60">{getRelativeTime(n.created_at)}</p>
                            {nav && (
                              <span className={`text-[10px] flex items-center gap-0.5 transition-opacity ${color} opacity-0 group-hover:opacity-80`}>
                                Git <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover actions */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={e => { e.stopPropagation(); markOneRead(n.id); }}
                              className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Okundu işaretle"
                              data-testid={`button-mark-read-${n.id}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => deleteOne(n.id, e)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Sil"
                            data-testid={`button-delete-notif-${n.id}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {notifications.length > 0 && !loading && (
        <div className="px-3 py-2 border-t border-border/50 shrink-0">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            {notifications.length} bildirim • {unreadCount} okunmamış
          </p>
        </div>
      )}
    </div>
  );
};

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-foreground rounded px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default NotificationHistory;
