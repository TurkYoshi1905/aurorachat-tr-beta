import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePresenceKeeper } from '@/hooks/usePresenceKeeper';
import { toast } from 'sonner';
import { getHighestPermissions } from '@/lib/permissions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Settings, Users, Shield, ScrollText, Trash2, Camera, UserMinus, Plus, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Hash, Volume2, SmilePlus, Upload, Pencil, Check, Ban, BarChart3, Filter, Palette, ArrowLeft, Clock, Bell, LogOut, Crown, UserCog, Search, RefreshCw, Calendar, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Member { id: string; user_id: string; display_name: string; username: string; avatar_url: string | null; joined_at: string | null; roles: { id: string; name: string; color: string }[]; }
interface Role { id: string; name: string; color: string; position: number; permissions: Record<string, boolean>; }
interface AuditLog { id: string; action: string; user_id: string; target_type: string | null; target_id?: string | null; details: any; created_at: string; user_name?: string; user_avatar?: string | null; target_name?: string | null; target_avatar?: string | null; }
interface ServerEmoji { id: string; name: string; image_url: string; uploaded_by: string; created_at: string; }
interface BanEntry { id: string; user_id: string; banned_by: string; reason: string | null; created_at: string; user_name?: string; user_avatar?: string | null; banned_by_name?: string; }

const PRESET_COLORS = ['#E74C3C', '#E91E63', '#9B59B6', '#8E44AD', '#3498DB', '#2196F3', '#1ABC9C', '#2ECC71', '#F1C40F', '#FF9800', '#E67E22', '#95A5A6', '#607D8B', '#99AAB5'];
const MAX_EMOJIS = 50;

const PERMISSION_CATEGORIES = [
  { label: 'Genel', permissions: [
    { key: 'administrator', label: 'Yönetici', description: 'Tüm yetkilere sahip olur' },
    { key: 'manage_server', label: 'Sunucuyu Yönet', description: 'Sunucu adını ve ikonunu değiştirebilir' },
    { key: 'manage_channels', label: 'Kanalları Yönet', description: 'Kanal oluşturabilir, düzenleyebilir ve silebilir' },
    { key: 'manage_roles', label: 'Rolleri Yönet', description: 'Rol oluşturabilir ve düzenleyebilir' },
    { key: 'manage_emojis', label: 'Emoji Yönetimi', description: 'Özel emoji yükleyebilir ve silebilir' },
  ]},
  { label: 'Üye', permissions: [
    { key: 'kick_members', label: 'Üyeleri At', description: 'Sunucudan üye atabilir' },
    { key: 'ban_members', label: 'Üyeleri Yasakla', description: 'Sunucudan üye yasaklayabilir' },
  ]},
  { label: 'Metin', permissions: [
    { key: 'send_messages', label: 'Mesaj Gönder', description: 'Kanallarda mesaj gönderebilir' },
    { key: 'manage_messages', label: 'Mesajları Yönet', description: 'Başkalarının mesajlarını silebilir' },
    { key: 'pin_messages', label: 'Mesaj Sabitle', description: 'Mesajları sabitleyebilir' },
    { key: 'mention_everyone', label: '@everyone Etiketle', description: 'Herkesi etiketleyebilir' },
    { key: 'attach_files', label: 'Dosya Ekle', description: 'Dosya ve resim yükleyebilir' },
  ]},
];

