import { ko } from './ko';
import { en } from './en';

const LOCALES: Record<string, Record<string, unknown>> = { ko, en };

export const i18n = {
  locale: (localStorage.getItem('ccs-lang') ||
    (navigator.language.startsWith('ko') ? 'ko' : 'en')),

  t(key: string, vars: Record<string, string | number> = {}): string {
    const val = key.split('.').reduce<unknown>((o, k) => {
      if (o && typeof o === 'object') return (o as Record<string, unknown>)[k];
      return undefined;
    }, LOCALES[this.locale]) as string | undefined;
    const str = val ?? key;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), str);
  },

  setLocale(lang: string): void {
    this.locale = lang;
    localStorage.setItem('ccs-lang', lang);
  },
};
