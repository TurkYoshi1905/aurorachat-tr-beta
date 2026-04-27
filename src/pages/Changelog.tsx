import { ArrowLeft, Tag } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { changelogData } from '@/data/changelogData';

const Changelog = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('auth.back')}
        </button>

        <h1 className="text-3xl font-bold mb-8">{t('settings.changelog')}</h1>

        <div className="space-y-4">
          {changelogData.map((entry, idx) => (
            <Link
              key={idx}
              to={`/changelog/${idx}`}
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default Changelog;
