import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkEmbedProps {
  url: string;
}

interface OgData {
  title?: string;
  description?: string;
  siteName?: string;
  favicon?: string;
}

const LinkEmbed = ({ url }: LinkEmbedProps) => {
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchOg = async () => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

        setOgData({
          title: urlObj.pathname === '/' ? domain : `${urlObj.pathname.split('/').filter(Boolean).pop() || domain}`,
          description: url,
          siteName: domain,
          favicon,
        });
        setLoaded(true);
      } catch {
        setError(true);
        setLoaded(true);
      }
    };
    fetchOg();
  }, [url]);

  if (!loaded || error || !ogData) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-3 bg-secondary/60 border-l-4 border-primary rounded-r-lg px-3 py-2.5 max-w-sm hover:bg-secondary/80 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <img src={ogData.favicon} alt="" className="w-4 h-4 rounded-sm" />
          <span className="text-[10px] text-muted-foreground">{ogData.siteName}</span>
        </div>
        <p className="text-sm font-medium text-primary truncate">{ogData.title}</p>
        <p className="text-xs text-muted-foreground truncate">{ogData.description}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );
};

export default LinkEmbed;
