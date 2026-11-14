/** Supported UI languages. Add a locale here and a matching file in ./messages. */
export const LOCALES = [
  { code: 'en', native: 'English', intl: 'en-IN' },
  { code: 'hi', native: 'हिन्दी', intl: 'hi-IN' },
  { code: 'bn', native: 'বাংলা', intl: 'bn-IN' },
  { code: 'ta', native: 'தமிழ்', intl: 'ta-IN' },
  { code: 'te', native: 'తెలుగు', intl: 'te-IN' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: Locale = 'en';
export const LANG_COOKIE = 'mipaas_lang';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some((l) => l.code === value);
}

export function intlLocale(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)?.intl ?? 'en-IN';
}
