import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, AtSign, Bell, X, ArrowRight } from 'lucide-react';

export interface InAppNotif {
  id: string;
  type: 'dm' | 'mention' | string;
  title: string;
  body: string;
  avatarUrl?: string | null;
  channelId?: string;
  messageId?: string;
  conversationId?: string;
}

interface Props {
  onNavigate?: (channelId: string, messageId?: string) => void;
}

let _addNotif: ((n: InAppNotif) => void) | null = null;

export function showInAppNotification(n: InAppNotif) {
  _addNotif?.(n);
}

const getIcon = (type: string) => {
  if (type === 'dm') return { Icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/15' };
  if (type === 'mention') return { Icon: AtSign, color: 'text-orange-400', bg: 'bg-orange-500/15' };
  return { Icon: Bell, color: 'text-primary', bg: 'bg-primary/15' };
};

export default function InAppNotificationToast({ onNavigate }: Props) {
  const [queue, setQueue] = useState<(InAppNotif & { timer?: ReturnType<typeof setTimeout> })[]>([]);

  const addNotif = useCallback((n: InAppNotif) => {
    setQueue(prev => {
      if (prev.length >= 3) return prev;
      return [...prev, n];
    });
    setTimeout(() => {
      setQueue(prev => prev.filter(item => item.id !== n.id));
    }, 5000);
  }, []);

  useEffect(() => {
    _addNotif = addNotif;
    return () => {
      // Don't set to null — the next mounted instance will overwrite it.
      // Clearing to null would break notifications during view transitions.
      if (_addNotif === addNotif) _addNotif = null;
    };
  }, [addNotif]);

  const dismiss = (id: string) => setQueue(prev => prev.filter(n => n.id !== id));

  const handleClick = (n: InAppNotif) => {
    if (onNavigate) {
      const target = n.channelId || n.conversationId;
      if (target) onNavigate(target, n.messageId);
    }
    dismiss(n.id);
  };

  if (queue.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 items-end pointer-events-none">
      {queue.map(n => {
        const { Icon, color, bg } = getIcon(n.type);
        const nav = !!(onNavigate && (n.channelId || n.conversationId));
        return (
          <div
            key={n.id}
            className="pointer-events-auto w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300"
          >
            <div className="flex items-start gap-3 p-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                {n.avatarUrl ? (
                  <img src={n.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <Icon className={`w-4 h-4 ${color}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <Icon className={`w-3 h-3 ${color} shrink-0`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>
                    {n.type === 'dm' ? 'Direkt Mesaj' : n.type === 'mention' ? 'Etiket' : 'Bildirim'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{n.body}</p>
                {nav && (
                  <button
                    onClick={() => handleClick(n)}
                    className={`mt-1.5 text-[10px] flex items-center gap-0.5 font-medium ${color} hover:underline`}
                  >
                    Mesaja git <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(n.id)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className={`h-0.5 ${n.type === 'dm' ? 'bg-indigo-500/40' : n.type === 'mention' ? 'bg-orange-500/40' : 'bg-primary/40'} animate-[shrink_5s_linear_forwards]`} />
          </div>
        );
      })}
    </div>
  );
}
