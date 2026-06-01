import { useState, useEffect } from 'react';
import { COMMANDS, CommandDef } from '@/utils/botCommands';
import { supabase } from '@/integrations/supabase/client';
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

interface BotCmdEntry {
  name: string;
  description: string;
  botName: string;
}

interface SlashCommandPopupProps {
  query: string;
  onSelect: (command: string) => void;
  onClose: () => void;
  isOwner: boolean;
  serverId?: string;
}

const SlashCommandPopup = ({ query, onSelect, onClose, isOwner, serverId }: SlashCommandPopupProps) => {
  const [botCmds, setBotCmds] = useState<BotCmdEntry[]>([]);

  useEffect(() => {
    if (!serverId) return;
    (supabase as any).rpc('get_server_bot_commands', { p_server_id: serverId }).then(({ data }: any) => {
      if (!data) return;
      const entries: BotCmdEntry[] = [];
      for (const bot of data) {
        const cmds: Array<{ name: string; description: string }> = Array.isArray(bot.commands) ? bot.commands : [];
        for (const c of cmds) {
          if (c.name) entries.push({ name: c.name, description: c.description || '', botName: bot.bot_name });
        }
      }
      setBotCmds(entries);
    });
  }, [serverId]);

  const q = query.toLowerCase();

  const filteredBuiltin = COMMANDS.filter(c => {
    if (!isOwner && c.ownerOnly) return false;
    return c.name.startsWith(q);
  });

  const filteredBot = botCmds.filter(c => c.name.startsWith(q));

  if (filteredBuiltin.length === 0 && filteredBot.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">Bot Komutları</span>
        </div>
      </div>

      {filteredBuiltin.map((cmd: CommandDef) => (
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
          {cmd.ownerOnly && (
            <span className="text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-bold">SAHİP</span>
          )}
        </button>
      ))}

      {filteredBot.map((cmd) => (
        <button
          key={`bot-${cmd.botName}-${cmd.name}`}
          onClick={() => { onSelect(`/${cmd.name} `); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
        >
          <div className="text-[#5865f2]"><Bot className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">/{cmd.name}</div>
            <div className="text-xs text-muted-foreground truncate">{cmd.description || cmd.botName}</div>
          </div>
          <span className="text-[9px] bg-[#5865f2]/20 text-[#5865f2] px-1.5 py-0.5 rounded font-bold uppercase">BOT</span>
        </button>
      ))}
    </div>
  );
};

export default SlashCommandPopup;
