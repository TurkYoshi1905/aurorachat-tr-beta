import { ArrowLeft, Tag } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { changelogData } from '@/data/changelogData';

const ChangelogDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const entry = changelogData[Number(id)];

  if (!entry) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Güncelleme bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={() => navigate('/changelog')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('auth.back')}
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">v{entry.version}</span>
          <span className="text-sm text-muted-foreground">{entry.date}</span>
        </div>

        <h1 className="text-2xl font-bold mb-6">{entry.summary}</h1>

        <div className="space-y-6">
          {entry.sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-4 w-4 ${section.color}`} />
                  <h2 className="font-semibold text-sm">{section.title}</h2>
                </div>
                <div className="space-y-2">
                  {section.items.map((item, j) => (
                    <div key={j} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChangelogDetail;