const ServerSettings = () => {
  const { user } = useAuth();
  usePresenceKeeper(user?.id);
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(() => isMobile ? '__menu__' : 'general');
  const [serverName, setServerName] = useState('');
  const [serverIcon, setServerIcon] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#3498DB');
  const [hexInput, setHexInput] = useState('#3498DB');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [renamingRoleId, setRenamingRoleId] = useState<string | null>(null);
  const [renamingRoleVal, setRenamingRoleVal] = useState('');
  const [roleActiveTab, setRoleActiveTab] = useState<Record<string, 'permissions' | 'members' | 'display'>>({});
  const [roleGradients, setRoleGradients] = useState<Record<string, { enabled: boolean; endColor: string }>>({});

  const saveRoleGradient = async (roleId: string, config: { enabled: boolean; endColor: string }) => {
    const updated = { ...roleGradients, [roleId]: config };
    setRoleGradients(updated);
    // Save to Supabase permissions column so all members can see gradient
    const role = roles.find(r => r.id === roleId);
    if (role) {
      const newPerms = { ...(role.permissions || {}), gradient_end_color: config.enabled ? config.endColor : null };
      await supabase.from('server_roles').update({ permissions: newPerms } as any).eq('id', roleId);
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: newPerms } : r));
    }
  };
  const [loadingMembers, setLoadingMembers] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Emoji state
  const [emojis, setEmojis] = useState<ServerEmoji[]>([]);
  const [emojiName, setEmojiName] = useState('');
  const [emojiFile, setEmojiFile] = useState<File | null>(null);
  const [emojiUploading, setEmojiUploading] = useState(false);
  const [editingEmojiId, setEditingEmojiId] = useState<string | null>(null);
  const [editingEmojiName, setEditingEmojiName] = useState('');
  const [selectedEmojis, setSelectedEmojis] = useState<Set<string>>(new Set());
  const emojiFileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<{ id: string; name: string; position: number }[]>([]);
  const [channelsList, setChannelsList] = useState<{ id: string; name: string; type: string; position: number; category_id: string | null; slow_mode_interval?: number }[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [newChannelCategory, setNewChannelCategory] = useState<string>('');
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSortBy, setMemberSortBy] = useState<'name' | 'joined'>('joined');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('all');
  const [memberExpandedRoles, setMemberExpandedRoles] = useState<Set<string>>(new Set());
  const [auditSearch, setAuditSearch] = useState('');
  const [serverStats, setServerStats] = useState<{ members: number; channels: number; roles: number; created_at: string } | null>(null);
  // Kick/ban confirm modal state
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; memberId: string; userId: string; memberName: string; reason: string } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  // Welcome message state
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeChannelId, setWelcomeChannelId] = useState<string>('');
  // Leave message state
  const [leaveEnabled, setLeaveEnabled] = useState(false);
  const [leaveMessage, setLeaveMessage] = useState('');
  const [leaveChannelId, setLeaveChannelId] = useState<string>('');
  // Word filter state
  const [wordFilter, setWordFilter] = useState<string[]>([]);
  const [wordFilterInput, setWordFilterInput] = useState('');
  // User's own permissions in this server
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

  const tabs = [
    { id: 'general', label: t('serverSettings.general'), icon: Settings },
    { id: 'channels', label: 'Kanallar', icon: Hash },
    { id: 'emojis', label: 'Emojiler', icon: SmilePlus },
    { id: 'roles', label: t('serverSettings.rolesTab') || 'Roller', icon: Shield },
    { id: 'members', label: t('serverSettings.membersTab'), icon: Users },
    { id: 'bans', label: 'Yasaklar', icon: Ban },
    { id: 'filter', label: 'Kelime Filtresi', icon: Filter },
    { id: 'audit', label: t('serverSettings.auditTab') || 'Denetim Kaydı', icon: ScrollText },
    { id: 'danger', label: t('serverSettings.dangerZone'), icon: Trash2 },
  ];

  const fetchChannelsAndCategories = useCallback(async () => {
    if (!serverId) return;
    const { data: cats } = await supabase.from('channel_categories').select('*').eq('server_id', serverId).order('position');
    const { data: chs } = await supabase.from('channels').select('*').eq('server_id', serverId).order('position');
    if (cats) setCategories(cats as any);
    if (chs) setChannelsList((chs as any[]).map(c => ({ id: c.id, name: c.name, type: c.type, position: c.position, category_id: c.category_id || null, slow_mode_interval: c.slow_mode_interval || 0 })));
  }, [serverId]);

  useEffect(() => { if (activeTab === 'channels' || activeTab === 'general') fetchChannelsAndCategories(); }, [activeTab, fetchChannelsAndCategories]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !serverId) return;
    await supabase.from('channel_categories').insert({ server_id: serverId, name: newCategoryName.trim(), position: categories.length });
    setNewCategoryName('');
    fetchChannelsAndCategories();
  };

  const handleDeleteCategory = async (catId: string) => {
    await supabase.from('channel_categories').delete().eq('id', catId);
    fetchChannelsAndCategories();
  };

  const handleDeleteChannel = async (channelId: string) => {
    await supabase.from('channels').delete().eq('id', channelId);
    fetchChannelsAndCategories();
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !serverId) return;
    await supabase.from('channels').insert({
      server_id: serverId,
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      type: newChannelType,
      position: channelsList.length,
      category_id: newChannelCategory || null,
    } as any);
    setNewChannelName('');
    fetchChannelsAndCategories();
    toast.success('Kanal oluşturuldu!');
  };

  const handleMoveChannel = async (channelId: string, direction: 'up' | 'down') => {
    const idx = channelsList.findIndex(c => c.id === channelId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= channelsList.length) return;
    await supabase.from('channels').update({ position: channelsList[swapIdx].position } as any).eq('id', channelsList[idx].id);
    await supabase.from('channels').update({ position: channelsList[idx].position } as any).eq('id', channelsList[swapIdx].id);
    fetchChannelsAndCategories();
  };

  const handleUpdateSlowMode = async (channelId: string, interval: number) => {
    await supabase.from('channels').update({ slow_mode_interval: interval } as any).eq('id', channelId);
    setChannelsList(prev => prev.map(c => c.id === channelId ? { ...c, slow_mode_interval: interval } : c));
    toast.success('Yavaş mod güncellendi');
  };

  const handleSaveWelcome = async () => {
    if (!serverId) return;
    await supabase.from('servers').update({
      welcome_enabled: welcomeEnabled,
      welcome_message: welcomeMessage,
      welcome_channel_id: welcomeChannelId || null,
    } as any).eq('id', serverId);
    toast.success('Hoş geldin ayarları kaydedildi');
  };

  const handleSaveLeave = async () => {
    if (!serverId) return;
    await supabase.from('servers').update({
      leave_enabled: leaveEnabled,
      leave_message: leaveMessage,
      leave_channel_id: leaveChannelId || null,
    } as any).eq('id', serverId);
    toast.success('Çıkış mesajı ayarları kaydedildi');
  };

  const handleAddFilterWords = async () => {
    if (!wordFilterInput.trim()) return;
    const newWords = wordFilterInput.split(',').map(w => w.trim().toLowerCase()).filter(w => w && !wordFilter.includes(w));
    const updated = [...wordFilter, ...newWords];
    setWordFilter(updated);
    setWordFilterInput('');
    if (serverId) {
      const { error } = await supabase.from('servers').update({ word_filter: updated } as any).eq('id', serverId);
      if (error) toast.error('Kelime filtresi kaydedilemedi');
      else toast.success('Kelime filtresi güncellendi');
    }
  };

  const handleRemoveFilterWord = async (word: string) => {
    const updated = wordFilter.filter(w => w !== word);
    setWordFilter(updated);
    if (serverId) {
      await supabase.from('servers').update({ word_filter: updated } as any).eq('id', serverId);
    }
  };

  useEffect(() => {
    if (!serverId) return;
    const fetchServer = async () => {
      const { data } = await supabase.from('servers').select('*').eq('id', serverId).single();
      if (data) {
        setServerName(data.name);
        setServerIcon(data.icon);
        setOwnerId(data.owner_id);
        setWelcomeEnabled((data as any).welcome_enabled || false);
        setWelcomeMessage((data as any).welcome_message || '');
        setWelcomeChannelId((data as any).welcome_channel_id || '');
        setLeaveEnabled((data as any).leave_enabled || false);
        setLeaveMessage((data as any).leave_message || '');
        setLeaveChannelId((data as any).leave_channel_id || '');
        setWordFilter((data as any).word_filter || []);
      }
      else navigate('/');
    };
    fetchServer();
  }, [serverId]);

  const fetchUserPermissions = useCallback(async () => {
    if (!serverId || !user) return;
    const { data: member } = await supabase
      .from('server_members').select('id').eq('server_id', serverId).eq('user_id', user.id).maybeSingle();
    if (!member) return;
    const { data: memberRoles } = await supabase
      .from('server_member_roles').select('role_id').eq('member_id', member.id);
    if (!memberRoles || memberRoles.length === 0) { setUserPermissions({}); return; }
    const roleIds = memberRoles.map((r: any) => r.role_id);
    const { data: rolePerms } = await supabase.from('server_roles').select('permissions').in('id', roleIds);
    if (rolePerms) {
      const merged = getHighestPermissions(rolePerms.map((r: any) => ({ permissions: r.permissions })));
      setUserPermissions(merged);
    }
  }, [serverId, user]);

  const fetchRoles = useCallback(async () => {
    if (!serverId) return;
    const { data } = await supabase.from('server_roles').select('*').eq('server_id', serverId).order('position', { ascending: false });
    if (data) {
      const mapped = data.map((r: any) => ({ ...r, permissions: r.permissions || {} }));
      setRoles(mapped);
      // Initialize roleGradients from Supabase data
      const gradients: Record<string, { enabled: boolean; endColor: string }> = {};
      mapped.forEach((r: any) => {
        const endColor = r.permissions?.gradient_end_color;
        if (endColor) gradients[r.id] = { enabled: true, endColor };
      });
      setRoleGradients(gradients);
    }
  }, [serverId]);

  const handleUpdatePermission = async (roleId: string, permKey: string, value: boolean) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    // If toggling administrator on, set all perms to true
    let newPerms: Record<string, boolean>;
    if (permKey === 'administrator' && value) {
      newPerms = { ...role.permissions };
      PERMISSION_CATEGORIES.forEach(cat => cat.permissions.forEach(p => { newPerms[p.key] = true; }));
    } else if (permKey === 'administrator' && !value) {
      newPerms = { ...role.permissions, administrator: false };
    } else {
      newPerms = { ...role.permissions, [permKey]: value };
    }
    const { error } = await supabase.from('server_roles').update({ permissions: newPerms } as any).eq('id', roleId);
    if (!error) {
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: newPerms } : r));
      if (editingRole?.id === roleId) setEditingRole({ ...editingRole, permissions: newPerms });
    }
  };

  // Emoji functions
  const fetchEmojis = useCallback(async () => {
    if (!serverId) return;
    const { data } = await supabase.from('server_emojis').select('*').eq('server_id', serverId).order('created_at', { ascending: true });
    if (data) setEmojis(data as any);
  }, [serverId]);

  useEffect(() => { if (activeTab === 'emojis') fetchEmojis(); }, [activeTab, fetchEmojis]);

  const resizeImage = (file: File, w: number, h: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Blob creation failed'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleEmojiUpload = async () => {
    if (!emojiFile || !emojiName.trim() || !serverId || !user) return;
    if (emojis.length >= MAX_EMOJIS) { toast.error(`Maksimum ${MAX_EMOJIS} emoji yükleyebilirsiniz`); return; }
    if (!emojiFile.type.startsWith('image/')) { toast.error('Lütfen bir resim dosyası seçin'); return; }
    const sizeLimit = emojiFile.type === 'image/gif' ? 512 * 1024 : 256 * 1024;
    const sizeLimitLabel = emojiFile.type === 'image/gif' ? '512KB' : '256KB';
    if (emojiFile.size > sizeLimit) { toast.error(`Emoji dosyası ${sizeLimitLabel}'dan küçük olmalı`); return; }

    setEmojiUploading(true);

    const isGif = emojiFile.type === 'image/gif';
    const ext = isGif ? 'gif' : 'png';
    const contentType = isGif ? 'image/gif' : 'image/png';

    let uploadBlob: Blob;
    if (isGif) {
      // GIF animasyonunu korumak için canvas'a çizmeden doğrudan yükle
      uploadBlob = emojiFile;
    } else {
      try {
        uploadBlob = await resizeImage(emojiFile, 64, 64);
      } catch {
        toast.error('Görsel optimize edilemedi');
        setEmojiUploading(false);
        return;
      }
    }

    const emojiId = crypto.randomUUID();
    const path = `${user.id}/servers/${serverId}/emojis/${emojiId}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, uploadBlob, { upsert: true, contentType });
    if (uploadError) { toast.error('Yükleme başarısız'); setEmojiUploading(false); return; }
    
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const cleanName = emojiName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    const { error } = await supabase.from('server_emojis').insert({
      server_id: serverId,
      name: cleanName,
      image_url: urlData.publicUrl,
      uploaded_by: user.id,
    } as any);
    
    setEmojiUploading(false);
    if (error) {
      if (error.code === '23505') toast.error('Bu isimde bir emoji zaten var');
      else toast.error('Emoji eklenemedi');
    } else {
      toast.success(`${cleanName} emojisi eklendi!`);
      setEmojiName('');
      setEmojiFile(null);
      if (emojiFileInputRef.current) emojiFileInputRef.current.value = '';
      fetchEmojis();
    }
  };

  const handleDeleteEmoji = async (emojiId: string) => {
    await supabase.from('server_emojis').delete().eq('id', emojiId);
    fetchEmojis();
  };

  const handleBulkDeleteEmojis = async () => {
    if (selectedEmojis.size === 0) return;
    for (const id of selectedEmojis) {
      await supabase.from('server_emojis').delete().eq('id', id);
    }
    setSelectedEmojis(new Set());
    fetchEmojis();
    toast.success(`${selectedEmojis.size} emoji silindi`);
  };

  const handleRenameEmoji = async (emojiId: string) => {
    if (!editingEmojiName.trim()) return;
    const cleanName = editingEmojiName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const { error } = await supabase.from('server_emojis').update({ name: cleanName } as any).eq('id', emojiId);
    if (error) {
      if (error.code === '23505') toast.error('Bu isimde bir emoji zaten var');
      else toast.error('İsim değiştirilemedi');
    } else {
      setEditingEmojiId(null);
      fetchEmojis();
    }
  };

  const toggleEmojiSelection = (id: string) => {
    setSelectedEmojis(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fetchMembers = useCallback(async () => {
    if (!serverId) return;
    setLoadingMembers(true);
    const { data: memberRows } = await supabase.from('server_members').select('id, user_id, joined_at').eq('server_id', serverId);
    if (!memberRows) { setLoadingMembers(false); return; }
    const userIds = memberRows.map(m => m.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', userIds);
    const memberIds = memberRows.map(m => m.id);
    const { data: memberRoles } = await supabase.from('server_member_roles').select('member_id, role_id').in('member_id', memberIds);
    const { data: allRoles } = await supabase.from('server_roles').select('id, name, color').eq('server_id', serverId);

    setMembers(memberRows.map(m => {
      const p = (profiles as any[])?.find((pr: any) => pr.id === m.user_id);
      const userMemberRoles = (memberRoles as any[])?.filter((mr: any) => mr.member_id === m.id).map((mr: any) => mr.role_id) || [];
      const userRoles = (allRoles as any[])?.filter((r: any) => userMemberRoles.includes(r.id)).map((r: any) => ({ id: r.id, name: r.name, color: r.color })) || [];
      return { id: m.id, user_id: m.user_id, display_name: p?.display_name || 'Kullanıcı', username: p?.username || '', avatar_url: p?.avatar_url || null, joined_at: (m as any).joined_at || null, roles: userRoles };
    }));
    setLoadingMembers(false);
  }, [serverId]);

  const fetchAuditLogs = useCallback(async () => {
    if (!serverId) return;
    const { data } = await supabase.from('audit_logs').select('*').eq('server_id', serverId).order('created_at', { ascending: false }).limit(200);
    if (data) {
      const performerIds = [...new Set((data as any[]).map(l => l.user_id).filter(Boolean))];
      const targetIds = [...new Set((data as any[]).filter(l => l.target_type === 'member' && l.target_id).map(l => l.target_id).filter(Boolean))];
      const allIds = [...new Set([...performerIds, ...targetIds])];
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', allIds);
      const findProfile = (id: string) => (profiles as any[])?.find((p: any) => p.id === id);
      setAuditLogs((data as any[]).map(l => ({
        ...l,
        user_name: findProfile(l.user_id)?.display_name || 'Kullanıcı',
        user_avatar: findProfile(l.user_id)?.avatar_url || null,
        target_name: l.target_id ? (findProfile(l.target_id)?.display_name || l.details?.name || null) : (l.details?.name || null),
        target_avatar: l.target_id ? (findProfile(l.target_id)?.avatar_url || null) : null,
      })));
    }
  }, [serverId]);

  const fetchBans = useCallback(async () => {
    if (!serverId) return;
    const { data } = await supabase.from('server_bans').select('*').eq('server_id', serverId).order('created_at', { ascending: false });
    if (data) {
      const userIds = [...new Set((data as any[]).flatMap(b => [b.user_id, b.banned_by]))];
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
      setBans((data as any[]).map(b => ({
        ...b,
        user_name: (profiles as any[])?.find((p: any) => p.id === b.user_id)?.display_name || 'Kullanıcı',
        user_avatar: (profiles as any[])?.find((p: any) => p.id === b.user_id)?.avatar_url || null,
        banned_by_name: (profiles as any[])?.find((p: any) => p.id === b.banned_by)?.display_name || 'Kullanıcı',
      })));
    }
  }, [serverId]);

  const fetchServerStats = useCallback(async () => {
    if (!serverId) return;
    const [{ count: memberCount }, { count: channelCount }, { count: roleCount }, { data: server }] = await Promise.all([
      supabase.from('server_members').select('*', { count: 'exact', head: true }).eq('server_id', serverId),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('server_id', serverId),
      supabase.from('server_roles').select('*', { count: 'exact', head: true }).eq('server_id', serverId),
      supabase.from('servers').select('created_at').eq('id', serverId).single(),
    ]);
    setServerStats({ members: memberCount || 0, channels: channelCount || 0, roles: roleCount || 0, created_at: server?.created_at || '' });
  }, [serverId]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);
  useEffect(() => { fetchUserPermissions(); }, [fetchUserPermissions]);
  useEffect(() => { if (activeTab === 'members') fetchMembers(); }, [activeTab, fetchMembers]);
  useEffect(() => { if (activeTab === 'audit') fetchAuditLogs(); }, [activeTab, fetchAuditLogs]);
  useEffect(() => { if (activeTab === 'bans') fetchBans(); }, [activeTab, fetchBans]);
  useEffect(() => { if (activeTab === 'general') fetchServerStats(); }, [activeTab, fetchServerStats]);

  // Realtime: refresh roles/permissions when server_roles change for this server
  // (server_member_roles is already handled by the global channel in Index.tsx)
  useEffect(() => {
    if (!serverId || !user) return;
    const ch = supabase
      .channel(`server-settings-roles-${serverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_roles', filter: `server_id=eq.${serverId}` }, () => { fetchUserPermissions(); fetchRoles(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [serverId, user, fetchUserPermissions, fetchRoles]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (window.history.length > 1) navigate(-1); else navigate('/'); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  const isOwner = ownerId === user?.id;
  const isAdmin = !!(userPermissions?.administrator);
  const canManageServer = isOwner || isAdmin || !!(userPermissions?.manage_server);
  const canManageChannels = isOwner || isAdmin || !!(userPermissions?.manage_channels);
  const canManageRoles = isOwner || isAdmin || !!(userPermissions?.manage_roles);
  const canManageEmojis = isOwner || isAdmin || !!(userPermissions?.manage_emojis);
  const canKickMembers = isOwner || isAdmin || !!(userPermissions?.kick_members);
  const canBanMembers = isOwner || isAdmin || !!(userPermissions?.ban_members);

  const handleSave = async () => {
    if (!serverName.trim() || !serverId) return;
    setSaving(true);
    const { error } = await supabase.from('servers').update({ name: serverName.trim(), icon: serverIcon }).eq('id', serverId);
    setSaving(false);
    if (error) toast.error(t('serverSettings.saveFailed'));
    else toast.success(t('serverSettings.saved'));
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !serverId) return;
    if (!file.type.startsWith('image/')) { toast.error(t('serverSettings.selectImage')); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t('serverSettings.fileTooLarge')); return; }
    const ext = file.name.split('.').pop();
    const path = `${user.id}/servers/${serverId}/icon.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast.error(t('serverSettings.uploadFailed')); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    setServerIcon(urlData.publicUrl + '?t=' + Date.now());
    toast.success(t('serverSettings.iconUploaded'));
  };

  const handleDelete = async () => {
    if (!serverId) return;
    setDeleting(true);
    const { error } = await supabase.from('servers').delete().eq('id', serverId);
    setDeleting(false);
    if (error) toast.error(t('serverSettings.deleteFailed'));
    else { toast.success(t('serverSettings.deleted')); navigate('/'); }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim() || !serverId) return;
    const { error } = await supabase.from('server_roles').insert({ server_id: serverId, name: newRoleName.trim(), color: newRoleColor, position: roles.length });
    if (!error) {
      setNewRoleName('');
      fetchRoles();
      if (user) await supabase.from('audit_logs').insert({ server_id: serverId, user_id: user.id, action: 'role_created', target_type: 'role', details: { name: newRoleName.trim(), color: newRoleColor } });
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const { error } = await supabase.from('server_roles').delete().eq('id', roleId);
    if (!error) fetchRoles();
  };

  const handleMoveRole = async (roleId: string, direction: 'up' | 'down') => {
    const idx = roles.findIndex(r => r.id === roleId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= roles.length) return;
    await supabase.from('server_roles').update({ position: roles[swapIdx].position }).eq('id', roles[idx].id);
    await supabase.from('server_roles').update({ position: roles[idx].position }).eq('id', roles[swapIdx].id);
    fetchRoles();
  };

  const handleRenameRole = async (roleId: string) => {
    if (!renamingRoleVal.trim()) return;
    const { error } = await supabase.from('server_roles').update({ name: renamingRoleVal.trim() }).eq('id', roleId);
    if (!error) {
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, name: renamingRoleVal.trim() } : r));
      if (editingRole?.id === roleId) setEditingRole(prev => prev ? { ...prev, name: renamingRoleVal.trim() } : null);
      toast.success('Rol adı güncellendi');
    }
    setRenamingRoleId(null);
    setRenamingRoleVal('');
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    if (!serverId) return;
    const { data: member } = await supabase.from('server_members').select('id').eq('server_id', serverId).eq('user_id', userId).single();
    if (!member) return;
    const { error } = await supabase.from('server_member_roles').insert({ member_id: member.id, role_id: roleId } as any);
    if (!error) {
      fetchMembers();
      if (user) await supabase.from('audit_logs').insert({ server_id: serverId, user_id: user.id, action: 'role_assigned', target_type: 'member', target_id: userId, details: { role_id: roleId } });
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    if (!serverId) return;
    const { data: member } = await supabase.from('server_members').select('id').eq('server_id', serverId).eq('user_id', userId).single();
    if (!member) return;
    await supabase.from('server_member_roles').delete().eq('member_id', member.id).eq('role_id', roleId);
    fetchMembers();
  };

  const openKickConfirm = (memberId: string, userId: string, memberName: string) => {
    if (userId === user?.id) { toast.error(t('serverSettings.cantKickSelf')); return; }
    setConfirmAction({ type: 'kick', memberId, userId, memberName, reason: '' });
  };

  const openBanConfirm = (memberId: string, userId: string, memberName: string) => {
    if (userId === user?.id) { toast.error('Kendinizi yasaklayamazsınız'); return; }
    setConfirmAction({ type: 'ban', memberId, userId, memberName, reason: '' });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !serverId || !user) return;
    setConfirmLoading(true);
    const { type, memberId, userId, reason } = confirmAction;
    if (type === 'kick') {
      const { error } = await supabase.from('server_members').delete().eq('id', memberId);
      if (error) { toast.error(t('serverSettings.kickFailed')); setConfirmLoading(false); return; }
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success(t('serverSettings.kicked'));
      await supabase.from('audit_logs').insert({ server_id: serverId, user_id: user.id, action: 'member_kicked', target_type: 'member', target_id: userId, details: { reason: reason || null } });
      const notifChannel = supabase.channel(`user-actions:${userId}`);
      await notifChannel.subscribe();
      await notifChannel.send({ type: 'broadcast', event: 'member-kicked', payload: { server_id: serverId } });
      supabase.removeChannel(notifChannel);
    } else {
      const { error: banError } = await supabase.from('server_bans').insert({ server_id: serverId, user_id: userId, banned_by: user.id, reason: reason || null } as any);
      if (banError) { toast.error('Yasaklama başarısız'); setConfirmLoading(false); return; }
      const { error: kickError } = await supabase.from('server_members').delete().eq('id', memberId);
      if (kickError) { toast.error('Üye sunucudan çıkarılamadı'); setConfirmLoading(false); return; }
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Kullanıcı yasaklandı');
      await supabase.from('audit_logs').insert({ server_id: serverId, user_id: user.id, action: 'member_banned', target_type: 'member', target_id: userId, details: { reason: reason || null } });
      const notifChannel = supabase.channel(`user-actions:${userId}`);
      await notifChannel.subscribe();
      await notifChannel.send({ type: 'broadcast', event: 'member-banned', payload: { server_id: serverId } });
      supabase.removeChannel(notifChannel);
    }
    setConfirmLoading(false);
    setConfirmAction(null);
  };

  const handleHexInputChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setNewRoleColor(val);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleUnban = async (banId: string, bannedUserId: string) => {
    const { error } = await supabase.from('server_bans').delete().eq('id', banId);
    if (error) { toast.error('Yasak kaldırılamadı'); return; }
    toast.success('Yasak kaldırıldı');
    fetchBans();
    if (user && serverId) await supabase.from('audit_logs').insert({ server_id: serverId, user_id: user.id, action: 'member_unbanned', target_type: 'member', target_id: bannedUserId });
  };

  const actionLabels: Record<string, { label: string; color: string }> = {
    role_created:     { label: '🛡️ Rol oluşturdu',        color: 'border-blue-500/60' },
    role_assigned:    { label: '🎭 Rol atadı',             color: 'border-purple-500/60' },
    role_removed:     { label: '🎭 Rol kaldırdı',          color: 'border-purple-400/40' },
    member_kicked:    { label: '👢 Üye attı',              color: 'border-orange-500/60' },
    member_joined:    { label: '📥 Sunucuya katıldı',      color: 'border-emerald-500/60' },
    member_left:      { label: '📤 Sunucudan ayrıldı',     color: 'border-gray-400/40' },
    server_updated:   { label: '⚙️ Sunucuyu güncelledi',  color: 'border-yellow-500/60' },
    channel_created:  { label: '📢 Kanal oluşturdu',       color: 'border-cyan-500/60' },
    channel_deleted:  { label: '🗑️ Kanal sildi',           color: 'border-red-400/60' },
    emoji_added:      { label: '😀 Emoji ekledi',          color: 'border-yellow-400/60' },
    emoji_deleted:    { label: '❌ Emoji sildi',            color: 'border-red-400/40' },
    member_banned:    { label: '🔨 Üye yasakladı',         color: 'border-red-600/80' },
    member_unbanned:  { label: '✅ Yasağı kaldırdı',       color: 'border-emerald-400/60' },
    member_timeout:   { label: '🔇 Kullanıcıyı susturdu',  color: 'border-orange-400/60' },
    member_untimeout: { label: '🔊 Susturmayı kaldırdı',  color: 'border-emerald-300/60' },
  };

  const getRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s} sn önce`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} sa önce`;
    return `${Math.floor(h / 24)} gün önce`;
  };

  const getActionDetail = (log: AuditLog) => {
    switch (log.action) {
      case 'member_banned': return log.details?.reason ? `Sebep: ${log.details.reason}` : null;
      case 'member_timeout': return log.details?.minutes ? `Süre: ${log.details.minutes} dakika` : null;
      case 'role_created': return log.details?.color ? `Renk: ${log.details.color}` : null;
      case 'role_assigned': return log.details?.role_id ? null : null;
      default: return null;
    }
  };

  const auditActionTypes = ['all', ...Object.keys(actionLabels)];

  const filteredAuditLogs = auditFilter === 'all' ? auditLogs : auditLogs.filter(l => l.action === auditFilter);

  const groupLogsByDate = (logs: AuditLog[]) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups: { label: string; logs: AuditLog[] }[] = [
      { label: 'Bugün', logs: [] },
      { label: 'Dün', logs: [] },
      { label: 'Daha Eski', logs: [] },
    ];
    for (const log of logs) {
      const d = new Date(log.created_at); d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) groups[0].logs.push(log);
      else if (d.getTime() === yesterday.getTime()) groups[1].logs.push(log);
      else groups[2].logs.push(log);
    }
    return groups.filter(g => g.logs.length > 0);
  };

  // Mobile: Discord-style vertical list + sub-page
  if (isMobile && activeTab === '__menu__') {
    return (
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-border bg-sidebar shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '12px' }}>
          <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }} className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0" title="Kapat">
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">{t('serverSettings.title')}</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="h-screen flex flex-col md:flex-row bg-background text-foreground overflow-hidden">
      {isMobile && (
        <div className="flex items-center gap-3 px-4 border-b border-border bg-sidebar shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '12px' }}>
          <button onClick={() => setActiveTab('__menu__')} className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0" title="Geri">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-semibold text-foreground">{tabs.find(t => t.id === activeTab)?.label || ''}</h1>
        </div>
      )}

      {!isMobile && (
        <div className="w-56 bg-sidebar flex flex-col items-end py-10 pr-2 pl-4 overflow-y-auto shrink-0">
          <div className="w-full space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2">{t('serverSettings.title')}</p>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <div className="border-t border-border my-2" />
            <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50">
              <X className="w-4 h-4" /> Geri
            </button>
          </div>
        </div>
      )}

      {!isMobile && (
        <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }} className="absolute top-6 right-6 w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-10" title="Kapat">
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-full max-w-2xl py-6 md:py-10 px-4 md:px-10 overflow-y-auto">
          {/* General */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t('serverSettings.general')}</h2>
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    {serverIcon && (serverIcon.startsWith('http') || serverIcon.startsWith('/')) ? (
                      <img src={serverIcon} alt="Server" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold text-secondary-foreground">
                        {serverIcon || serverName.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    {canManageServer && (
                      <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" title="Sunucu ikonunu değiştir">
                        <Camera className="w-5 h-5 text-white" />
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs uppercase text-muted-foreground font-semibold">{t('serverSettings.serverNameLabel')}</label>
                    <Input value={serverName} onChange={e => setServerName(e.target.value)} className="bg-input border-border" disabled={!canManageServer} />
                  </div>
                </div>
                {canManageServer && (
                  <Button onClick={handleSave} disabled={saving || !serverName.trim()} className="w-full">
                    {saving ? t('serverSettings.saving') : t('serverSettings.save')}
                  </Button>
                )}
              </div>

              {/* Server Stats */}
              {serverStats && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Sunucu İstatistikleri</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-secondary/50">
                      <p className="text-2xl font-bold text-foreground">{serverStats.members}</p>
                      <p className="text-xs text-muted-foreground">Üye</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-secondary/50">
                      <p className="text-2xl font-bold text-foreground">{serverStats.channels}</p>
                      <p className="text-xs text-muted-foreground">Kanal</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-secondary/50">
                      <p className="text-2xl font-bold text-foreground">{serverStats.roles}</p>
                      <p className="text-xs text-muted-foreground">Rol</p>
                    </div>
                  </div>
                  {serverStats.created_at && (
                    <p className="text-xs text-muted-foreground">Oluşturulma: {formatDate(serverStats.created_at)}</p>
                )}
              </div>
              )}

              {/* Welcome Message */}
              {canManageServer && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Hoş Geldin Mesajı</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Yeni üye katıldığında otomatik mesaj gönder</p>
                    <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
                  </div>
                  {welcomeEnabled && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Kanal</label>
                        <select value={welcomeChannelId} onChange={e => setWelcomeChannelId(e.target.value)} className="w-full text-sm bg-input border border-border rounded px-2 py-1.5 text-foreground mt-1">
                          <option value="">Kanal seçin...</option>
                          {channelsList.filter(c => c.type === 'text').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Mesaj ({'{user}'} ile kullanıcı adı ekleyin)</label>
                        <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} placeholder="Hoş geldin {user}! 🎉" className="w-full text-sm bg-input border border-border rounded px-3 py-2 text-foreground mt-1 min-h-[60px] resize-none outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <Button size="sm" onClick={handleSaveWelcome}>Kaydet</Button>
                    </div>
                  )}
                </div>
              )}

              {/* Leave Message */}
              {canManageServer && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Çıkış Mesajı</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Üye sunucudan ayrıldığında otomatik mesaj gönder</p>
                    <Switch checked={leaveEnabled} onCheckedChange={setLeaveEnabled} />
                  </div>
                  {leaveEnabled && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Kanal</label>
                        <select value={leaveChannelId} onChange={e => setLeaveChannelId(e.target.value)} className="w-full text-sm bg-input border border-border rounded px-2 py-1.5 text-foreground mt-1">
                          <option value="">Kanal seçin...</option>
                          {channelsList.filter(c => c.type === 'text').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Mesaj ({'{user}'} ile kullanıcı adı ekleyin)</label>
                        <textarea value={leaveMessage} onChange={e => setLeaveMessage(e.target.value)} placeholder="Güle güle {user}! 👋" className="w-full text-sm bg-input border border-border rounded px-3 py-2 text-foreground mt-1 min-h-[60px] resize-none outline-none focus:ring-1 focus:ring-primary/40" />
                      </div>
                      <Button size="sm" onClick={handleSaveLeave}>Kaydet</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Emojis Tab */}
          {activeTab === 'emojis' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Emojiler</h2>
                <span className="text-sm text-muted-foreground font-medium">{emojis.length}/{MAX_EMOJIS}</span>
              </div>
              
              {canManageEmojis && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Yeni Emoji Yükle</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs text-muted-foreground">Emoji Adı</label>
                      <Input value={emojiName} onChange={e => setEmojiName(e.target.value)} placeholder="emoji_adi" className="bg-input border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Görsel</label>
                      <Button variant="outline" size="sm" onClick={() => emojiFileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-1" />
                        {emojiFile ? emojiFile.name.slice(0, 15) : 'Dosya Seç'}
                      </Button>
                      <input ref={emojiFileInputRef} type="file" accept="image/*" className="hidden" onChange={e => setEmojiFile(e.target.files?.[0] || null)} />
                    </div>
                    <Button onClick={handleEmojiUpload} disabled={emojiUploading || !emojiName.trim() || !emojiFile} size="sm">
                      <Plus className="w-4 h-4 mr-1" /> {emojiUploading ? 'Yükleniyor...' : 'Ekle'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Maks. 256KB — GIF animasyonu desteklenir, diğer görseller 64×64px'e optimize edilir. Kullanım: <code className="bg-secondary px-1 rounded">:emoji_adi:</code></p>
                </div>
              )}

              {/* Bulk delete */}
              {canManageEmojis && selectedEmojis.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="sm" onClick={handleBulkDeleteEmojis}>
                    <Trash2 className="w-4 h-4 mr-1" /> {selectedEmojis.size} Emoji Sil
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedEmojis(new Set())}>İptal</Button>
                </div>
              )}

              <div className="space-y-1.5">
                {emojis.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Henüz özel emoji eklenmemiş</p>}
                {emojis.map(emoji => (
                  <div key={emoji.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card">
                    {canManageEmojis && (
                      <Checkbox
                        checked={selectedEmojis.has(emoji.id)}
                        onCheckedChange={() => toggleEmojiSelection(emoji.id)}
                      />
                    )}
                    <img src={emoji.image_url} alt={emoji.name} className="w-8 h-8 object-contain rounded" />
                    {editingEmojiId === emoji.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input value={editingEmojiName} onChange={e => setEditingEmojiName(e.target.value)} className="h-7 text-sm bg-input border-border" />
                        <button onClick={() => handleRenameEmoji(emoji.id)} className="p-1 text-green-500 hover:text-green-400" title="Kaydet"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingEmojiId(null)} className="p-1 text-muted-foreground hover:text-foreground" title="İptal"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-foreground font-mono">:{emoji.name}:</span>
                        {canManageEmojis && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingEmojiId(emoji.id); setEditingEmojiName(emoji.name); }} className="p-1 text-muted-foreground hover:text-foreground" title="Yeniden adlandır"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteEmoji(emoji.id)} className="p-1 text-destructive hover:text-destructive/80" title="Emojiyi sil"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t('serverSettings.rolesTab') || 'Roller'}</h2>
                <span className="text-xs text-muted-foreground">{roles.length} rol</span>
              </div>
              {canManageRoles && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Yeni Rol Oluştur</p>
                  <div className="flex gap-2">
                    <Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Rol adı" className="bg-input border-border flex-1" onKeyDown={e => { if (e.key === 'Enter') handleCreateRole(); }} />
                    <Button onClick={handleCreateRole} disabled={!newRoleName.trim()} size="sm"><Plus className="w-4 h-4 mr-1" /> Ekle</Button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => { setNewRoleColor(c); setHexInput(c); }} className={`w-7 h-7 rounded-full border-2 transition-all ${newRoleColor === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-7 h-7 rounded-full border-2 border-border shrink-0" style={{ backgroundColor: newRoleColor }} />
                    <Input value={hexInput} onChange={e => handleHexInputChange(e.target.value)} placeholder="#3498DB" className="bg-input border-border w-28 font-mono text-sm h-8" maxLength={7} />
                    <input type="color" value={newRoleColor} onChange={e => { setNewRoleColor(e.target.value); setHexInput(e.target.value); }} className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent p-0.5" title="Renk seç" />
                    <span className="text-xs text-muted-foreground">Renk seçici</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {roles.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Henüz rol oluşturulmamış</p>}
                {roles.map((role, idx) => {
                  const memberCount = members.filter(m => m.roles.some(r => r.id === role.id)).length;
                  const roleMembers = members.filter(m => m.roles.some(r => r.id === role.id));
                  const isExpanded = editingRole?.id === role.id;
                  const activeTab2 = roleActiveTab[role.id] || 'permissions';
                  return (
                    <div key={role.id} className="rounded-lg border border-border bg-card overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        {/* Color dot (click to edit color inline) */}
                        <div className="relative group shrink-0">
                          {isExpanded ? (
                            <input type="color" value={editingRole?.color || role.color} title="Rengi değiştir"
                              onChange={async (e) => {
                                const color = e.target.value;
                                await supabase.from('server_roles').update({ color } as any).eq('id', role.id);
                                setEditingRole(prev => prev ? { ...prev, color } : null);
                                setRoles(prev => prev.map(r => r.id === role.id ? { ...r, color } : r));
                              }}
                              className="w-5 h-5 rounded-full border-0 cursor-pointer p-0 bg-transparent opacity-0 absolute inset-0"
                            />
                          ) : null}
                          <div className="w-5 h-5 rounded-full border border-border/40 group-hover:scale-110 transition-transform" style={{ backgroundColor: role.color }} title={isExpanded ? 'Rengi değiştir' : undefined} />
                        </div>

                        {/* Role name / rename input */}
                        {renamingRoleId === role.id ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Input value={renamingRoleVal} onChange={e => setRenamingRoleVal(e.target.value)} className="h-7 text-sm bg-input border-border flex-1 min-w-0" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleRenameRole(role.id); if (e.key === 'Escape') { setRenamingRoleId(null); setRenamingRoleVal(''); } }} />
                            <button onClick={() => handleRenameRole(role.id)} className="p-1 text-green-500 hover:text-green-400 shrink-0" title="Kaydet"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setRenamingRoleId(null); setRenamingRoleVal(''); }} className="p-1 text-muted-foreground hover:text-foreground shrink-0" title="İptal"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground truncate" style={{ color: role.color }}>{role.name}</span>
                            {memberCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">{memberCount} üye</span>
                            )}
                          </div>
                        )}

                        {canManageRoles && renamingRoleId !== role.id && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => { setRenamingRoleId(role.id); setRenamingRoleVal(role.name); }} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50" title="Yeniden adlandır"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setEditingRole(isExpanded ? null : role); setRoleActiveTab(prev => ({ ...prev, [role.id]: 'permissions' })); }} className={`p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 ${isExpanded ? 'bg-secondary text-foreground' : ''}`} title="Düzenle"><Shield className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleMoveRole(role.id, 'up')} disabled={idx === 0} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleMoveRole(role.id, 'down')} disabled={idx === roles.length - 1} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteRole(role.id)} className="p-1.5 rounded text-destructive hover:text-destructive/80 hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>

                      {/* Expanded editor */}
                      {isExpanded && canManageRoles && (
                        <div className="border-t border-border">
                          {/* Tab bar */}
                          <div className="flex border-b border-border bg-secondary/20">
                            <button onClick={() => setRoleActiveTab(prev => ({ ...prev, [role.id]: 'permissions' }))} className={`flex-1 text-xs py-2 font-medium transition-colors ${activeTab2 === 'permissions' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>İzinler</button>
                            <button onClick={() => setRoleActiveTab(prev => ({ ...prev, [role.id]: 'members' }))} className={`flex-1 text-xs py-2 font-medium transition-colors ${activeTab2 === 'members' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Üyeler {memberCount > 0 && `(${memberCount})`}</button>
                            <button onClick={() => setRoleActiveTab(prev => ({ ...prev, [role.id]: 'display' }))} className={`flex-1 text-xs py-2 font-medium transition-colors ${activeTab2 === 'display' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>Görünüm</button>
                          </div>

                          {activeTab2 === 'permissions' && (
                            <div className="px-3 py-3 space-y-4">
                              {PERMISSION_CATEGORIES.map(cat => (
                                <div key={cat.label}>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                    <span className="flex-1 border-t border-border/50" />
                                    {cat.label}
                                    <span className="flex-1 border-t border-border/50" />
                                  </p>
                                  <div className="space-y-2.5">
                                    {cat.permissions.map(perm => {
                                      const isAdmin = !!(editingRole || role).permissions.administrator;
                                      const isAdminPerm = perm.key === 'administrator';
                                      const isDisabled = isAdmin && !isAdminPerm;
                                      const currentRole = roles.find(r => r.id === role.id) || role;
                                      return (
                                        <div key={perm.key} className={`flex items-center justify-between gap-3 p-2 rounded-lg ${isDisabled ? 'opacity-60' : 'hover:bg-secondary/30'} transition-colors`}>
                                          <div className="min-w-0">
                                            <span className="text-xs font-medium text-foreground block">{perm.label}</span>
                                            <span className="text-[10px] text-muted-foreground">{perm.description}</span>
                                          </div>
                                          <Switch
                                            checked={isDisabled ? true : !!currentRole.permissions[perm.key]}
                                            onCheckedChange={(v) => handleUpdatePermission(role.id, perm.key, v)}
                                            disabled={isDisabled}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {activeTab2 === 'members' && (
                            <div className="px-3 py-3 space-y-2">
                              {roleMembers.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">Bu rolde henüz üye yok</p>
                              ) : (
                                roleMembers.map(m => (
                                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/30 transition-colors">
                                    {m.avatar_url ? (
                                      <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                                    ) : (
                                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium shrink-0">{m.display_name.charAt(0)?.toUpperCase()}</div>
                                    )}
                                    <span className="flex-1 text-sm text-foreground truncate">{m.display_name}</span>
                                    <button onClick={() => handleRemoveRole(m.user_id, role.id)} className="p-1 text-destructive hover:text-destructive/80 shrink-0" title="Rolü kaldır"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ))
                              )}
                            </div>
                          )}

                          {activeTab2 === 'display' && (() => {
                            const gradConfig = roleGradients[role.id] || { enabled: false, endColor: '#9B59B6' };
                            return (
                              <div className="px-3 py-4 space-y-4">
                                <p className="text-xs text-muted-foreground">Üye listesinde ve mesajlarda bu role sahip kullanıcıların adı gradient renk efektiyle görünür.</p>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">Gradient Renk Aktif</p>
                                    <p className="text-xs text-muted-foreground">Soldan sağa renk geçişi</p>
                                  </div>
                                  <Switch
                                    checked={gradConfig.enabled}
                                    onCheckedChange={(v) => saveRoleGradient(role.id, { ...gradConfig, enabled: v })}
                                  />
                                </div>
                                {gradConfig.enabled && (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 space-y-1">
                                        <p className="text-xs text-muted-foreground">Başlangıç Rengi</p>
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-full border border-border" style={{ backgroundColor: role.color }} />
                                          <span className="text-xs font-mono text-foreground">{role.color}</span>
                                          <span className="text-xs text-muted-foreground">(rol rengi)</span>
                                        </div>
                                      </div>
                                      <div className="flex-1 space-y-1">
                                        <p className="text-xs text-muted-foreground">Bitiş Rengi</p>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="color"
                                            value={gradConfig.endColor}
                                            onChange={e => saveRoleGradient(role.id, { ...gradConfig, endColor: e.target.value })}
                                            className="w-7 h-7 rounded-full border border-border cursor-pointer bg-transparent p-0"
                                          />
                                          <span className="text-xs font-mono text-foreground">{gradConfig.endColor}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-border bg-secondary/20 p-3 flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Önizleme:</span>
                                      <span
                                        className="text-sm font-semibold"
                                        style={{ background: `linear-gradient(270deg, ${role.color}, ${gradConfig.endColor})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                                      >
                                        Kullanıcı Adı
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Members */}
          {activeTab === 'members' && (() => {
            const q = memberSearch.toLowerCase();
            const baseFiltered = members.filter(m => {
              const matchSearch = !q || m.display_name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q);
              const matchRole = memberRoleFilter === 'all' || (memberRoleFilter === 'norole' ? m.roles.length === 0 : m.roles.some(r => r.id === memberRoleFilter));
              return matchSearch && matchRole;
            });
            const ownerMember = baseFiltered.find(m => m.user_id === ownerId);
            const nonOwners = baseFiltered.filter(m => m.user_id !== ownerId).sort((a, b) => {
              if (memberSortBy === 'name') return a.display_name.localeCompare(b.display_name, 'tr');
              return new Date(a.joined_at || 0).getTime() - new Date(b.joined_at || 0).getTime();
            });

            const renderMemberCard = (m: Member) => {
              const isOwner = m.user_id === ownerId;
              const isSelf = m.user_id === user?.id;
              const rolesExpanded = memberExpandedRoles.has(m.id);
              const shownRoles = rolesExpanded ? m.roles : m.roles.slice(0, 3);
              const joinedDate = m.joined_at ? new Date(m.joined_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
              return (
                <div key={m.id} data-testid={`member-settings-card-${m.user_id}`} className={`flex flex-col gap-0 rounded-xl border transition-all overflow-hidden ${isOwner ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-card hover:border-border/70 hover:bg-card/80'}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="relative shrink-0">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-border" />
                      ) : (
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold ring-2 ${isOwner ? 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30' : 'bg-primary/20 text-primary ring-border'}`}>{m.display_name.charAt(0)?.toUpperCase()}</div>
                      )}
                      {isOwner ? (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center border-2 border-card shadow" title="Sunucu Sahibi">
                          <Crown className="w-3 h-3 text-black" />
                        </div>
                      ) : isSelf ? (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card" title="Sen" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-bold truncate ${isOwner ? 'text-yellow-400' : 'text-foreground'}`}>{m.display_name}</span>
                        {isOwner && <span className="text-[10px] text-yellow-500 bg-yellow-500/15 px-1.5 py-0.5 rounded-full font-bold border border-yellow-500/25 flex items-center gap-0.5"><Crown className="w-2.5 h-2.5" /> Sahip</span>}
                        {isSelf && !isOwner && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-semibold border border-primary/20">Sen</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {m.username && <span className="text-[11px] text-muted-foreground">@{m.username}</span>}
                        {joinedDate && (
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />{joinedDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canManageRoles && roles.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button data-testid={`button-manage-roles-${m.user_id}`} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Rol yönet">
                              <UserCog className="w-4 h-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-1.5" side="left">
                            <p className="text-xs font-bold text-muted-foreground px-2 py-1 mb-0.5 uppercase tracking-wider">Rol Ata</p>
                            {roles.filter(r => !m.roles.some(mr => mr.id === r.id)).map(r => (
                              <button key={r.id} onClick={() => handleAssignRole(m.user_id, r.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                <span className="truncate flex-1 text-left">{r.name}</span>
                                <Plus className="w-3 h-3 text-muted-foreground" />
                              </button>
                            ))}
                            {m.roles.length > 0 && roles.filter(r => !m.roles.some(mr => mr.id === r.id)).length > 0 && <div className="border-t border-border my-1" />}
                            {m.roles.map(r => (
                              <button key={`rm-${r.id}`} onClick={() => handleRemoveRole(m.user_id, r.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                <span className="truncate flex-1 text-left">{r.name}</span>
                                <X className="w-3 h-3" />
                              </button>
                            ))}
                            {roles.filter(r => !m.roles.some(mr => mr.id === r.id)).length === 0 && m.roles.length === 0 && (
                              <p className="text-xs text-muted-foreground px-2 py-1 text-center">Rol yok</p>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                      {canKickMembers && !isOwner && m.user_id !== user?.id && (
                        <button data-testid={`button-kick-${m.user_id}`} onClick={() => openKickConfirm(m.id, m.user_id, m.display_name || m.username)} className="p-1.5 rounded-lg text-orange-400 hover:bg-orange-400/10 hover:text-orange-300 transition-colors" title="Sunucudan at">
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                      {canBanMembers && !isOwner && m.user_id !== user?.id && (
                        <button data-testid={`button-ban-${m.user_id}`} onClick={() => openBanConfirm(m.id, m.user_id, m.display_name || m.username)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title="Yasakla">
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Role chips row */}
                  {m.roles.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1 items-center">
                      {shownRoles.map(r => (
                        <span key={r.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border" style={{ backgroundColor: r.color + '18', color: r.color, borderColor: r.color + '35' }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                          {r.name}
                          {canManageRoles && (
                            <button onClick={() => handleRemoveRole(m.user_id, r.id)} className="ml-0.5 hover:opacity-60 leading-none text-[11px]">×</button>
                          )}
                        </span>
                      ))}
                      {m.roles.length > 3 && (
                        <button
                          onClick={() => setMemberExpandedRoles(prev => {
                            const next = new Set(prev);
                            rolesExpanded ? next.delete(m.id) : next.add(m.id);
                            return next;
                          })}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-full bg-secondary/60 hover:bg-secondary transition-colors flex items-center gap-0.5"
                        >
                          {rolesExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                          {rolesExpanded ? 'Gizle' : `+${m.roles.length - 3} daha`}
                        </button>
                      )}
                    </div>
                  )}
                  {m.roles.length === 0 && (
                    <div className="px-4 pb-3">
                      <span className="text-[10px] text-muted-foreground/50">@everyone</span>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{t('serverSettings.membersTab')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {members.length} üye toplam
                    </p>
                  </div>
                  <button onClick={() => fetchMembers()} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Yenile">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Search + Sort + Filter row */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="İsim veya kullanıcı adı ara..."
                      data-testid="input-member-search"
                      className="w-full pl-8 pr-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-input text-sm text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {memberSortBy === 'name' ? 'İsim' : 'Katılma'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1.5" side="bottom" align="end">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Sırala</p>
                      <button onClick={() => setMemberSortBy('joined')} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${memberSortBy === 'joined' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                        <Calendar className="w-3.5 h-3.5" /> Katılma Tarihi
                        {memberSortBy === 'joined' && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                      <button onClick={() => setMemberSortBy('name')} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${memberSortBy === 'name' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                        <Users className="w-3.5 h-3.5" /> İsim (A-Z)
                        {memberSortBy === 'name' && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                    </PopoverContent>
                  </Popover>
                  {roles.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${memberRoleFilter !== 'all' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-input text-muted-foreground hover:text-foreground hover:border-border/70'}`}>
                          <Filter className="w-3.5 h-3.5" />
                          {memberRoleFilter === 'all' ? 'Tüm Roller' : memberRoleFilter === 'norole' ? 'Rol Atanmamış' : (roles.find(r => r.id === memberRoleFilter)?.name || 'Rol')}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-1.5" side="bottom" align="end">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Rol Filtresi</p>
                        <button onClick={() => setMemberRoleFilter('all')} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${memberRoleFilter === 'all' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                          Tüm üyeler {memberRoleFilter === 'all' && <Check className="w-3 h-3 ml-auto" />}
                        </button>
                        <button onClick={() => setMemberRoleFilter('norole')} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${memberRoleFilter === 'norole' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                          Rol atanmamış {memberRoleFilter === 'norole' && <Check className="w-3 h-3 ml-auto" />}
                        </button>
                        <div className="border-t border-border my-1" />
                        {roles.map(r => (
                          <button key={r.id} onClick={() => setMemberRoleFilter(r.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${memberRoleFilter === r.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                            <span className="truncate flex-1 text-left">{r.name}</span>
                            {memberRoleFilter === r.id && <Check className="w-3 h-3 ml-auto" />}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Content */}
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Users className="w-10 h-10 text-muted-foreground opacity-30 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('serverSettings.noMembers')}</p>
                  </div>
                ) : baseFiltered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="w-8 h-8 text-muted-foreground opacity-30 mb-3" />
                    <p className="text-sm text-muted-foreground">Arama sonucu bulunamadı</p>
                    <button onClick={() => { setMemberSearch(''); setMemberRoleFilter('all'); }} className="mt-2 text-xs text-primary hover:underline">Filtreleri temizle</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Owner pinned at top */}
                    {ownerMember && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <Crown className="w-3 h-3 text-yellow-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-500/80">Sunucu Sahibi</span>
                        </div>
                        {renderMemberCard(ownerMember)}
                        {nonOwners.length > 0 && (
                          <div className="flex items-center gap-2 px-1 pt-1">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Üyeler — {nonOwners.length}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {nonOwners.map(renderMemberCard)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Bans Tab */}
          {activeTab === 'bans' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Yasaklar</h2>
                <span className="text-sm text-muted-foreground">{bans.length} yasaklı</span>
              </div>
              <div className="space-y-2">
                {bans.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Yasaklı kullanıcı yok</p>
                ) : (
                  bans.map(ban => (
                    <div key={ban.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card">
                      {ban.user_avatar ? (
                        <img src={ban.user_avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-medium shrink-0">{ban.user_name?.charAt(0)?.toUpperCase()}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ban.user_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ban.reason ? `Sebep: ${ban.reason}` : 'Sebep belirtilmemiş'} • Yasaklayan: {ban.banned_by_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(ban.created_at)}</p>
                      </div>
                      {canBanMembers && (
                        <Button variant="outline" size="sm" onClick={() => handleUnban(ban.id, ban.user_id)}>
                          Yasağı Kaldır
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Audit Logs */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{t('serverSettings.auditTab') || 'Denetim Kaydı'}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Sunucudaki tüm yönetim işlemlerinin kaydı</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">{filteredAuditLogs.length} kayıt</span>
                  <button onClick={fetchAuditLogs} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors" title="Yenile">
                    <ScrollText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[160px]">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    placeholder="Kullanıcı ara..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <select
                  value={auditFilter}
                  onChange={e => setAuditFilter(e.target.value)}
                  className="text-xs bg-input border border-border rounded-lg px-2.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all">Tüm İşlemler</option>
                  {Object.entries(actionLabels).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {(() => {
                  const searchFiltered = filteredAuditLogs.filter(l =>
                    !auditSearch || l.user_name?.toLowerCase().includes(auditSearch.toLowerCase()) || l.target_name?.toLowerCase().includes(auditSearch.toLowerCase())
                  );
                  if (searchFiltered.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ScrollText className="w-10 h-10 text-muted-foreground opacity-30 mb-3" />
                      <p className="text-sm text-muted-foreground">Kayıt bulunamadı</p>
                    </div>
                  );
                  return groupLogsByDate(searchFiltered).map(group => (
                    <div key={group.label} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-[10px] text-muted-foreground">{group.logs.length}</span>
                      </div>
                      {group.logs.map(log => {
                        const actionInfo = actionLabels[log.action];
                        const detail = getActionDetail(log);
                        const isMemberAction = log.target_type === 'member' && log.target_name;
                        return (
                          <div key={log.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border bg-card border-l-[3px] hover:bg-card/80 transition-colors ${actionInfo?.color || 'border-l-border'}`}>
                            <div className="shrink-0 mt-0.5">
                              {log.user_avatar ? (
                                <img src={log.user_avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-border" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary ring-2 ring-border">{log.user_name?.charAt(0)?.toUpperCase()}</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground leading-snug">
                                <span className="font-semibold">{log.user_name}</span>
                                {' '}
                                <span className="text-muted-foreground">{actionInfo?.label || log.action}</span>
                                {isMemberAction && (
                                  <> → <span className="font-semibold text-foreground">{log.target_name}</span></>
                                )}
                              </p>
                              {detail && (
                                <p className="text-xs text-muted-foreground mt-1 bg-secondary/30 rounded px-2 py-1">{detail}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1">{getRelativeTime(log.created_at)} · {formatDate(log.created_at)}</p>
                            </div>
                            {isMemberAction && log.target_avatar && (
                              <div className="shrink-0 mt-0.5 relative">
                                <img src={log.target_avatar} alt="" className="w-7 h-7 rounded-full object-cover opacity-70" title={log.target_name || ''} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Kanallar</h2>
              {canManageChannels && (
                <>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Yeni Kategori Oluştur</p>
                    <div className="flex gap-2">
                      <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Kategori adı" className="bg-input border-border flex-1" />
                      <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()} size="sm"><Plus className="w-4 h-4 mr-1" /> Ekle</Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Yeni Kanal Oluştur</p>
                    <div className="flex gap-2 flex-wrap">
                      <Input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="Kanal adı" className="bg-input border-border flex-1 min-w-[140px]" />
                      <select value={newChannelType} onChange={e => setNewChannelType(e.target.value as 'text' | 'voice')} className="text-sm bg-secondary border border-border rounded px-2 py-1.5 text-foreground">
                        <option value="text">Metin</option>
                        <option value="voice">Ses</option>
                      </select>
                      <select value={newChannelCategory} onChange={e => setNewChannelCategory(e.target.value)} className="text-sm bg-secondary border border-border rounded px-2 py-1.5 text-foreground">
                        <option value="">Kategorisiz</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                      <Button onClick={handleCreateChannel} disabled={!newChannelName.trim()} size="sm"><Plus className="w-4 h-4 mr-1" /> Kanal Ekle</Button>
                    </div>
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground">Kanalları kategoriler arasında taşımak için aşağıdaki açılır menüyü kullanın.</p>
              {channelsList.filter(c => !c.category_id).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Kategorisiz</p>
                  {channelsList.filter(c => !c.category_id).map((ch, idx, arr) => (
                    <div key={ch.id} className="rounded-lg border border-border bg-card px-3 py-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {ch.type === 'voice' ? <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" /> : <Hash className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="flex-1 text-sm font-medium text-foreground truncate">{ch.name}</span>
                        {canManageChannels && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => handleMoveChannel(ch.id, 'up')} disabled={idx === 0} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary/50" title="Yukarı taşı"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleMoveChannel(ch.id, 'down')} disabled={idx === arr.length - 1} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary/50" title="Aşağı taşı"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteChannel(ch.id)} className="p-1.5 rounded text-destructive hover:text-destructive/80 hover:bg-destructive/10" title="Kanalı sil"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                      {canManageChannels && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-6">
                          <select className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground" value="" onChange={async (e) => { const catId = e.target.value; if (!catId) return; const targetChannels = channelsList.filter(c => c.category_id === catId); await supabase.from('channels').update({ category_id: catId, position: targetChannels.length } as any).eq('id', ch.id); fetchChannelsAndCategories(); }}>
                            <option value="">Kategoriye taşı...</option>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                          </select>
                          {ch.slow_mode_interval !== undefined && (
                            <select className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground" value={ch.slow_mode_interval || 0} onChange={(e) => handleUpdateSlowMode(ch.id, Number(e.target.value))}>
                              <option value={0}>Yavaş Mod: Kapalı</option>
                              <option value={5}>5 saniye</option><option value={10}>10 saniye</option><option value={30}>30 saniye</option>
                              <option value={60}>1 dakika</option><option value={300}>5 dakika</option><option value={600}>10 dakika</option>
                              <option value={1800}>30 dakika</option><option value={3600}>1 saat</option>
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {categories.map(cat => (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat.name}</p>
                    {canManageChannels && <button onClick={() => handleDeleteCategory(cat.id)} className="p-1 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded" title="Kategoriyi sil"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                  {channelsList.filter(c => c.category_id === cat.id).map((ch, idx, arr) => (
                    <div key={ch.id} className="rounded-lg border border-border bg-card px-3 py-2 space-y-1.5 ml-3">
                      <div className="flex items-center gap-2">
                        {ch.type === 'voice' ? <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" /> : <Hash className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="flex-1 text-sm font-medium text-foreground truncate">{ch.name}</span>
                        {canManageChannels && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => handleMoveChannel(ch.id, 'up')} disabled={idx === 0} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary/50" title="Yukarı taşı"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleMoveChannel(ch.id, 'down')} disabled={idx === arr.length - 1} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary/50" title="Aşağı taşı"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteChannel(ch.id)} className="p-1.5 rounded text-destructive hover:text-destructive/80 hover:bg-destructive/10" title="Kanalı sil"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                      {canManageChannels && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-6">
                          <select className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground" value={cat.id} onChange={async (e) => { const newCatId = e.target.value || null; const targetChannels = channelsList.filter(c => c.category_id === newCatId); await supabase.from('channels').update({ category_id: newCatId, position: targetChannels.length } as any).eq('id', ch.id); fetchChannelsAndCategories(); }}>
                            <option value="">Kategorisiz</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <select className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground" value={ch.slow_mode_interval || 0} onChange={(e) => handleUpdateSlowMode(ch.id, Number(e.target.value))}>
                            <option value={0}>Yavaş Mod: Kapalı</option>
                            <option value={5}>5 saniye</option><option value={10}>10 saniye</option><option value={30}>30 saniye</option>
                            <option value={60}>1 dakika</option><option value={300}>5 dakika</option><option value={600}>10 dakika</option>
                            <option value={1800}>30 dakika</option><option value={3600}>1 saat</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Welcome Message Tab - rendered inside General */}

          {/* Filter Tab */}
          {activeTab === 'filter' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Kelime Filtresi</h2>
              <p className="text-sm text-muted-foreground">Yasaklı kelimeler otomatik olarak sansürlenir. Virgülle ayırarak toplu ekleme yapabilirsiniz.</p>
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex gap-2">
                  <Input value={wordFilterInput} onChange={e => setWordFilterInput(e.target.value)} placeholder="kelime1, kelime2, kelime3..." className="bg-input border-border flex-1" onKeyDown={e => { if (e.key === 'Enter') handleAddFilterWords(); }} />
                  <Button onClick={handleAddFilterWords} disabled={!wordFilterInput.trim()} size="sm"><Plus className="w-4 h-4 mr-1" /> Ekle</Button>
                </div>
                {wordFilter.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {wordFilter.map(word => (
                      <span key={word} className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full">
                        {word}
                        {canManageServer && <button onClick={() => handleRemoveFilterWord(word)} className="hover:opacity-70">×</button>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">Henüz yasaklı kelime eklenmemiş</p>
                )}
                {wordFilter.length > 0 && canManageServer && (
                  <Button variant="destructive" size="sm" onClick={() => { setWordFilter([]); if (serverId) supabase.from('servers').update({ word_filter: [] } as any).eq('id', serverId); }}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Tümünü Temizle
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {activeTab === 'danger' && isOwner && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-destructive">{t('serverSettings.dangerZone')}</h2>
              <div className="rounded-xl border border-destructive/30 bg-card p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">{t('serverSettings.deleteServer')}</p>
                <p className="text-xs text-muted-foreground">{t('serverSettings.deleteConfirm')}</p>
                {!confirmDelete ? (
                  <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4 mr-1" /> {t('serverSettings.deleteServer')}</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>{deleting ? t('serverSettings.deleting') : t('serverSettings.confirmDelete')}</Button>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>{t('serverSettings.cancelButton')}</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Kick / Ban Confirm Modal */}
    <Dialog open={!!confirmAction} onOpenChange={(v) => { if (!v && !confirmLoading) setConfirmAction(null); }}>
      <DialogContent className="max-w-md bg-sidebar border-border">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmAction?.type === 'ban' ? 'bg-destructive/15' : 'bg-orange-500/15'}`}>
              <AlertTriangle className={`w-5 h-5 ${confirmAction?.type === 'ban' ? 'text-destructive' : 'text-orange-400'}`} />
            </div>
            <div>
              <DialogTitle className="text-base">
                {confirmAction?.type === 'ban' ? 'Üyeyi Yasakla' : 'Üyeyi Sunucudan At'}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {confirmAction?.type === 'ban'
                  ? `${confirmAction.memberName} adlı kullanıcı sunucudan kalıcı olarak yasaklanacak.`
                  : `${confirmAction?.memberName} adlı kullanıcı sunucudan atılacak.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className={`rounded-lg border p-3 text-xs ${confirmAction?.type === 'ban' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-orange-500/30 bg-orange-500/5 text-orange-400'}`}>
            {confirmAction?.type === 'ban'
              ? 'Bu işlem geri alınabilir. Kullanıcı daha sonra "Yasaklar" sekmesinden çözülebilir.'
              : 'Bu işlem geri alınabilir. Kullanıcı yeni bir davet linki ile tekrar katılabilir.'}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Sebep <span className="text-muted-foreground/60">(isteğe bağlı)</span>
            </label>
            <Textarea
              placeholder={confirmAction?.type === 'ban' ? 'Yasaklama sebebini yazın...' : 'Atma sebebini yazın...'}
              value={confirmAction?.reason || ''}
              onChange={(e) => setConfirmAction(prev => prev ? { ...prev, reason: e.target.value } : null)}
              className="resize-none text-sm h-20 bg-background/50"
              disabled={confirmLoading}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)} disabled={confirmLoading}>
              İptal
            </Button>
            <Button
              variant={confirmAction?.type === 'ban' ? 'destructive' : 'default'}
              size="sm"
              className={confirmAction?.type !== 'ban' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
              onClick={handleConfirmAction}
              disabled={confirmLoading}
            >
              {confirmLoading ? 'İşleniyor...' : confirmAction?.type === 'ban' ? 'Yasakla' : 'Sunucudan At'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default ServerSettings;
