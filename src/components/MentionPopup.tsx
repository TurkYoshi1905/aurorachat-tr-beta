import { DbMember } from '@/pages/Index';

interface MentionPopupProps {
  query: string;
  members: DbMember[];
  onSelect: (name: string) => void;
  onClose: () => void;
  position?: { bottom: number; left: number };
}

const MentionPopup = ({ query, members, onSelect, onClose, position }: MentionPopupProps) => {
  const specialItems = [
    { name: 'everyone', label: '@everyone', desc: 'Herkesi etiketle' },
    { name: 'here', label: '@here', desc: 'Çevrimiçi olanları etiketle' },
  ];

  const filtered = [
    ...specialItems.filter(s => s.name.startsWith(query.toLowerCase())),
    ...members.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
  ];

  if (filtered.length === 0) return null;

  return (
    <div className="absolute z-50 bg-popover border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto w-56" style={position ? { bottom: position.bottom, left: position.left } : { bottom: 60, left: 16 }}>
      {specialItems.filter(s => s.name.startsWith(query.toLowerCase())).map(s => (
        <button key={s.name} onClick={() => { onSelect(s.name); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left">
          <span className="font-medium text-foreground">{s.label}</span>
          <span className="text-xs text-muted-foreground">{s.desc}</span>
        </button>
      ))}
      {members.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8).map(m => (
        <button key={m.id} onClick={() => { onSelect(m.name); onClose(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left">
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs overflow-hidden shrink-0">
            {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" /> : m.avatar}
          </div>
          <span className="text-foreground truncate">{m.name}</span>
        </button>
      ))}
    </div>
  );
};

export default MentionPopup;