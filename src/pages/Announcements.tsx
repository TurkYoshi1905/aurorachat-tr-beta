import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { ArrowLeft, Megaphone, Plus, Trash2, MessageSquare, Send, Bold, Italic, Link2, Image, X, Loader2, ChevronDown, ChevronUp, Reply, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const parts = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">$1</a>')
    .replace(/\n/g, '<br/>');
  return { __html: parts };
};

export default function Announcements() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsByAnn, setCommentsByAnn] = useState<Record<string, Comment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<Record<string, string | null>>({});
  const [sendingComment, setSendingComment] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [deletingComment, setDeletingComment] = useState<Set<string>>(new Set());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any).rpc('get_announcements_with_authors');
      setAnnouncements((data as Announcement[]) || []);
    } catch {
      const { data } = await (supabase as any).from('announcements').select('*').order('created_at', { ascending: false });
      setAnnouncements((data || []).map((a: any) => ({ ...a, author: { display_name: 'Kullanıcı', username: '', avatar_url: null }, comment_count: 0 })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  useEffect(() => {
    const ch = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAnnouncements]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Resim 10MB\'dan büyük olamaz'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const insertFormatting = (before: string, after: string) => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handlePublish = async () => {
    if (!user || !isAdmin) return;
    if (!title.trim()) { toast.error('Başlık gerekli'); return; }
    if (!content.trim()) { toast.error('İçerik gerekli'); return; }
    setPublishing(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `announcements/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, imageFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }
      }
      const { error } = await (supabase as any).from('announcements').insert({
        title: title.trim(), content: content.trim(), image_url: imageUrl, author_id: user.id,
      });
      if (error) throw error;
      toast.success('Duyuru yayınlandı!');
      setTitle(''); setContent(''); setImageFile(null); setImagePreview(null); setShowCreate(false);
    } catch (err: any) {
      toast.error('Yayınlanamadı: ' + (err?.message || 'Hata'));
    } finally { setPublishing(false); }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Duyuruyu silmek istediğine emin misin?')) return;
    setDeleting(prev => new Set(prev).add(id));
    try {
      await (supabase as any).from('announcement_comments').delete().eq('announcement_id', id);
      const { error } = await (supabase as any).from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Duyuru silindi');
    } catch { toast.error('Silinemedi'); }
    finally { setDeleting(prev => { const s = new Set(prev); s.delete(id); return s; }); }
  };

  const toggleComments = async (annId: string) => {
    const isOpen = expandedComments.has(annId);
    if (isOpen) {
      setExpandedComments(prev => { const s = new Set(prev); s.delete(annId); return s; });
      return;
    }
    setExpandedComments(prev => new Set(prev).add(annId));
    if (commentsByAnn[annId]) return;
    setLoadingComments(prev => new Set(prev).add(annId));
    try {
      const { data } = await (supabase as any).rpc('get_announcement_comments', { p_announcement_id: annId });
      setCommentsByAnn(prev => ({ ...prev, [annId]: (data as Comment[]) || [] }));
    } catch {
      const { data } = await (supabase as any).from('announcement_comments').select('*').eq('announcement_id', annId).order('created_at');
      setCommentsByAnn(prev => ({ ...prev, [annId]: (data || []).map((c: any) => ({ ...c, author: { display_name: 'Kullanıcı', username: '', avatar_url: null } })) }));
    } finally { setLoadingComments(prev => { const s = new Set(prev); s.delete(annId); return s; }); }

    const ch = supabase.channel(`ann-comments-${annId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${annId}` }, async () => {
        const { data } = await (supabase as any).rpc('get_announcement_comments', { p_announcement_id: annId });
        setCommentsByAnn(prev => ({ ...prev, [annId]: (data as Comment[]) || [] }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${annId}` }, (payload: any) => {
        setCommentsByAnn(prev => ({ ...prev, [annId]: (prev[annId] || []).filter(c => c.id !== payload.old.id) }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  };

  const handleSendComment = async (annId: string) => {
    if (!user) { toast.error('Yorum yapmak için giriş yapmalısın'); return; }
    const text = commentInputs[annId]?.trim();
    if (!text) return;
    setSendingComment(prev => new Set(prev).add(annId));
    try {
      const parentId = replyingTo[annId] || null;
      const { error } = await (supabase as any).from('announcement_comments').insert({
        announcement_id: annId, author_id: user.id, content: text, parent_id: parentId,
      });
      if (error) throw error;
      setCommentInputs(prev => ({ ...prev, [annId]: '' }));
      setReplyingTo(prev => ({ ...prev, [annId]: null }));
      const { data } = await (supabase as any).rpc('get_announcement_comments', { p_announcement_id: annId });
      setCommentsByAnn(prev => ({ ...prev, [annId]: (data as Comment[]) || [] }));
      setAnnouncements(prev => prev.map(a => a.id === annId ? { ...a, comment_count: a.comment_count + 1 } : a));
    } catch { toast.error('Yorum gönderilemedi'); }
    finally { setSendingComment(prev => { const s = new Set(prev); s.delete(annId); return s; }); }
  };

  const handleDeleteComment = async (commentId: string, annId: string) => {
    setDeletingComment(prev => new Set(prev).add(commentId));
    try {
      const { error } = await (supabase as any).from('announcement_comments').delete().eq('id', commentId);
      if (error) throw error;
      setCommentsByAnn(prev => ({ ...prev, [annId]: (prev[annId] || []).filter(c => c.id !== commentId) }));
      setAnnouncements(prev => prev.map(a => a.id === annId ? { ...a, comment_count: Math.max(0, a.comment_count - 1) } : a));
    } catch { toast.error('Silinemedi'); }
    finally { setDeletingComment(prev => { const s = new Set(prev); s.delete(commentId); return s; }); }
  };

  const CommentTree = ({ comments, parentId, annId }: { comments: Comment[]; parentId: string | null; annId: string }) => {
    const filtered = comments.filter(c => c.parent_id === parentId);
    if (filtered.length === 0) return null;
    return (
      <div className={parentId ? 'ml-8 border-l-2 border-border pl-3 space-y-3 mt-3' : 'space-y-3'}>
        {filtered.map(comment => (
          <div key={comment.id} className="group">
            <div className="flex gap-2.5">
              <Avatar className="w-7 h-7 shrink-0">
                {comment.author.avatar_url && <AvatarImage src={comment.author.avatar_url} />}
                <AvatarFallback className="text-[10px] bg-secondary">{(comment.author.display_name || 'K').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">{comment.author.display_name}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(comment.created_at)}</span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed mt-0.5 break-words">{comment.content}</p>
                <div className="flex items-center gap-3 mt-1">
                  {!parentId && (
                    <button
                      onClick={() => setReplyingTo(prev => ({ ...prev, [annId]: prev[annId] === comment.id ? null : comment.id }))}
                      className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      <Reply className="w-3 h-3" /> Yanıtla
                    </button>
                  )}
                  {(isAdmin || comment.author_id === user?.id) && (
                    <button
                      onClick={() => handleDeleteComment(comment.id, annId)}
                      disabled={deletingComment.has(comment.id)}
                      className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {deletingComment.has(comment.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {replyingTo[annId] === comment.id && (
              <div className="ml-9 mt-2 flex gap-2">
                <Input
                  value={commentInputs[`${annId}-reply-${comment.id}`] || ''}
                  onChange={e => setCommentInputs(prev => ({ ...prev, [`${annId}-reply-${comment.id}`]: e.target.value }))}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const text = (commentInputs[`${annId}-reply-${comment.id}`] || '').trim();
                      if (!text || !user) return;
                      setSendingComment(prev => new Set(prev).add(annId));
                      try {
                        await (supabase as any).from('announcement_comments').insert({ announcement_id: annId, author_id: user.id, content: text, parent_id: comment.id });
                        setCommentInputs(prev => ({ ...prev, [`${annId}-reply-${comment.id}`]: '' }));
                        setReplyingTo(prev => ({ ...prev, [annId]: null }));
                        const { data } = await (supabase as any).rpc('get_announcement_comments', { p_announcement_id: annId });
                        setCommentsByAnn(prev => ({ ...prev, [annId]: (data as Comment[]) || [] }));
                        setAnnouncements(prev => prev.map(a => a.id === annId ? { ...a, comment_count: a.comment_count + 1 } : a));
                      } finally { setSendingComment(prev => { const s = new Set(prev); s.delete(annId); return s; }); }
                    }
                  }}
                  placeholder="Yanıt yaz... (Enter ile gönder)"
                  className="flex-1 h-8 text-xs bg-input border-border"
                  autoFocus
                />
                <button onClick={() => setReplyingTo(prev => ({ ...prev, [annId]: null }))} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <CommentTree comments={comments} parentId={comment.id} annId={annId} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Duyurular</h1>
              <p className="text-xs text-muted-foreground">AuroraChat resmi duyuruları</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(v => !v)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Duyuru Yayınla
            </button>
          )}
        </div>

        {/* Admin Create Panel */}
        {isAdmin && showCreate && (
          <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Yeni Duyuru</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Duyuru başlığı..." className="bg-input border-border font-semibold" maxLength={200} />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 border border-border rounded-t-lg px-2 py-1.5 bg-secondary/30">
                <button type="button" onClick={() => insertFormatting('**', '**')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Kalın">
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => insertFormatting('*', '*')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="İtalik">
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => insertFormatting('[', '](https://)')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Link">
                  <Link2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <span className="text-[10px] text-muted-foreground">**kalın** *italik* [link](url)</span>
              </div>
              <textarea
                ref={contentRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Duyuru içeriği..."
                rows={8}
                className="w-full bg-input border border-t-0 border-border rounded-b-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            </div>
            <div>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="" className="w-full max-h-48 object-cover" />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 flex items-center justify-center text-foreground hover:bg-background">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl px-4 py-3 w-full justify-center hover:border-primary/50 transition-colors">
                  <ImageIcon className="w-4 h-4" /> Resim ekle (isteğe bağlı)
                </button>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handlePublish} disabled={publishing || !title.trim() || !content.trim()} className="flex-1 gap-1.5">
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Yayınla
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!loading && announcements.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-7 h-7 text-primary/60" />
            </div>
            <p className="text-foreground font-semibold">Henüz duyuru yok</p>
            <p className="text-sm text-muted-foreground">İlk duyuru yayınlandığında burada görünecek.</p>
          </div>
        )}

        {/* Announcements List */}
        {announcements.map(ann => (
          <div
            key={ann.id}
            className="rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/30 transition-colors group/card"
            onClick={() => navigate(`/announcements/${ann.id}`)}
          >
            {/* Author row */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  {ann.author.avatar_url && <AvatarImage src={ann.author.avatar_url} />}
                  <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                    {(ann.author.display_name || 'K').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{ann.author.display_name}</span>
                    <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 px-1.5 py-0.5 rounded font-bold">YÖNETİCİ</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(ann.created_at)}</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteAnnouncement(ann.id); }}
                  disabled={deleting.has(ann.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                  title="Duyuruyu sil"
                >
                  {deleting.has(ann.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Content */}
            <div className="px-5 pb-4 space-y-3">
              <h2 className="text-lg font-bold text-foreground leading-snug">{ann.title}</h2>
              <div className="text-sm text-foreground/85 leading-relaxed prose-sm max-w-none" dangerouslySetInnerHTML={renderContent(ann.content)} />
              {ann.image_url && (
                <div className="rounded-xl overflow-hidden border border-border mt-3">
                  <img src={ann.image_url} alt="" className="w-full max-h-80 object-cover" />
                </div>
              )}
            </div>

            {/* Comments toggle */}
            <div className="border-t border-border px-5 py-3" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => toggleComments(ann.id)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{ann.comment_count} yorum</span>
                {expandedComments.has(ann.id) ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>

              {expandedComments.has(ann.id) && (
                <div className="mt-4 space-y-4">
                  {loadingComments.has(ann.id) ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <CommentTree comments={commentsByAnn[ann.id] || []} parentId={null} annId={ann.id} />
                  )}
                  {/* Comment input */}
                  <div className="flex gap-2.5 pt-2 border-t border-border">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarFallback className="text-[10px] bg-secondary">{user ? (user.email || 'U').charAt(0).toUpperCase() : '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={commentInputs[ann.id] || ''}
                        onChange={e => setCommentInputs(prev => ({ ...prev, [ann.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(ann.id); } }}
                        placeholder={user ? 'Yorum yaz...' : 'Yorum yapmak için giriş yapmalısın'}
                        disabled={!user}
                        className="flex-1 h-8 text-sm bg-input border-border"
                      />
                      <button
                        onClick={() => handleSendComment(ann.id)}
                        disabled={!user || !commentInputs[ann.id]?.trim() || sendingComment.has(ann.id)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1"
                      >
                        {sendingComment.has(ann.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
