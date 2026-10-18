import { CONFIG } from './config.js';

const STORAGE_KEY = 'lang';
const root = document.documentElement;

/** Percorso relativo alla radice del sito ("./" o "../"), scritto nell'attributo data-root di <html>. */
export const ROOT = root.dataset.root || './';

let dictionary = {};
let currentLang = CONFIG.fallbackLanguage;

function storageGet() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function storageSet(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* storage non disponibile: nessun problema */ }
}

function toSupported(code) {
  if (!code) return null;
  const base = String(code).toLowerCase().split('-')[0];
  return CONFIG.languages.some((l) => l.code === base) ? base : null;
}

/** Ordine: ?lang= (link esplicito) → preferenza salvata → lingue del browser → fallback. */
export function detectLanguage() {
  const fromUrl = toSupported(new URLSearchParams(location.search).get('lang'));
  if (fromUrl) return fromUrl;
  const stored = toSupported(storageGet());
  if (stored) return stored;
  for (const candidate of navigator.languages || [navigator.language]) {
    const match = toSupported(candidate);
    if (match) return match;
  }
  return CONFIG.fallbackLanguage;
}

function lookup(key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dictionary);
}

/** Stringa tradotta, con segnaposto {nome}. Se manca, restituisce la chiave (così l'errore si vede). */
export function t(key, params = {}) {
  const value = lookup(key);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name) => (name in params ? String(params[name]) : `{${name}}`));
}

/** Array tradotto (liste di regole, principi...). */
export function tList(key) {
  const value = lookup(key);
  return Array.isArray(value) ? value : [];
}

/** Chiavi di un oggetto tradotto, nell'ordine in cui compaiono nel file (es. i gruppi dei dati). */
export function tKeys(key) {
  const value = lookup(key);
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

export function getLang() { return currentLang; }
export function isRtl() { return dictionary.meta?.dir === 'rtl'; }

/** Data ISO "YYYY-MM-DD" nel formato della lingua corrente (senza spostamenti di fuso). */
export function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(currentLang, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

/** Numero nel formato della lingua corrente (es. 1.234 in italiano, 1,234 in inglese). */
export function formatNumber(value) {
  return new Intl.NumberFormat(currentLang).format(value);
}

/** Applica le traduzioni agli elementi marcati con data-i18n*. */
export function applyTranslations(scope = document) {
  for (const node of scope.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  // data-i18n-attr="aria-label:chiave; title:altra.chiave"
  for (const node of scope.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of node.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) node.setAttribute(attr, t(key));
    }
  }
  // data-i18n-list="chiave.array" su <ul>/<ol>: un <li> per elemento
  for (const list of scope.querySelectorAll('[data-i18n-list]')) {
    list.replaceChildren(
      ...tList(list.dataset.i18nList).map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }),
    );
  }
  const titleKey = document.body.dataset.title;
  if (titleKey) document.title = `${t(titleKey)} · ${t('site.name')}`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', t('site.description'));
}

async function loadDictionary(code) {
  const response = await fetch(`${ROOT}i18n/${code}.json`);
  if (!response.ok) throw new Error(`i18n/${code}.json: HTTP ${response.status}`);
  return response.json();
}

/** Cambia lingua: carica il dizionario, aggiorna <html lang dir>, riapplica i testi, avvisa le pagine. */
export async function setLanguage(code, { persist = true } = {}) {
  const lang = toSupported(code) || CONFIG.fallbackLanguage;
  dictionary = await loadDictionary(lang);
  currentLang = lang;
  root.lang = lang;
  root.dir = dictionary.meta?.dir === 'rtl' ? 'rtl' : 'ltr';
  if (persist) storageSet(lang);
  applyTranslations();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export async function initI18n() {
  await setLanguage(detectLanguage(), { persist: false });
}

/** True se la traduzione corrente è ancora una bozza non rivista da un madrelingua. */
export function isDraft() {
  return dictionary.meta?.status === 'draft';
}
