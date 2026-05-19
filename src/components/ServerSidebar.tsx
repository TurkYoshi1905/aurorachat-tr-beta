import { useState, useEffect, useMemo } from 'react';
import { DbServer } from '@/types/chat';
import CreateServerDialog from './CreateServerDialog';
import JoinServerDialog from './JoinServerDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, LogIn, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { saveServerOrder, loadServerOrder } from '@/lib/serverOrderStore';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent, Modifier,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface ServerSidebarProps {
  activeServer: string;
  onServerChange: (id: string) => void;
  servers: DbServer[];
  onServerCreated: (serverId: string) => void;
}

const MAX_SERVERS = 100;

interface SortableServerProps {
  server: DbServer;
  isActive: boolean;
  onClick: () => void;
}

const SortableServer = ({ server, isActive, onClick }: SortableServerProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: server.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative flex items-center justify-center w-full" {...attributes} {...listeners}>
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-foreground rounded-r-full transition-all pointer-events-none" />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid={`server-button-${server.id}`}
            className={`w-12 h-12 flex items-center justify-center font-semibold text-lg transition-all duration-200 shrink-0 overflow-hidden ${
              isActive
                ? 'bg-primary text-primary-foreground rounded-[16px]'
                : 'bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground rounded-[24px] hover:rounded-[16px]'
            }`}
            onClick={onClick}
          >
            {server.icon && (server.icon.startsWith('http') || server.icon.startsWith('/'))
              ? (<img src={server.icon} alt={server.name} className="w-full h-full object-cover rounded-[inherit] pointer-events-none" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />)
              : (server.icon || server.name.charAt(0).toUpperCase())}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right"><p>{server.name}</p></TooltipContent>
      </Tooltip>
    </div>
  );
};

const ServerSidebar = ({ activeServer, onServerChange, servers, onServerCreated }: ServerSidebarProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const isAtLimit = servers.length >= MAX_SERVERS;

  // Pull persisted order — IndexedDB first (instant), then Supabase in background
  useEffect(() => {
    if (!user || servers.length === 0) { setOrder(servers.map(s => s.id)); return; }
    let cancelled = false;
    const ids = servers.map(s => s.id);

    const applyOrder = (orderedIds: string[]) => {
      if (cancelled) return;
      const byId = new Map(servers.map(s => [s.id, s]));
      const known = orderedIds.filter(id => byId.has(id));
      const rest = ids.filter(id => !known.includes(id));
      setOrder([...known, ...rest]);
    };

    (async () => {
      // 1. IndexedDB — instant display (no network)
      const cached = await loadServerOrder(user.id);
      if (cached && cached.length > 0) applyOrder(cached);

      // 2. Supabase — authoritative source (background)
      const { data } = await supabase
        .from('server_members')
        .select('server_id, order_index')
        .eq('user_id', user.id)
        .in('server_id', ids);
      if (cancelled) return;
      const indexMap = new Map<string, number>((data || []).map((r: any) => [r.server_id, r.order_index ?? 0]));
      const fromDB = [...servers]
        .sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0))
        .map(s => s.id);
      applyOrder(fromDB);
      // Sync latest DB order back to IndexedDB
      await saveServerOrder(user.id, fromDB);
    })();
    return () => { cancelled = true; };
  }, [user, servers]);

  const orderedServers = useMemo(() => {
    const byId = new Map(servers.map(s => [s.id, s]));
    const ordered = order.map(id => byId.get(id)).filter(Boolean) as DbServer[];
    // append any servers not yet in order array (newly joined)
    for (const s of servers) if (!order.includes(s.id)) ordered.push(s);
    return ordered;
  }, [servers, order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const persistOrder = async (newOrderIds: string[]) => {
    if (!user) return;
    // Save to IndexedDB immediately for instant load on next page visit
    saveServerOrder(user.id, newOrderIds);
    // Persist to Supabase in background
    await Promise.all(
      newOrderIds.map((sid, idx) =>
        supabase.from('server_members').update({ order_index: idx } as any).eq('user_id', user.id).eq('server_id', sid)
      )
    );
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex(id => id === active.id);
    const newIdx = order.findIndex(id => id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    persistOrder(next);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-w-[72px] max-w-[72px] h-full bg-server-bg flex flex-col items-center py-3 gap-2">

        {/* Home / DM button */}
        <div className="relative flex items-center justify-center w-full">
          {activeServer === 'home' && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-foreground rounded-r-full transition-all" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="server-button-home"
                className={`w-12 h-12 flex items-center justify-center font-semibold text-lg transition-all duration-200 shrink-0 overflow-hidden ${
                  activeServer === 'home'
                    ? 'bg-primary text-primary-foreground rounded-[16px] scale-100'
                    : 'bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded-[24px] hover:rounded-[16px]'
                }`}
                onClick={() => onServerChange('home')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>Mesajlar</p></TooltipContent>
          </Tooltip>
        </div>

        <div className="w-8 h-[2px] bg-border rounded-full shrink-0" />

        {/* Server list (drag-drop) */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col items-center gap-2 w-full">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={orderedServers.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {orderedServers.map((server) => (
                <SortableServer
                  key={server.id}
                  server={server}
                  isActive={activeServer === server.id}
                  onClick={() => onServerChange(server.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="w-8 h-[2px] bg-border rounded-full shrink-0" />

        {/* Discover Communities button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="button-explore-communities"
              className="w-12 h-12 flex items-center justify-center rounded-[24px] hover:rounded-[16px] transition-all duration-200 touch-manipulation bg-secondary text-cyan-400 hover:bg-cyan-500 hover:text-white"
              onClick={() => navigate('/communities')}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <Compass className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right"><p>Keşfet</p></TooltipContent>
        </Tooltip>

        {/* Add / Join buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="button-create-server"
              className={`w-12 h-12 flex items-center justify-center rounded-[24px] hover:rounded-[16px] transition-all duration-200 touch-manipulation ${
                isAtLimit
                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-secondary text-aurora-green hover:bg-aurora-green hover:text-primary-foreground'
              }`}
              onClick={() => { if (!isAtLimit) setShowCreateDialog(true); }}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <Plus className="w-6 h-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right"><p>{isAtLimit ? t('server.maxReached', { max: MAX_SERVERS }) : t('server.create')}</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="button-join-server"
              className={`w-12 h-12 flex items-center justify-center rounded-[24px] hover:rounded-[16px] transition-all duration-200 touch-manipulation ${
                isAtLimit
                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-secondary text-primary hover:bg-primary hover:text-primary-foreground'
              }`}
              onClick={() => { if (!isAtLimit) setShowJoinDialog(true); }}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <LogIn className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right"><p>{isAtLimit ? t('server.maxReached', { max: MAX_SERVERS }) : t('server.join')}</p></TooltipContent>
        </Tooltip>

        <CreateServerDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onServerCreated={onServerCreated} />
        <JoinServerDialog open={showJoinDialog} onOpenChange={setShowJoinDialog} onServerJoined={onServerCreated} />
      </div>
    </TooltipProvider>
  );
};

export default ServerSidebar;
