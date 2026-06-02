import { ArrowLeft, Tag, Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { changelogData } from '@/data/changelogData';

const Changelog = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return changelogData;
    return changelogData.filter((entry) => {
      if (entry.version.toLowerCase().includes(q)) return true;
      if (entry.date.toLowerCase().includes(q)) return true;
      if (entry.summary.toLowerCase().includes(q)) return true;
      return entry.sections.some((s) =>
        s.title.toLowerCase().includes(q) ||
        s.items.some((item) => item.toLowerCase().includes(q))
      );
    });
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('auth.back')}
        </button>

        <h1 className="text-3xl font-bold mb-6">{t('settings.changelog')}</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sürüm, tarih veya anahtar kelime ara…"
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sonuç bulunamadı — farklı bir arama deneyin.</p>
          </div>
        ) : (
          <>
            {query && (
              <p className="text-xs text-muted-foreground mb-4">
                {filtered.length} sonuç bulundu
              </p>
            )}
            <div className="space-y-4">
              {filtered.map((entry) => {
                const originalIdx = changelogData.indexOf(entry);
                return (
                  <Link
                    key={originalIdx}
                    to={`/changelog/${originalIdx}`}
                    className="block p-5 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-primary">v{entry.version}</span>
                      <span className="text-xs text-muted-foreground">{entry.date}</span>
                    </div>
                    <h3 className="font-semibold text-sm">{entry.summary}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{entry.sections.reduce((acc, s) => acc + s.items.length, 0)} değişiklik</p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Changelog;
