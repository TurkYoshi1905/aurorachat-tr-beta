import { COMMANDS, CommandDef } from '@/utils/botCommands';
import { Bot, Lock, Unlock, UserMinus, Ban, Clock, Info, List, HelpCircle, Moon, Sun, BarChart2 } from 'lucide-react';

const COMMAND_ICONS: Record<string, React.ReactNode> = {
  help: <HelpCircle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
  list: <List className="w-4 h-4" />,
  poll: <BarChart2 className="w-4 h-4" />,
  afk: <Moon className="w-4 h-4" />,
  unafk: <Sun className="w-4 h-4" />,
  lock: <Lock className="w-4 h-4" />,
  unlock: <Unlock className="w-4 h-4" />,
  kick: <UserMinus className="w-4 h-4" />,
  ban: <Ban className="w-4 h-4" />,
  unban: <Ban className="w-4 h-4" />,
  timeout: <Clock className="w-4 h-4" />,
  untimeout: <Clock className="w-4 h-4" />,
};

interface SlashCommandPopupProps {
  query: string;
  onSelect: (command: string) => void;
  onClose: () => void;
  isOwner: boolean;
}

const SlashCommandPopup = ({ query, onSelect, onClose, isOwner }: SlashCommandPopupProps) => {
  const filtered = COMMANDS.filter(c => {
    if (!isOwner && c.ownerOnly) return false;
    return c.name.startsWith(query.toLowerCase());
  });

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">AuroraChat Bot Komutları</span>
        </div>
      </div>
      {filtered.map((cmd) => (
        <button
          key={cmd.name}
          onClick={() => { onSelect(cmd.usage); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
        >
          <div className="text-primary">{COMMAND_ICONS[cmd.name] || <Bot className="w-4 h-4" />}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">/{cmd.name}</div>
            <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
          </div>
          {cmd.ownerOnly && <span className="text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-bold">SAHİP</span>}
        </button>
      ))}
    </div>
  );
};

export default SlashCommandPopup;
