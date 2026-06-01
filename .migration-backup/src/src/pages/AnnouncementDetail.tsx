import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { ArrowLeft, Megaphone, Trash2, MessageSquare, Send, Loader2, Reply, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const ADMIN_EMAIL = 'asfurkan140@gmail.com';

interface AnnouncementAuthor {
  display_name: string;
  username: string;
  avatar_url: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  author: AnnouncementAuthor;
  comment_count: number;
}

interface Comment {
  id: string;
  announcement_id: string;
  content: string;
  parent_id: string | null;
  author_id: string | null;
  created_at: string;
  author: AnnouncementAuthor;
}

const fmtDate = (d: string) => format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: trLocale });

const renderContent = (text: string) => {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">$1</a>')
    .replace(/\n/g, '<br/>');
  return { __html: html };
};

export default function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [deletingComment, setDeletingComment] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchAnnouncement = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any).rpc('get_announcements_with_authors');
      const ann = (data as Announcement[] | null)?.find(a => a.id === id);
      if (ann) {
        setAnnouncement(ann);
      } else {
        const { data: raw } = await (supabase as any).from('announcements').select('*').eq('id', id).single();
        if (raw) {
          setAnnouncement({ ...raw, author: { display_name: 'Yönetici', username: '', avatar_url: null }, comment_count: 0 });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    setLoadingComments(true);
    try {
      const { data } = await (supabase as any).rpc('get_announcement_comments', { p_announcement_id: id });
      setComments((data as Comment[]) || []);
    } catch {
      const { data } = await (supabase as any).from('announcement_comments').select('*').eq('announcement_id', id).order('created_at');
      setComments((data || []).map((c: any) => ({ ...c, author: { display_name: 'Kullanıcı', username: '', avatar_url: null } })));
    } finally {
      setLoadingComments(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnnouncement();
    fetchComments();
  }, [fetchAnnouncement, fetchComments]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`ann-detail-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${id}` }, () => fetchComments())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${id}` }, (payload: any) => {
        setComments(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, fetchComments]);

  const handleSendComment = async () => {
    if (!user || !id) { toast.error('Yorum yapmak için giriş yapmalısın'); return; }
    const text = commentText.trim();
    if (!text) return;
    setSendingComment(true);
    try {
      const { error } = await (supabase as any).from('announcement_comments').insert({
        announcement_id: id, author_id: user.id, content: text, parent_id: null,
      });
      if (error) throw error;
      setCommentText('');
      fetchComments();
      setAnnouncement(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
    } catch { toast.error('Yorum gönderilemedi'); }
    finally { setSendingComment(false); }
  };

  const handleSendReply = async (parentId: string) => {
    if (!user || !id) return;
    const text = (replyTexts[parentId] || '').trim();
    if (!text) return;
    setSendingComment(true);
    try {
      const { error } = await (supabase as any).from('announcement_comments').insert({
        announcement_id: id, author_id: user.id, content: text, parent_id: parentId,
      });
      if (error) throw error;
      setReplyTexts(prev => ({ ...prev, [parentId]: '' }));
      setReplyingTo(null);
      fetchComments();
      setAnnouncement(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
    } catch { toast.error('Yanıt gönderilemedi'); }
    finally { setSendingComment(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingComment(prev => new Set(prev).add(commentId));
    try {
      await (supabase as any).from('announcement_comments').delete().eq('id', commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setAnnouncement(prev => prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : prev);
    } catch { toast.error('Silinemedi'); }
    finally { setDeletingComment(prev => { const s = new Set(prev); s.delete(commentId); return s; }); }
  };

  const handleDeleteAnnouncement = async () => {
    if (!isAdmin || !id || !announcement) return;
    if (!confirm('Duyuruyu silmek istediğine emin misin?')) return;
    setDeleting(true);
    try {
      await (supabase as any).from('announcement_comments').delete().eq('announcement_id', id);
      const { error } = await (supabase as any).from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast.success('Duyuru silindi');
      navigate('/announcements');
    } catch { toast.error('Silinemedi'); }
    finally { setDeleting(false); }
  };

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const replies = comments.filter(c => c.parent_id === comment.id);
    const isReplying = replyingTo === comment.id;

    return (
      <div className={depth > 0 ? 'ml-8 pl-4 border-l-2 border-border/50' : ''}>
        <div className="group flex gap-2.5 py-3">
          <Avatar className="w-7 h-7 shrink-0 mt-0.5">
            {comment.author.avatar_url && <AvatarImage src={comment.author.avatar_url} />}
            <AvatarFallback className="text-[10px] bg-secondary">{(comment.author.display_name || 'K').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xs font-semibold text-foreground">{comment.author.display_name}</span>
              <span className="text-[10px] text-muted-foreground">{fmtDate(comment.created_at)}</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed break-words">{comment.content}</p>
            <div className="flex items-center gap-3 mt-1.5">
              {depth === 0 && (
                <button
                  onClick={() => setReplyingTo(prev => prev === comment.id ? null : comment.id)}
                  className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <Reply className="w-3 h-3" /> Yanıtla
                </button>
              )}
              {(isAdmin || comment.author_id === user?.id) && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  disabled={deletingComment.has(comment.id)}
                  className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                >
                  {deletingComment.has(comment.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              )}
            </div>
            {isReplying && (
              <div className="mt-2 flex gap-2">
                <Input
                  value={replyTexts[comment.id] || ''}
                  onChange={e => setReplyTexts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(comment.id); } }}
                  placeholder="Yanıt yaz... (Enter)"
                  className="flex-1 h-8 text-xs bg-input border-border"
                  autoFocus
                />
                <button
                  onClick={() => handleSendReply(comment.id)}
                  disabled={sendingComment || !(replyTexts[comment.id] || '').trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40"
                >
                  {sendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        {replies.map(reply => (
          <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </div>
    );
  };

  const topLevelComments = comments.filter(c => c.parent_id === null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-4">
        <Megaphone className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-foreground font-semibold">Duyuru bulunamadı</p>
        <button onClick={() => navigate('/announcements')} className="text-sm text-primary hover:underline">
          Duyurulara dön
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/announcements')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-medium">Geri Dön</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Duyurular</span>
          </div>
        </div>

        {/* Announcement Card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {/* Author row */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                {announcement.author.avatar_url && <AvatarImage src={announcement.author.avatar_url} />}
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                  {(announcement.author.display_name || 'K').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground">{announcement.author.display_name}</span>
                  <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 px-1.5 py-0.5 rounded font-bold">YÖNETİCİ</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{fmtDate(announcement.created_at)}</span>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={handleDeleteAnnouncement}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sil
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-4">
            <h1 className="text-2xl font-bold text-foreground leading-tight">{announcement.title}</h1>
            <div
              className="text-sm text-foreground/85 leading-relaxed"
              dangerouslySetInnerHTML={renderContent(announcement.content)}
            />
            {announcement.image_url && (
              <div className="rounded-xl overflow-hidden border border-border mt-4">
                <img src={announcement.image_url} alt="" className="w-full max-h-[500px] object-cover" />
              </div>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Yorumlar
              {announcement.comment_count > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">({announcement.comment_count})</span>
              )}
            </h2>
          </div>

          {/* Comment input */}
          <div className="px-6 py-4 border-b border-border/50">
            <div className="flex gap-2.5">
              <Avatar className="w-7 h-7 shrink-0 mt-1">
                <AvatarFallback className="text-[10px] bg-secondary">
                  {user ? (user.email || 'U').charAt(0).toUpperCase() : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  placeholder={user ? 'Yorum yaz...' : 'Yorum yapmak için giriş yapmalısın'}
                  disabled={!user}
                  className="flex-1 h-9 text-sm bg-input border-border"
                />
                <button
                  onClick={handleSendComment}
                  disabled={!user || !commentText.trim() || sendingComment}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  {sendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Comments list */}
          <div className="px-6 py-3">
            {loadingComments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : topLevelComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Henüz yorum yok. İlk yorumu sen yap!</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {topLevelComments.map(comment => (
                  <CommentItem key={comment.id} comment={comment} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
