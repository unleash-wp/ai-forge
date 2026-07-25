// Translations for the browser UI. Works like WordPress language files: every
// languages/<code>.json is loaded automatically, so a contributor adds a new
// language by dropping in one JSON file — no code change. The key is the English
// source string; the value is the translation. Missing keys fall back to English.
//
//   const t = useT();  <Text>{t('No changelog yet')}</Text>
//   __('Version %s', v)   // outside React
import { createContext, useContext, useState, useCallback } from 'react';

const CATALOGS = { en: {} };
try {
  const ctx = import.meta.webpackContext('../../languages', { recursive: false, regExp: /\.json$/ });
  ctx.keys().forEach((k) => {
    const code = k.replace(/^\.\//, '').replace(/\.json$/, '').toLowerCase();
    CATALOGS[code] = ctx(k) || {};
  });
} catch { /* no languages dir at build time */ }

// Display name + flag country per locale (extend as languages are added).
export const LOCALE_NAMES = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português', nl: 'Nederlands' };
export const LOCALE_FLAGS = { en: 'GB', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT', nl: 'NL' };
export function availableLocales() {
  return Object.keys(CATALOGS).sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)));
}

function readLocale() { try { return (localStorage.getItem('forge:lang') || 'en').toLowerCase(); } catch { return 'en'; } }

let CURRENT = readLocale();
function translate(locale, s, args) {
  const cat = CATALOGS[locale] || {};
  let out = (cat && cat[s]) || s;
  for (const a of args) out = out.replace('%s', a);
  return out;
}
// Plain (non-React) translator, bound to the last-set locale.
export function __(s, ...args) { return translate(CURRENT, s, args); }
// The active locale code, for locale-aware formatting (dates, numbers).
export function currentLocale() { return CURRENT; }

const I18nCtx = createContext({ locale: 'en', t: (s) => s, setLocale: () => {} });
export function useI18n() { return useContext(I18nCtx); }
export function useT() { return useContext(I18nCtx).t; }

export function I18nProvider({ children }) {
  const [locale, setLoc] = useState(readLocale);
  const t = useCallback((s, ...args) => translate(locale, s, args), [locale]);
  const setLocale = useCallback((l) => {
    const code = String(l || 'en').toLowerCase();
    CURRENT = code;
    setLoc(code);
    try { localStorage.setItem('forge:lang', code); } catch { /* blocked */ }
  }, []);
  return <I18nCtx.Provider value={{ locale, t, setLocale }}>{children}</I18nCtx.Provider>;
}

if (typeof window !== 'undefined') {
  window.forge = window.forge || {};
  window.forge.__ = __;
}
