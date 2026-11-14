import type { Locale } from '../config';
import en, { type Messages } from './en';
import extra from './extra';
import hi from './hi';
import bn from './bn';
import ta from './ta';
import te from './te';

export type { Messages };

// English also carries the not-yet-translated namespaces; other locales fall back to it in t().
const enAll: Messages = Object.assign({}, en, extra);

export const MESSAGES: Record<Locale, Messages> = { en: enAll, hi, bn, ta, te };
