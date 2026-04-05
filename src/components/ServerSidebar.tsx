import { useState } from 'react';
import { DbServer } from '@/types/chat';
import CreateServerDialog from './CreateServerDialog';
import JoinServerDialog from './JoinServerDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { Plus, LogIn } from 'lucide-react';

interface ServerSidebarProps { activeServer: string; onServerChange: (id: string) => void; servers: DbServer[]; onServerCreated: (serverId: string) => void; }

const MAX_SERVERS = 100;

const ServerSidebar = ({ activeServer, onServerChange, servers, onServerCreated }: ServerSidebarProps) => {
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const isAtLimit = servers.length >= MAX_SERVERS;

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

        {/* Server list */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col items-center gap-2 w-full">
          {servers.map((server) => {
            const isActive = activeServer === server.id;
            return (
              <div key={server.id} className="relative flex items-center justify-center w-full">
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-foreground rounded-r-full transition-all" />
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
                      onClick={() => onServerChange(server.id)}
                    >
                      {server.icon && (server.icon.startsWith('http') || server.icon.startsWith('/'))
                        ? (<img src={server.icon} alt={server.name} className="w-full h-full object-cover rounded-[inherit]" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />)
                        : (server.icon || server.name.charAt(0).toUpperCase())}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>{server.name}</p></TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>

        <div className="w-8 h-[2px] bg-border rounded-full shrink-0" />

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
