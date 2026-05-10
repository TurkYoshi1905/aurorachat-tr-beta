import { useState, useEffect, useRef } from 'react';

interface ServerEmoji { id: string; name: string; image_url: string; }

// Fuzzy match scoring: returns score > 0 if all query chars appear in order, 0 otherwise
const fuzzyMatch = (text: string, query: string): number => {
  if (!query) return 0;
  let qi = 0, score = 0, consecutive = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      qi++;
      score += 1 + consecutive;
      consecutive++;
      if (i === qi - 1) score += 2; // prefix bonus
    } else {
      consecutive = 0;
    }
  }
  return qi === query.length ? score : 0;
};

// Built-in emoji subset for autocomplete
const BUILTIN_EMOJI_MAP: Record<string, string[]> = {
  '😀': ['grin','smile','happy'],
  '😂': ['joy','laugh','lol'],
  '😍': ['heart','love','eyes'],
  '😎': ['cool','sunglasses'],
  '🤔': ['think','hmm'],
  '😢': ['cry','sad'],
  '😡': ['angry','mad'],
  '🔥': ['fire','hot'],
  '❤️': ['heart','love','red'],
  '👍': ['thumbsup','like','ok'],
  '👎': ['thumbsdown','dislike'],
  '🎉': ['party','celebrate'],
  '💯': ['hundred','perfect'],
  '✅': ['check','done'],
  '❌': ['cross','no'],
  '👀': ['eyes','look'],
  '💀': ['skull','dead'],
  '🥳': ['party','celebrate'],
  '😭': ['sob','cry'],
  '🤣': ['rofl','lol'],
  '😊': ['blush','shy'],
  '🙏': ['pray','please'],
  '💪': ['strong','muscle'],
  '👏': ['clap'],
  '🤝': ['handshake'],
  '⭐': ['star'],
  '✨': ['sparkle','stars'],
  '💜': ['purple','heart'],
  '💙': ['blue','heart'],
  '💚': ['green','heart'],
  '🧡': ['orange','heart'],
};

interface EmojiAutocompletePopupProps {
  query: string;
  serverEmojis: ServerEmoji[];
  onSelect: (value: string, isCustom: boolean) => void;
  onClose: () => void;
  position: { bottom: number; left: number };
}

const EmojiAutocompletePopup = ({ query, serverEmojis, onSelect, onClose, position }: EmojiAutocompletePopupProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const q = query.toLowerCase();

  // Server emojis with fuzzy scoring
  const matchedServer = serverEmojis
    .map(e => ({ ...e, score: fuzzyMatch(e.name.toLowerCase(), q) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // Built-in emojis with fuzzy scoring
  const matchedBuiltin: { emoji: string; name: string; score: number }[] = [];
  for (const [emoji, keywords] of Object.entries(BUILTIN_EMOJI_MAP)) {
    let bestScore = 0;
    let bestName = keywords[0];
    for (const k of keywords) {
      const s = fuzzyMatch(k, q);
      if (s > bestScore) { bestScore = s; bestName = k; }
    }
    if (bestScore > 0) {
      matchedBuiltin.push({ emoji, name: bestName, score: bestScore });
    }
  }
  matchedBuiltin.sort((a, b) => b.score - a.score);
  const displayBuiltin = matchedBuiltin.slice(0, 6);

  const totalItems = matchedServer.length + displayBuiltin.length;

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (selectedIndex < matchedServer.length) {
          onSelect(`:${matchedServer[selectedIndex].name}:`, true);
        } else {
          const builtinIdx = selectedIndex - matchedServer.length;
          if (displayBuiltin[builtinIdx]) {
            onSelect(displayBuiltin[builtinIdx].emoji, false);
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [matchedServer, displayBuiltin, selectedIndex, onSelect, onClose, totalItems]);

  if (totalItems === 0) return null;

  let idx = 0;

  return (
    <div
      ref={ref}
      className="absolute z-50 w-72 max-h-56 overflow-y-auto bg-popover border border-border rounded-lg shadow-xl p-1"
      style={{ bottom: position.bottom, left: position.left }}
    >
      {matchedServer.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Sunucu Emojileri</p>
          {matchedServer.map((e) => {
            const currentIdx = idx++;
            return (
              <button
                key={e.id}
                onClick={() => onSelect(`:${e.name}:`, true)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  currentIdx === selectedIndex ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <img src={e.image_url} alt="" className="w-5 h-5 object-contain" />
                <span className="truncate">:{e.name}:</span>
              </button>
            );
          })}
        </>
      )}
      {displayBuiltin.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 mt-1">Emojiler</p>
          {displayBuiltin.map((e) => {
            const currentIdx = idx++;
            return (
              <button
                key={e.emoji}
                onClick={() => onSelect(e.emoji, false)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  currentIdx === selectedIndex ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <span className="text-lg">{e.emoji}</span>
                <span className="truncate">{e.name}</span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
};

export default EmojiAutocompletePopup;
