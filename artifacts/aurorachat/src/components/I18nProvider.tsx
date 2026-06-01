import { useMemo, ReactNode } from 'react';
import { I18nContext, getTranslationFunction, Language } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';

export function I18nProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  const lang: Language = useMemo(() => {
    // Priority: profile language > localStorage > default 'tr'
    if (profile?.language) return profile.language as Language;
    try {
      const stored = localStorage.getItem('aurorachat_language');
      if (stored) return stored as Language;
    } catch {}
    return 'tr';
  }, [profile?.language]);

  const value = useMemo(() => getTranslationFunction(lang), [lang]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
