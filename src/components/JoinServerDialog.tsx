import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { Link, Users, Hash, Loader2, ShieldCheck, X } from 'lucide-react';

interface JoinServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServerJoined: (serverId: string) => void;
}

interface ServerPreview {
  id: string;
  name: string;
  icon: string;
  icon_url?: string | null;
  memberCount: number;
  channelCount: number;
}

const JoinServerDialog = ({ open, onOpenChange, onServerJoined }: JoinServerDialogProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [inviteInput, setInviteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ServerPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const extractCode = (input: string): string => {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/\/invite\/([a-zA-Z0-9]+)$/);
    if (urlMatch) return urlMatch[1];
    return trimmed;
  };

  const fetchPreview = async (input: string) => {
    if (!input.trim() || !user) {
      setPreview(null);
      setPreviewError(null);
      setAlreadyMember(false);
      return;
    }

    setPreviewing(true);
    setPreviewError(null);
    const code = extractCode(input);

    try {
      // Try server_invites table first
      const { data: invite } = await supabase
        .from('server_invites')
        .select('*, servers(id, name, icon, icon_url)')
        .eq('code', code)
        .maybeSingle();

      let serverId: string | null = null;
      let serverData: any = null;

      if (invite) {
        if ((invite as any).expires_at && new Date((invite as any).expires_at) < new Date()) {
          setPreviewError('Bu davet bağlantısı süresi dolmuş');
          setPreviewing(false);
          return;
        }
        if ((invite as any).max_uses && (invite as any).uses >= (invite as any).max_uses) {
          setPreviewError('Bu davet bağlantısının kullanım limiti dolmuş');
          setPreviewing(false);
          return;
        }
        serverId = (invite as any).server_id;
        serverData = (invite as any).servers;
      } else {
        const { data: server } = await supabase
          .from('servers')
          .select('id, name, icon, icon_url')
          .eq('invite_code', code)
          .maybeSingle();

        if (!server) {
          setPreviewError('Geçersiz davet kodu');
          setPreview(null);
          setPreviewing(false);
          return;
        }
        serverId = server.id;
        serverData = server;
      }

      // Get member count
      const { count: memberCount } = await supabase
        .from('server_members')
        .select('id', { count: 'exact', head: true })
        .eq('server_id', serverId!);

      // Get channel count
      const { count: channelCount } = await supabase
        .from('channels')
        .select('id', { count: 'exact', head: true })
        .eq('server_id', serverId!);

      // Check if already member
      const { data: existing } = await supabase
        .from('server_members')
        .select('id')
        .eq('server_id', serverId!)
        .eq('user_id', user.id)
        .maybeSingle();

      setAlreadyMember(!!existing);
      setPreview({
        id: serverId!,
        name: serverData?.name || 'Bilinmeyen Sunucu',
        icon: serverData?.icon || serverData?.name?.charAt(0) || 'S',
        icon_url: serverData?.icon_url || null,
        memberCount: memberCount || 0,
        channelCount: channelCount || 0,
      });
    } catch {
      setPreviewError('Sunucu bilgisi alınamadı');
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(inviteInput), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inviteInput]);

  const handleJoin = async () => {
    if (!inviteInput.trim() || !user) return;
    setLoading(true);
    const code = extractCode(inviteInput);

    const { data: invite } = await supabase
      .from('server_invites')
      .select('*, servers(id, name)')
      .eq('code', code)
      .maybeSingle();

    let serverId: string | null = null;
    let serverName = '';

    if (invite) {
      if ((invite as any).expires_at && new Date((invite as any).expires_at) < new Date()) {
        toast.error(t('joinServer.expired'));
        setLoading(false);
        return;
      }
      if ((invite as any).max_uses && (invite as any).uses >= (invite as any).max_uses) {
        toast.error(t('joinServer.maxUses'));
        setLoading(false);
        return;
      }
      serverId = (invite as any).server_id;
      serverName = (invite as any).servers?.name || '';
      await supabase.from('server_invites').update({ uses: ((invite as any).uses || 0) + 1 } as any).eq('id', invite.id);
    } else {
      const { data: server } = await supabase
        .from('servers')
        .select('id, name')
        .eq('invite_code', code)
        .maybeSingle();

      if (!server) {
        toast.error(t('joinServer.invalidCode'));
        setLoading(false);
        return;
      }
      serverId = server.id;
      serverName = server.name;
    }

    const { data: existing } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', serverId!)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      toast.error(t('joinServer.alreadyMember'));
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('server_members')
      .insert({ server_id: serverId!, user_id: user.id });

    if (error) {
      toast.error(t('joinServer.joinError'));
      setLoading(false);
      return;
    }

    toast.success(t('joinServer.joined', { server: serverName }));
    setInviteInput('');
    setPreview(null);
    setLoading(false);
    onOpenChange(false);
    onServerJoined(serverId!);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setInviteInput('');
      setPreview(null);
      setPreviewError(null);
      setAlreadyMember(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#313338] border-[#1e1f22] text-white p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center">
          <DialogTitle className="text-xl font-bold text-white mb-1">Sunucuya Katıl</DialogTitle>
          <p className="text-sm text-[#b5bac1]">Davet bağlantısı veya kodu yapıştırarak bir sunucuya katılabilirsin.</p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#b5bac1]">Davet Bağlantısı</label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6d6f78]" />
              <Input
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="https://aurorach.at/invite/xyz123"
                className="bg-[#1e1f22] border-[#3f4147] text-white placeholder:text-[#6d6f78] pl-9 pr-9 focus-visible:ring-[#5865f2]/50 focus-visible:border-[#5865f2]"
                onKeyDown={(e) => e.key === 'Enter' && !alreadyMember && preview && handleJoin()}
              />
              {previewing && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6d6f78] animate-spin" />
              )}
              {inviteInput && !previewing && (
                <button
                  onClick={() => setInviteInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6d6f78] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-[#6d6f78]">Davetler şuna benzer: nw4e5pS veya https://aurorach.at/invite/nw4e5pS</p>
          </div>

          {/* Error state */}
          {previewError && inviteInput && (
            <div className="rounded-xl border border-[#ed4245]/30 bg-[#ed4245]/10 p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#ed4245]/20 flex items-center justify-center flex-shrink-0">
                <X className="w-4 h-4 text-[#ed4245]" />
              </div>
              <p className="text-sm text-[#ed4245]">{previewError}</p>
            </div>
          )}

          {/* Server Preview Card */}
          {preview && !previewError && (
            <div className="rounded-xl border border-[#3f4147] bg-[#2b2d31] overflow-hidden">
              {/* Banner area */}
              <div className={`h-16 bg-gradient-to-r from-[#5865f2]/40 to-[#4752c4]/40`} />

              <div className="px-4 pb-4">
                {/* Server icon */}
                <div className="-mt-8 mb-3">
                  {preview.icon_url ? (
                    <img
                      src={preview.icon_url}
                      alt={preview.name}
                      className="w-14 h-14 rounded-2xl border-4 border-[#2b2d31] object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl border-4 border-[#2b2d31] bg-[#5865f2] flex items-center justify-center">
                      <span className="text-xl font-bold text-white">{preview.icon}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1 mb-3">
                  <h3 className="text-lg font-bold text-white">{preview.name}</h3>
                  {alreadyMember && (
                    <div className="flex items-center gap-1.5 text-xs text-[#3ba55d]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Zaten bu sunucunun üyesisin</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-[#b5bac1]">
                    <div className="w-2 h-2 rounded-full bg-[#3ba55d]" />
                    <span>{preview.memberCount} üye</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#b5bac1]">
                    <Hash className="w-3.5 h-3.5" />
                    <span>{preview.channelCount} kanal</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#b5bac1]">
                    <Users className="w-3.5 h-3.5" />
                    <span>Topluluk</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleJoin}
            disabled={loading || !inviteInput.trim() || !!previewError || alreadyMember || previewing}
            className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold h-11 rounded-xl disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : alreadyMember ? (
              'Zaten üyesin'
            ) : preview ? (
              `"${preview.name}" sunucusuna katıl`
            ) : (
              t('joinServer.joinButton')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JoinServerDialog;
