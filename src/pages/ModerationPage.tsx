import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, ArrowLeft, Flag, Users, BarChart3, Search, Check, X,
  Clock, CheckCircle2, XCircle, Crown, RefreshCw, Eye, Trash2,
  ShieldCheck, ShieldOff, ChevronDown, ChevronUp, MessageSquare,
  AlertTriangle, Zap, User, Filter, TrendingUp, Activity, Ban,
  Hash, Globe, UserX, Unlock, Radio, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const FOUNDER_EMAIL = 'asfurkan140@gmail.com';
const ACTIVE_PRESENCE_WINDOW_MS = 2 * 60 * 1000;

const REPORT_TYPE_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Taciz / Zorbalık',
  hate_speech: 'Nefret Söylemi',
  nsfw: 'Uygunsuz İçerik',
  misinformation: 'Yanlış Bilgi',
  other: 'Diğer',
};

const REPORT_TYPE_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  spam: { text: 'text-yellow-400', bg: 'bg-yellow-500/15', dot: 'bg-yellow-400' },
  harassment: { text: 'text-red-400', bg: 'bg-red-500/15', dot: 'bg-red-400' },
  hate_speech: { text: 'text-orange-400', bg: 'bg-orange-500/15', dot: 'bg-orange-400' },
  nsfw: { text: 'text-pink-400', bg: 'bg-pink-500/15', dot: 'bg-pink-400' },
  misinformation: { text: 'text-blue-400', bg: 'bg-blue-500/15', dot: 'bg-blue-400' },
  other: { text: 'text-muted-foreground', bg: 'bg-secondary', dot: 'bg-muted-foreground' },
};

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  message_id: string;
  message_content: string | null;
  channel_id: string | null;
  server_id: string | null;
  dm_conversation_id: string | null;
  report_type: string;
  reason: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolver_note: string | null;
  reporter?: { username: string; display_name: string; avatar_url?: string };
  reported_user?: { username: string; display_name: string; avatar_url?: string };
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string | null;
  last_seen?: string | null;
  active_session_last_seen?: string | null;
  has_premium_badge: boolean;
  is_app_admin: boolean;
  updated_at?: string;
  is_banned?: boolean;
  ban_reason?: string | null;
  banned_at?: string | null;
}

const isFreshPresence = (value?: string | null) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= ACTIVE_PRESENCE_WINDOW_MS;
};

const deriveLiveStatus = (profileStatus?: string | null, profileLastSeen?: string | null, sessionLastSeen?: string | null) => {
  const isActive = isFreshPresence(sessionLastSeen) || isFreshPresence(profileLastSeen);
  if (!isActive) return 'offline';
  if (profileStatus === 'idle' || profileStatus === 'dnd') return profileStatus;
  return 'online';
};

const ModerationPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const isAppAdmin = !!(profile as any)?.is_app_admin;
  const isFounder = user?.email === FOUNDER_EMAIL;

  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'stats'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [resolverNote, setResolverNote] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userFilter, setUserFilter] = useState<'all' | 'admins' | 'banned'>('all');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});

  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, users: 0, admins: 0, banned: 0 });

  const canAccess = isAppAdmin || isFounder;

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    let query = (supabase.from('message_reports') as any).select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (typeFilter !== 'all') query = query.eq('report_type', typeFilter);
    const { data, error } = await query;
    if (!error && data) {
      const reporterIds = [...new Set(data.map((r: Report) => r.reporter_id).filter(Boolean))];
      const reportedIds = [...new Set(data.map((r: Report) => r.reported_user_id).filter(Boolean))];
      const allIds = [...new Set([...reporterIds, ...reportedIds])];
      let profilesMap: Record<string, any> = {};
      if (allIds.length > 0) {
        const { data: profiles } = await (supabase.from('profiles') as any)
          .select('id, username, display_name, avatar_url').in('id', allIds);
        if (profiles) profiles.forEach((p: any) => { profilesMap[p.id] = p; });
      }
      setReports(data.map((r: Report) => ({
        ...r,
        reporter: profilesMap[r.reporter_id],
        reported_user: r.reported_user_id ? profilesMap[r.reported_user_id] : undefined,
      })));
    }
    setLoadingReports(false);
  }, [statusFilter, typeFilter]);

  const fetchStats = useCallback(async () => {
    const [
      { count: total },
      { count: pending },
      { count: approved },
      { count: rejected },
      { count: users },
    ] = await Promise.all([
      (supabase.from('message_reports') as any).select('*', { count: 'exact', head: true }),
      (supabase.from('message_reports') as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      (supabase.from('message_reports') as any).select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      (supabase.from('message_reports') as any).select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      (supabase.from('profiles') as any).select('*', { count: 'exact', head: true }),
    ]);
    let admins = 0;
    try {
      const { count, error } = await (supabase.from('profiles') as any)
        .select('*', { count: 'exact', head: true }).eq('is_app_admin', true);
      if (!error) admins = count || 0;
    } catch (_) {}
    let banned = 0;
    try {
      const { count, error } = await (supabase.from('account_bans') as any)
        .select('*', { count: 'exact', head: true }).eq('active', true);
      if (!error) banned = count || 0;
    } catch (_) {}
    setStats({ total: total || 0, pending: pending || 0, approved: approved || 0, rejected: rejected || 0, users: users || 0, admins, banned });
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    fetchReports();
    fetchStats();
  }, [canAccess, fetchReports, fetchStats]);

  const fetchUsers = useCallback(async () => {
    if (!canAccess) return;
    setLoadingUsers(true);
    const rawTerm = userSearch.trim().replace(/[,%()]/g, '');
    let query = (supabase.from('profiles') as any)
      .select('id, username, display_name, avatar_url, has_premium_badge, updated_at, status, last_seen, is_app_admin')
      .order('username', { ascending: true })
      .limit(250);

    if (rawTerm) {
      query = query.or(`username.ilike.%${rawTerm}%,display_name.ilike.%${rawTerm}%`);
    }
    if (userFilter === 'admins') {
      query = query.eq('is_app_admin', true);
    }

    const { data, error } = await query;
    if (error || !data) {
      setLoadingUsers(false);
      toast.error('Kullanıcılar yüklenemedi.');
      return;
    }

    const ids = data.map((u: any) => u.id);
    let banMap: Record<string, any> = {};
    let sessionMap: Record<string, string> = {};
    if (ids.length > 0) {
      try {
        const { data: bans } = await (supabase.from('account_bans') as any)
          .select('banned_user_id, reason, banned_at, active')
          .in('banned_user_id', ids)
          .eq('active', true);
        (bans || []).forEach((b: any) => { banMap[b.banned_user_id] = b; });
      } catch (_) {}
      try {
        const { data: sessions } = await (supabase.from('user_sessions') as any)
          .select('user_id, last_seen, is_active')
          .in('user_id', ids)
          .eq('is_active', true)
          .order('last_seen', { ascending: false });
        (sessions || []).forEach((s: any) => {
          if (!sessionMap[s.user_id] && s.last_seen) {
            sessionMap[s.user_id] = s.last_seen;
          }
        });
      } catch (_) {}
    }

    let mapped = data.map((u: any) => ({
      ...u,
      status: deriveLiveStatus(u.status, u.last_seen, sessionMap[u.id]),
      active_session_last_seen: sessionMap[u.id] || null,
      is_app_admin: !!u.is_app_admin,
      is_banned: !!banMap[u.id],
      ban_reason: banMap[u.id]?.reason || null,
      banned_at: banMap[u.id]?.banned_at || null,
    }));

    if (userFilter === 'banned') mapped = mapped.filter((u: UserProfile) => u.is_banned);
    setSearchResults(mapped);
    setLoadingUsers(false);
  }, [canAccess, userSearch, userFilter]);

  useEffect(() => {
    if (!canAccess || activeTab !== 'users') return;
    fetchUsers();
  }, [canAccess, activeTab, userFilter, fetchUsers]);

  useEffect(() => {
    if (!canAccess) return;
    const channel = supabase
      .channel('moderation_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reports' }, () => {
        fetchReports();
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_bans' }, () => {
        fetchUsers();
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => {
        fetchUsers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canAccess, fetchReports, fetchStats, fetchUsers]);

  const resolveReport = async (reportId: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    setResolvingId(reportId);
    const { error } = await (supabase.from('message_reports') as any).update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolver_note: resolverNote.trim() || null,
    }).eq('id', reportId);
    setResolvingId(null);
    if (error) {
      toast.error('Güncelleme başarısız.');
    } else {
      toast.success(status === 'approved' ? '✅ Bildirim onaylandı.' : '❌ Bildirim reddedildi.');
      setExpandedReport(null);
      setResolverNote('');
    }
  };

  const handleUserSearch = async () => fetchUsers();

  const toggleAdmin = async (userId: string, currentValue: boolean) => {
    if (!isFounder && !isAppAdmin) return;
    setUpdatingUser(userId);
    const { error } = await (supabase.from('profiles') as any)
      .update({ is_app_admin: !currentValue }).eq('id', userId);
    setUpdatingUser(null);
    if (error) { toast.error('Güncelleme başarısız.'); }
    else {
      toast.success(!currentValue ? '🛡️ Kullanıcıya admin yetkisi verildi.' : '🚫 Admin yetkisi kaldırıldı.');
      fetchUsers();
      fetchStats();
    }
  };

  const togglePremium = async (userId: string, currentValue: boolean) => {
    if (!isFounder) return;
    setUpdatingUser(userId);
    const { error } = await (supabase.from('profiles') as any)
      .update({ has_premium_badge: !currentValue }).eq('id', userId);
    setUpdatingUser(null);
    if (error) { toast.error('Güncelleme başarısız.'); }
    else {
      toast.success(!currentValue ? '💎 Premium verildi.' : '⬇️ Premium kaldırıldı.');
      fetchUsers();
    }
  };

  const banAccount = async (target: UserProfile) => {
    if (!isFounder || !user) return;
    const reason = (banReasons[target.id] || '').trim();
    if (!reason) {
      toast.error('Ban sebebi yazmalısın.');
      return;
    }
    setUpdatingUser(target.id);
    const { error } = await (supabase.from('account_bans') as any).insert({
      banned_user_id: target.id,
      banned_by: user.id,
      reason,
      active: true,
    });
    setUpdatingUser(null);
    if (error) {
      toast.error('Hesap banlanamadı.');
      return;
    }
    toast.success(`@${target.username} hesabı banlandı.`);
    setBanReasons(prev => ({ ...prev, [target.id]: '' }));
    fetchUsers();
    fetchStats();
  };

  const unbanAccount = async (target: UserProfile) => {
    if (!isFounder) return;
    setUpdatingUser(target.id);
    const { error } = await (supabase.from('account_bans') as any)
      .update({ active: false, lifted_at: new Date().toISOString(), lifted_by: user?.id || null })
      .eq('banned_user_id', target.id)
      .eq('active', true);
    setUpdatingUser(null);
    if (error) {
      toast.error('Ban kaldırılamadı.');
      return;
    }
    toast.success(`@${target.username} hesabının banı kaldırıldı.`);
    fetchUsers();
    fetchStats();
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const formatDateShort = (dateStr: string) => new Date(dateStr).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const getStatusMeta = (status?: string | null) => {
    const s = status || 'offline';
    if (s === 'online') return { label: 'Çevrimiçi', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (s === 'idle') return { label: 'Boşta', dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    if (s === 'dnd') return { label: 'Rahatsız Etmeyin', dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10' };
    return { label: 'Çevrimdışı', dot: 'bg-zinc-500', text: 'text-muted-foreground', bg: 'bg-secondary' };
  };

  if (!canAccess) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Erişim Reddedildi</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Bu sayfaya erişmek için AuroraChat Moderatör veya Kurucu yetkisine sahip olmanız gerekir.</p>
        <Button variant="outline" onClick={() => navigate('/')} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Ana Sayfaya Dön
        </Button>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, color, bg, trend }: { icon: any; label: string; value: number; color: string; bg: string; trend?: string }) => (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-16 h-16 ${bg} rounded-bl-3xl opacity-30`} />
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-foreground">{value.toLocaleString()}</p>
      {trend && <p className={`text-[10px] font-medium ${color}`}>{trend}</p>}
    </div>
  );

  const resolRate = stats.total > 0 ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100) : 0;
  const approveRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar shrink-0">
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-none flex items-center gap-1.5">
              AuroraChat Moderasyon
              {isFounder && <Crown className="w-3 h-3 text-yellow-400" />}
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isFounder ? '👑 Kurucu Paneli' : '🛡️ Moderatör Paneli'}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {stats.pending > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-bold animate-pulse flex items-center gap-1">
              <Activity className="w-3 h-3" /> {stats.pending} bekliyor
            </span>
          )}
          <button
            onClick={() => { fetchReports(); fetchStats(); }}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Yenile"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-sidebar shrink-0 px-2">
        {[
          { id: 'reports', label: 'Bildirimler', icon: Flag },
          { id: 'users', label: 'Kullanıcılar', icon: Users },
          { id: 'stats', label: 'İstatistikler', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {id === 'reports' && stats.pending > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] text-center">
                {stats.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="h-full flex flex-col">
            {/* Filters */}
            <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
              {/* Status filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3" /> Durum
                </span>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === 'all' ? 'Tümü' : s === 'pending' ? 'Bekleyen' : s === 'approved' ? 'Onaylanan' : 'Reddedilen'}
                  </button>
                ))}
              </div>
              {/* Type filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Flag className="w-3 h-3" /> Tür
                </span>
                {(['all', ...Object.keys(REPORT_TYPE_LABELS)] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      typeFilter === t
                        ? 'bg-primary/20 text-primary border border-primary/40'
                        : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'all' ? 'Tüm Türler' : REPORT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              {loadingReports ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
                    <Flag className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Bu kategoride bildirim yok</p>
                  <p className="text-xs text-muted-foreground/60">Filtrelerinizi değiştirmeyi deneyin</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => {
                    const tc = REPORT_TYPE_COLORS[report.report_type] || REPORT_TYPE_COLORS.other;
                    return (
                      <div
                        key={report.id}
                        className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-border/80"
                      >
                        <button
                          onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                          className="w-full flex items-start gap-3 p-3.5 text-left hover:bg-secondary/10 transition-colors"
                        >
                          {/* Type badge */}
                          <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                            <div className={`w-2 h-2 rounded-full ${tc.dot}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${tc.text} ${tc.bg}`}>
                                {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                @{report.reporter?.username || report.reporter_id.slice(0, 8)}
                              </span>
                              {report.reported_user && (
                                <>
                                  <span className="text-muted-foreground/40">→</span>
                                  <span className="text-xs font-medium text-destructive/80 flex items-center gap-0.5">
                                    <Ban className="w-2.5 h-2.5" />
                                    @{report.reported_user.username}
                                  </span>
                                </>
                              )}
                            </div>
                            {report.message_content && (
                              <p className="text-xs text-muted-foreground truncate max-w-[380px] italic">
                                "{report.message_content}"
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <Clock className="w-3 h-3 text-muted-foreground/40" />
                              <span className="text-[10px] text-muted-foreground/50">{formatDate(report.created_at)}</span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              report.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                              report.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                              'bg-red-500/15 text-red-400'
                            }`}>
                              {report.status === 'pending' ? '⏳ Bekliyor' : report.status === 'approved' ? '✅ Onaylandı' : '❌ Reddedildi'}
                            </span>
                            {expandedReport === report.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                        </button>

                        {expandedReport === report.id && (
                          <div className="border-t border-border p-4 space-y-3 bg-secondary/5">
                            {report.message_content && (
                              <div className="rounded-lg bg-secondary/40 border border-border p-3">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1.5 flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" /> Mesaj İçeriği
                                </p>
                                <p className="text-sm text-foreground break-words leading-relaxed">{report.message_content}</p>
                              </div>
                            )}
                            {report.reason && (
                              <div className="rounded-lg bg-secondary/20 p-3">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Bildirme Sebebi</p>
                                <p className="text-sm text-muted-foreground">{report.reason}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                              {report.channel_id && (
                                <div className="flex items-center gap-1">
                                  <Hash className="w-3 h-3" />
                                  <span>Kanal: {report.channel_id.slice(0, 10)}...</span>
                                </div>
                              )}
                              {report.server_id && (
                                <div className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  <span>Sunucu: {report.server_id.slice(0, 10)}...</span>
                                </div>
                              )}
                              {report.dm_conversation_id && (
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  <span>DM: {report.dm_conversation_id.slice(0, 10)}...</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                <span>Mesaj: {report.message_id.slice(0, 10)}...</span>
                              </div>
                            </div>
                            {report.status === 'pending' && (
                              <div className="space-y-2 pt-1">
                                <input
                                  type="text"
                                  value={resolverNote}
                                  onChange={(e) => setResolverNote(e.target.value)}
                                  placeholder="Moderatör notu (isteğe bağlı)..."
                                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                                    disabled={resolvingId === report.id}
                                    onClick={() => resolveReport(report.id, 'approved')}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Onayla
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1 rounded-xl"
                                    disabled={resolvingId === report.id}
                                    onClick={() => resolveReport(report.id, 'rejected')}
                                  >
                                    <XCircle className="w-4 h-4 mr-1.5" /> Reddet
                                  </Button>
                                </div>
                              </div>
                            )}
                            {report.status !== 'pending' && (
                              <div className="space-y-2">
                                {report.resolver_note && (
                                  <div className="rounded-lg bg-secondary/30 border border-border p-2.5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Moderatör Notu</p>
                                    <p className="text-xs text-muted-foreground">{report.resolver_note}</p>
                                  </div>
                                )}
                                {report.resolved_at && (
                                  <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {formatDate(report.resolved_at)} tarihinde çözümlendi
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border shrink-0 space-y-3 bg-gradient-to-r from-sidebar via-sidebar to-primary/5">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary" /> Kullanıcı Merkezi
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Kullanıcılar A-Z listelenir; durum, adminlik ve hesap banları gerçek zamanlı güncellenir.
                  </p>
                </div>
                <div className="flex gap-1 rounded-xl bg-secondary/50 p-1 border border-border">
                  {[
                    { id: 'all', label: 'Kullanıcılar' },
                    { id: 'admins', label: 'Adminler' },
                    { id: 'banned', label: 'Banlılar' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setUserFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        userFilter === f.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
                  placeholder="Kullanıcı adı veya görünen ad ile ara..."
                  className="flex-1 bg-input border-border rounded-xl"
                />
                <Button onClick={handleUserSearch} disabled={loadingUsers} size="sm" className="rounded-xl">
                  {loadingUsers ? (
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin yetkilendirme, premium yönetimi, canlı durum ve hesap ban yönetimi.
                {!isFounder && <span className="text-muted-foreground/60 ml-1">(Kurucuya özgü eylemler gizli)</span>}
              </p>
            </div>
            <ScrollArea className="flex-1 px-4 py-3">
              {loadingUsers && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
                    <Users className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Kullanıcı bulunamadı</p>
                  <p className="text-xs text-muted-foreground/60">Arama metnini veya filtreyi değiştirmeyi deneyin.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 items-start">
                  {searchResults.map((u) => {
                    const statusMeta = getStatusMeta(u.status);
                    const lastActivity = u.active_session_last_seen || u.last_seen;
                    return (
                    <div key={u.id} className={`self-start rounded-2xl border bg-card overflow-hidden transition-all hover:border-primary/40 ${u.is_banned ? 'border-destructive/40 shadow-[0_0_0_1px_rgba(239,68,68,0.08)]' : 'border-border'}`}>
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="relative w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card ${statusMeta.dot}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">{u.display_name || u.username}</span>
                            <span className="text-xs text-muted-foreground">@{u.username}</span>
                            {u.has_premium_badge && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold flex items-center gap-0.5">
                                💎 Premium
                              </span>
                            )}
                            {u.is_app_admin && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold flex items-center gap-0.5">
                                <Shield className="w-2.5 h-2.5" /> Admin
                              </span>
                            )}
                            {u.is_banned && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold flex items-center gap-0.5">
                                <UserX className="w-2.5 h-2.5" /> Banlı
                              </span>
                            )}
                            {u.id === user?.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">Sen</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${statusMeta.bg} ${statusMeta.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                              {statusMeta.label}
                            </span>
                            {lastActivity && (
                              <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Son aktivite: {formatDate(lastActivity)}
                              </span>
                            )}
                          </div>
                          {u.is_banned && (
                            <p className="text-[11px] text-destructive/80 mt-1 line-clamp-1">
                              Sebep: {u.ban_reason || 'Sebep belirtilmedi'}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {expandedUser === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {expandedUser === u.id && u.id !== user?.id && (
                        <div className="border-t border-border p-3 bg-secondary/5 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant={u.is_app_admin ? 'destructive' : 'outline'}
                              className="flex-1 text-xs h-8 rounded-lg"
                              disabled={updatingUser === u.id}
                              onClick={() => toggleAdmin(u.id, u.is_app_admin)}
                            >
                              {updatingUser === u.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                              ) : u.is_app_admin ? (
                                <><ShieldOff className="w-3.5 h-3.5 mr-1" /> Admin Yetkisini Kaldır</>
                              ) : (
                                <><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Admin Yap</>
                              )}
                            </Button>
                            {isFounder && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={`flex-1 text-xs h-8 rounded-lg ${u.has_premium_badge ? 'text-orange-400 border-orange-400/30 hover:bg-orange-500/10' : 'text-primary border-primary/30 hover:bg-primary/10'}`}
                                disabled={updatingUser === u.id}
                                onClick={() => togglePremium(u.id, u.has_premium_badge)}
                              >
                                {u.has_premium_badge ? '⬇️ Premiumu Kaldır' : '💎 Premium Ver'}
                              </Button>
                            )}
                          </div>
                          {isFounder && (
                            <div className={`rounded-xl border p-3 space-y-2 ${u.is_banned ? 'border-destructive/25 bg-destructive/5' : 'border-border bg-background/40'}`}>
                              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> Hesap Ban Yönetimi
                              </p>
                              {u.is_banned ? (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">
                                    Bu kullanıcı giriş yapamaz. Sebep: <span className="text-destructive">{u.ban_reason || 'Sebep belirtilmedi'}</span>
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-8 rounded-lg text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                    disabled={updatingUser === u.id}
                                    onClick={() => unbanAccount(u)}
                                  >
                                    <Unlock className="w-3.5 h-3.5 mr-1" /> Banı Kaldır
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Input
                                    value={banReasons[u.id] || ''}
                                    onChange={(e) => setBanReasons(prev => ({ ...prev, [u.id]: e.target.value }))}
                                    placeholder="Ban sebebi yaz..."
                                    className="h-8 rounded-lg text-xs bg-input"
                                  />
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="w-full h-8 rounded-lg text-xs"
                                    disabled={updatingUser === u.id}
                                    onClick={() => banAccount(u)}
                                  >
                                    <UserX className="w-3.5 h-3.5 mr-1" /> Hesabı Banla
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground/60">ID: {u.id}</p>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <ScrollArea className="h-full px-4 py-4">
            <div className="space-y-5 max-w-2xl">
              {/* Stat cards grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard icon={Flag} label="Toplam Bildirim" value={stats.total} color="text-primary" bg="bg-primary/10" />
                <StatCard icon={AlertTriangle} label="Bekleyen" value={stats.pending} color="text-yellow-400" bg="bg-yellow-500/10" trend={stats.pending > 0 ? `${stats.pending} çözüm bekliyor` : 'Bekleyen yok ✓'} />
                <StatCard icon={CheckCircle2} label="Onaylanan" value={stats.approved} color="text-emerald-400" bg="bg-emerald-500/10" />
                <StatCard icon={XCircle} label="Reddedilen" value={stats.rejected} color="text-red-400" bg="bg-red-500/10" />
                <StatCard icon={Users} label="Toplam Kullanıcı" value={stats.users} color="text-blue-400" bg="bg-blue-500/10" />
                <StatCard icon={Shield} label="Moderatörler" value={stats.admins} color="text-violet-400" bg="bg-violet-500/10" />
                <StatCard icon={UserX} label="Banlı Hesap" value={stats.banned} color="text-red-400" bg="bg-red-500/10" />
              </div>

              {/* Resolution chart */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Çözüm Oranları
                </p>
                {stats.total > 0 ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Onaylama oranı</span>
                        <span className="font-bold text-emerald-400">{approveRate}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${approveRate}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Çözümlenme oranı</span>
                        <span className="font-bold text-primary">{resolRate}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${resolRate}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Bekleyen oran</span>
                        <span className="font-bold text-yellow-400">{stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 rounded-full transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Henüz bildirim yok.</p>
                )}
              </div>

              {/* Report type breakdown */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Bildirim Türleri
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(REPORT_TYPE_LABELS).map(([key, label]) => {
                    const tc = REPORT_TYPE_COLORS[key];
                    return (
                      <div key={key} className={`flex items-center gap-2 p-2.5 rounded-xl ${tc.bg} border border-border/30`}>
                        <div className={`w-2 h-2 rounded-full ${tc.dot} shrink-0`} />
                        <span className={`text-xs font-medium ${tc.text}`}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick info */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Hızlı Bilgiler
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Toplam Kullanıcı</span>
                    <span className="font-bold text-foreground">{stats.users.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Moderatörler</span>
                    <span className="font-bold text-foreground">{stats.admins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aktif Hesap Banı</span>
                    <span className="font-bold text-destructive">{stats.banned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Çözümlenmiş Bildirimler</span>
                    <span className="font-bold text-foreground">{stats.approved + stats.rejected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mevcut Durum</span>
                    <span className={`font-bold ${stats.pending > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {stats.pending > 0 ? `${stats.pending} bekliyor` : 'Temiz ✓'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default ModerationPage;
