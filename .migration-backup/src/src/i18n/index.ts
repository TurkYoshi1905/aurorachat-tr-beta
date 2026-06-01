import { createContext, useContext } from 'react';
import tr from './tr';
import en from './en';
import az from './az';
import ru from './ru';
import ja from './ja';
import de from './de';

export type Language = 'tr' | 'en' | 'az' | 'ru' | 'ja' | 'de';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azərbaycan' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'de', label: 'Deutsch' },
];

type Translations = typeof tr;

const translationMap: Record<Language, Translations> = { tr, en, az, ru, ja, de };

// Resolve nested key like 'settings.account'
function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null) return path;
    current = current[key];
  }
  return typeof current === 'string' ? current : path;
}

export interface I18nContextType {
  language: Language;
  t: (key: string, vars?: Record<string, string | number>) => string;
  translations: Translations;
}

export const I18nContext = createContext<I18nContextType>({
  language: 'tr',
  t: (key) => key,
  translations: tr,
});

export const useTranslation = () => useContext(I18nContext);

export function getTranslationFunction(lang: Language) {
  const translations = translationMap[lang] || tr;
  const t = (key: string, vars?: Record<string, string | number>): string => {
    let value = getNestedValue(translations, key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return { t, translations, language: lang };
}

export { tr, en, az, ru, ja, de };
