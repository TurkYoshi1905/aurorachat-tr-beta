import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Puzzle, Download, Trash2, Check, Loader2, Star,
  User2, MessageSquare, Pencil, Save, X, Clock,
} from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  install_count: number;
  creator_display_name?: string;
  creator_username?: string;
  css_code?: string;
  js_code?: string;
}

interface Review {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: { display_name: string | null; username: string | null };
}

const StarRating = ({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
        >
          <Star
            className={`w-4 h-4 ${
              star <= (hover || value)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-muted-foreground/40'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

interface PluginDetailModalProps {
  plugin: Plugin | null;
  open: boolean;
  onClose: () => void;
  installed: boolean;
  onInstall: (p: Plugin) => void;
  onRemove: (p: Plugin) => void;
  installing: boolean;
}

const PluginDetailModal = ({
  plugin,
  open,
  onClose,
  installed,
  onInstall,
  onRemove,
  installing,
}: PluginDetailModalProps) => {
  const { user } = useAuth();
  const [avgRating, setAvgRating] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [totalRatings, setTotalRatings] = useState(0);

  const loadDetails = async () => {
    if (!plugin) return;
    setLoadingData(true);
    const [ratingsRes, userRatingRes, reviewsRes] = await Promise.all([
      (supabase as any).from('plugin_ratings').select('stars').eq('plugin_id', plugin.id),
      user ? (supabase as any).from('plugin_ratings').select('stars').eq('plugin_id', plugin.id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      (supabase as any).from('plugin_reviews').select('id, user_id, content, created_at, updated_at').eq('plugin_id', plugin.id).order('created_at', { ascending: false }),
    ]);

    const ratings: { stars: number }[] = ratingsRes.data || [];
    const total = ratings.length;
    const avg = total > 0 ? ratings.reduce((s, r) => s + r.stars, 0) / total : 0;
    setAvgRating(Math.round(avg * 10) / 10);
    setTotalRatings(total);
    setUserRating(userRatingRes.data?.stars || 0);

    const rawReviews: Array<{ id: string; user_id: string; content: string; created_at: string; updated_at: string }> = reviewsRes.data || [];
    if (rawReviews.length > 0) {
      const userIds = [...new Set(rawReviews.map(r => r.user_id))];
      const { data: profilesData } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, username')
        .in('id', userIds);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      setReviews(rawReviews.map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) ? {
          display_name: profileMap.get(r.user_id).display_name,
          username: profileMap.get(r.user_id).username,
        } : { display_name: null, username: null },
      })));
    } else {
      setReviews([]);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (open && plugin) loadDetails();
  }, [open, plugin?.id]);

  const handleRate = async (stars: number) => {
    if (!user || !plugin) return;
    if (userRating === stars) {
      await (supabase as any).from('plugin_ratings').delete().eq('plugin_id', plugin.id).eq('user_id', user.id);
      setUserRating(0);
    } else {
      await (supabase as any).from('plugin_ratings').upsert({ plugin_id: plugin.id, user_id: user.id, stars, updated_at: new Date().toISOString() }, { onConflict: 'plugin_id,user_id' });
      setUserRating(stars);
    }
    loadDetails();
  };

  const handleSubmitReview = async () => {
    if (!user || !plugin || !reviewText.trim()) return;
    setSubmitting(true);
    const existing = reviews.find(r => r.user_id === user.id);
    if (existing) {
      await (supabase as any).from('plugin_reviews').update({ content: reviewText.trim(), updated_at: new Date().toISOString() }).eq('id', existing.id);
      toast.success('Yorumunuz güncellendi');
    } else {
      await (supabase as any).from('plugin_reviews').insert({ plugin_id: plugin.id, user_id: user.id, content: reviewText.trim() });
      toast.success('Yorumunuz eklendi');
    }
    setReviewText('');
    setSubmitting(false);
    loadDetails();
  };

  const handleEditReview = async (reviewId: string) => {
    if (!editContent.trim()) return;
    setSubmitting(true);
    await (supabase as any).from('plugin_reviews').update({ content: editContent.trim(), updated_at: new Date().toISOString() }).eq('id', reviewId);
    setEditingReviewId(null);
    setEditContent('');
    setSubmitting(false);
    toast.success('Yorum güncellendi');
    loadDetails();
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Yorumunuzu silmek istiyor musunuz?')) return;
    await (supabase as any).from('plugin_reviews').delete().eq('id', reviewId);
    toast.success('Yorum silindi');
    loadDetails();
  };

  const myReview = reviews.find(r => r.user_id === user?.id);

  if (!plugin) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/15 flex items-center justify-center border border-primary/20 shrink-0">
                <Puzzle className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-foreground">{plugin.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">v{plugin.version}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plugin.description}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <StarRating value={Math.round(avgRating)} readonly />
                    <span className="text-xs text-muted-foreground ml-1">
                      {avgRating > 0 ? avgRating.toFixed(1) : '—'} ({totalRatings})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Download className="w-3 h-3" /> {plugin.install_count}
                  </span>
                  {(plugin.creator_display_name || plugin.creator_username) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User2 className="w-3 h-3" />
                      {plugin.creator_display_name || `@${plugin.creator_username}`}
                    </span>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-5 space-y-5">
            {/* Install / Remove button */}
            <Button
              variant={installed ? 'destructive' : 'default'}
              className="w-full"
              disabled={installing}
              onClick={() => installed ? onRemove(plugin) : onInstall(plugin)}
            >
              {installing
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : installed
                  ? <><Trash2 className="w-4 h-4 mr-2" />Kaldır</>
                  : <><Download className="w-4 h-4 mr-2" />Yükle & Etkinleştir</>}
              {installed && !installing && (
                <span className="ml-auto text-[10px] bg-white/15 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" /> Aktif
                </span>
              )}
            </Button>

            {/* Star Rating */}
            {user && (
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Puanla</p>
                <div className="flex items-center gap-3">
                  <StarRating value={userRating} onChange={handleRate} />
                  <span className="text-xs text-muted-foreground">
                    {userRating > 0 ? `${userRating} yıldız verdiniz` : 'Henüz puan vermediniz'}
                  </span>
                </div>
              </div>
            )}

            {/* Reviews section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Yorumlar</p>
                <span className="text-xs text-muted-foreground">({reviews.length})</span>
              </div>

              {/* Add / Edit my review */}
              {user && !myReview && (
                <div className="space-y-2">
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    rows={3}
                    placeholder="Bu eklenti hakkında görüşünüzü paylaşın..."
                    className="w-full bg-input border border-input rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSubmitReview} disabled={submitting || !reviewText.trim()}>
                      {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                      Yorum Ekle
                    </Button>
                  </div>
                </div>
              )}

              {loadingData ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-6">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Henüz yorum yok. İlk yorumu siz yapın!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map(review => {
                    const isOwn = review.user_id === user?.id;
                    const isEditing = editingReviewId === review.id;
                    const displayName = review.profile?.display_name || review.profile?.username || 'Kullanıcı';
                    return (
                      <div key={review.id} className={`rounded-xl border p-3 space-y-2 ${isOwn ? 'border-primary/20 bg-primary/5' : 'border-border bg-secondary/10'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-violet-500/20 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-primary">{displayName[0]?.toUpperCase()}</span>
                            </div>
                            <span className="text-xs font-semibold text-foreground">{displayName}</span>
                            {isOwn && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">Siz</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(review.created_at).toLocaleDateString('tr-TR')}
                            </span>
                            {isOwn && !isEditing && (
                              <>
                                <button onClick={() => { setEditingReviewId(review.id); setEditContent(review.content); }} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDeleteReview(review.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              rows={2}
                              className="w-full bg-input border border-input rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 text-foreground resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setEditingReviewId(null)}>İptal</Button>
                              <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleEditReview(review.id)} disabled={submitting}>
                                {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                Kaydet
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-foreground/80 leading-relaxed">{review.content}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-5 py-3 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={onClose}>Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PluginDetailModal;
