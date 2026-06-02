import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Users, AlertCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FriendOption {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  friends: FriendOption[];
  onCreated: (groupId: string) => void;
  prefilledUserId?: string | null;
}

const MAX_MEMBERS = 10;

const CreateGroupDMModal = ({ open, onOpenChange, friends, onCreated, prefilledUserId }: Props) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch(''); setGroupName(''); setSelected(new Set()); setCreating(false); setError('');
    } else if (prefilledUserId) {
      setSelected(new Set([prefilledUserId]));
    }
  }, [open, prefilledUserId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return friends.filter(f =>
      !q || f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  }, [friends, search]);

  const remaining = MAX_MEMBERS - 1 - selected.size; // -1 for self (owner)

  const toggle = (uid: string) => {
    setError('');
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uid)) { next.delete(uid); return next; }
      if (next.size >= MAX_MEMBERS - 1) {
        setError(`En fazla ${MAX_MEMBERS} üye olabilir (sen dahil).`);
        return prev;
      }
      next.add(uid);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!user) return;
    if (selected.size < 1) { setError('En az 1 arkadaş seçmelisiniz.'); return; }
    setCreating(true);
    setError('');
    try {
      const { data: group, error: gErr } = await supabase
        .from('group_dms' as any)
        .insert({ name: groupName.trim() || null, owner_id: user.id })
        .select('id')
        .single();
      if (gErr || !group) throw gErr || new Error('insert failed');
      const groupId = (group as any).id as string;

      const memberRows = [user.id, ...Array.from(selected)].map(uid => ({ group_id: groupId, user_id: uid }));
      const { error: mErr } = await supabase.from('group_dm_members' as any).insert(memberRows);
      if (mErr) {
        await supabase.from('group_dms' as any).delete().eq('id', groupId);
        throw mErr;
      }
      toast.success('Grup mesajı oluşturuldu');
      onCreated(groupId);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Grup oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!creating) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Grup mesajı oluştur
          </DialogTitle>
          <DialogDescription>
            Arkadaşlarını seç ve birlikte sohbet edin. En fazla {MAX_MEMBERS} kişi (sen dahil).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Grup Adı (opsiyonel)</label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, 32))}
              placeholder="örn. Oyun Arkadaşları"
              className="bg-input border-border"
              maxLength={32}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Üyeler · {selected.size}/{MAX_MEMBERS - 1} seçili
              </label>
              <span className={`text-[11px] font-medium ${remaining <= 2 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {remaining} slot kaldı
              </span>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Arkadaş ara..."
                className="pl-8 bg-input border-border h-9"
              />
            </div>
            <div className="rounded-lg border border-border bg-card max-h-64 overflow-y-auto scrollbar-thin">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {friends.length === 0 ? 'Henüz arkadaşın yok.' : 'Eşleşen arkadaş yok.'}
                </div>
              ) : (
                filtered.map(f => {
                  const isSel = selected.has(f.userId);
                  return (
                    <button
                      key={f.userId}
                      type="button"
                      onClick={() => toggle(f.userId)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/40 ${isSel ? 'bg-primary/10' : ''}`}
                    >
                      <Checkbox checked={isSel} onCheckedChange={() => toggle(f.userId)} className="shrink-0" />
                      <Avatar className="h-7 w-7 shrink-0">
                        {f.avatarUrl && <AvatarImage src={f.avatarUrl} />}
                        <AvatarFallback className="bg-secondary text-foreground text-[11px]">{f.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{f.displayName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">@{f.username}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).map(uid => {
                const f = friends.find(x => x.userId === uid);
                if (!f) return null;
                return (
                  <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
                    {f.displayName}
                    <button onClick={() => toggle(uid)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                  </span>
                );
              })}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={creating}>İptal</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={creating || selected.size === 0}>
              {creating ? 'Oluşturuluyor...' : `Oluştur (${selected.size + 1})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDMModal;
