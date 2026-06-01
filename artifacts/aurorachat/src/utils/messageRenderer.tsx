import React, { useState } from 'react';
import ImageLightbox from '@/components/ImageLightbox';
import ServerInviteEmbed from '@/components/ServerInviteEmbed';
import LinkEmbed from '@/components/LinkEmbed';

export interface ServerEmoji { id: string; name: string; image_url: string; }

export const isGifUrl = (url: string) =>
  /giphy\.com\/media\/|\.giphy\.com\//i.test(url) ||
  /static\.klipy\.com\/.+\.gif(\?.*)?$/i.test(url) ||
  /klipy\.com\/.+\.gif(\?.*)?$/i.test(url);

export const GifImage = ({ url }: { url: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img src={url} alt="GIF" className="max-w-[min(320px,100%)] rounded-lg mt-1 cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" onClick={() => setOpen(true)} />
      <ImageLightbox images={[url]} currentIndex={0} open={open} onOpenChange={setOpen} onIndexChange={() => {}} />
    </>
  );
};

export const renderBoldAndNewlines = (text: string): React.ReactNode => {
  const boldRegex = /\*\*(.+?)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      parts.push(...before.split('\n').flatMap((line, i, arr) =>
        i < arr.length - 1 ? [line, <br key={`br-${lastIndex}-${i}`} />] : [line]
      ));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    parts.push(...rest.split('\n').flatMap((line, i, arr) =>
      i < arr.length - 1 ? [line, <br key={`br-end-${i}`} />] : [line]
    ));
  }
  return parts.length > 0 ? <>{parts}</> : text;
};

export const renderMessageContent = (content: string, currentUserId?: string, serverEmojis?: ServerEmoji[]) => {
  const trimmed = content.trim();
  if (isGifUrl(trimmed) && /^https?:\/\/\S+$/.test(trimmed)) {
    return <GifImage url={trimmed} />;
  }

  const inviteRegex = /https?:\/\/[^\s]+invite\/([a-zA-Z0-9]+)/g;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const inviteCodes: string[] = [];
  let inviteMatch;
  while ((inviteMatch = inviteRegex.exec(content)) !== null) { inviteCodes.push(inviteMatch[1]); }

  const mentionRegex = /@(\[[^\]]+\]|\S+)/g;

  const parseMentionName = (raw: string) => {
    if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1);
    return raw;
  };

  const parts = content.split(urlRegex);
  const elements = parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      if (isGifUrl(part)) {
        return <GifImage key={i} url={part} />;
      }
      return (<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{part}</a>);
    }
    const mentionParts = part.split(mentionRegex);
    if (mentionParts.length > 1) {
      return (
        <span key={i}>
          {mentionParts.map((mp, j) => {
            if (j % 2 === 1) {
              const name = parseMentionName(mp);
              if (name === 'everyone') {
                return <span key={j} className="bg-amber-500/20 text-amber-400 rounded px-1 font-semibold cursor-pointer hover:bg-amber-500/30">@everyone</span>;
              }
              if (name === 'here') {
                return <span key={j} className="bg-emerald-500/20 text-emerald-400 rounded px-1 font-semibold cursor-pointer hover:bg-emerald-500/30">@here</span>;
              }
              return <span key={j} className="bg-primary/20 text-primary rounded px-1 font-medium cursor-pointer hover:bg-primary/30">@{name}</span>;
            }
            return <span key={j}>{renderBoldAndNewlines(mp)}</span>;
          })}
        </span>
      );
    }
    return <span key={i}>{renderBoldAndNewlines(part)}</span>;
  });
  const embeds = inviteCodes.map((code) => (<ServerInviteEmbed key={code} code={code} />));
  const allUrls: string[] = [];
  let urlMatch;
  const urlScanRegex = /(https?:\/\/[^\s]+)/g;
  while ((urlMatch = urlScanRegex.exec(content)) !== null) { allUrls.push(urlMatch[1]); }
  const inviteUrlRegex = /https?:\/\/[^\s]+invite\/[a-zA-Z0-9]+/;
  const nonInviteUrls = allUrls.filter((u) => !inviteUrlRegex.test(u) && !isGifUrl(u));

  const processEmojiText = (text: string): React.ReactNode => {
    if (!serverEmojis || serverEmojis.length === 0) return text;
    const emojiRegex = /:([a-z0-9_]+):/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = emojiRegex.exec(text)) !== null) {
      const emoji = serverEmojis.find(e => e.name === match![1]);
      if (emoji) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        parts.push(<img key={`emoji-${match.index}`} src={emoji.image_url} alt={`:${emoji.name}:`} title={`:${emoji.name}:`} className="inline-block w-6 h-6 object-contain align-middle mx-0.5" />);
        lastIndex = match.index + match[0].length;
      }
    }
    if (lastIndex === 0) return text;
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return <>{parts}</>;
  };

  const processCustomEmojis = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') return processEmojiText(node);
    if (Array.isArray(node)) return node.map((child, i) => <React.Fragment key={i}>{processCustomEmojis(child)}</React.Fragment>);
    if (React.isValidElement(node)) {
      const children = (node.props as any)?.children;
      if (children) {
        return React.cloneElement(node, undefined, ...React.Children.map(children, (child) => processCustomEmojis(child)) || []);
      }
    }
    return node;
  };

  return (
    <>
      <p className="text-sm text-secondary-foreground leading-relaxed">{elements.map((el, i) => processCustomEmojis(el))}</p>
      {embeds.length > 0 && <div className="flex flex-col gap-1">{embeds}</div>}
      {nonInviteUrls.map((u) => (<LinkEmbed key={u} url={u} />))}
    </>
  );
};
