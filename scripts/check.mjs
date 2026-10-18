// Controlli di qualità del sito. Uso: node scripts/check.mjs   (esce con codice 1 se ci sono errori)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAll, loadBadgeLanguages, BADGE_COLORS, BADGE_STYLES, badgeFileName } from './build-badges.mjs';
import { readBadges, textHash, validReviews } from './badge-data.mjs';
import { parseYaml, validateIssueForm } from './mini-yaml.mjs';
import { deriveRepoUrl } from '../assets/js/repo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');

// --strict: i campi "DA COMPILARE" diventano errori (è la modalità usata dalla pubblicazione automatica).
const STRICT = process.argv.includes('--strict');
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// Il CSP approvato: identico in tutte le pagine. Nessun 'unsafe-inline', nessun 'unsafe-eval', nessuna origine esterna.
// Il sito non fa richieste a terzi: se un giorno servirà (es. un modulo), va deciso e scritto qui.
const EXPECTED_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'";

function walk(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, ext) : full.endsWith(ext) ? [full] : [];
  });
}

/** GitHub Pages (Linux) distingue le maiuscole, Windows e macOS no: ogni segmento del percorso deve coincidere esattamente. */
function existsExactCase(target) {
  let current = ROOT;
  for (const part of relative(ROOT, target).split(/[\\/]/).filter(Boolean)) {
    if (!readdirSync(current).includes(part)) return false;
    current = join(current, part);
  }
  return true;
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(`${rel(path)}: JSON non valido (${e.message})`); return null; }
}

/** Appiattisce un oggetto JSON in { "a.b.0.c": valore }. */
function flatten(value, prefix = '', out = {}) {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = value;
  return out;
}

function lookup(obj, key) {
  return key.split('.').reduce((n, p) => (n == null ? undefined : n[p]), obj);
}

// ── i18n ──────────────────────────────────────────────────────────────────────
const i18nDir = join(ROOT, 'i18n');
const langFiles = readdirSync(i18nDir).filter((f) => f.endsWith('.json')).sort();
const dicts = Object.fromEntries(langFiles.map((f) => [f.replace('.json', ''), readJson(join(i18nDir, f))]));
const source = dicts.it;
if (!source) fail('i18n/it.json mancante: è la lingua di riferimento.');
const sourceKeys = source ? Object.keys(flatten(source)) : [];

for (const [lang, dict] of Object.entries(dicts)) {
  if (!dict) continue;
  const flat = flatten(dict);
  const keys = Object.keys(flat);
  for (const k of sourceKeys) if (!(k in flat)) fail(`i18n/${lang}.json: manca la chiave "${k}"`);
  for (const k of keys) if (!sourceKeys.includes(k)) fail(`i18n/${lang}.json: chiave "${k}" non presente in it.json`);
  for (const [k, v] of Object.entries(flat)) if (typeof v === 'string' && v.trim() === '') fail(`i18n/${lang}.json: "${k}" è vuota`);
  if (!['ltr', 'rtl'].includes(dict.meta?.dir)) fail(`i18n/${lang}.json: meta.dir deve essere "ltr" o "rtl"`);
  if (!['reviewed', 'draft'].includes(dict.meta?.status)) fail(`i18n/${lang}.json: meta.status deve essere "reviewed" o "draft"`);
  if (!dict.meta?.name) fail(`i18n/${lang}.json: manca meta.name`);
  // I segnaposto {nome} devono coincidere con quelli dell'italiano.
  const placeholders = (s) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',') : '');
  const srcFlat = flatten(source || {});
  for (const k of keys) if (k in srcFlat && placeholders(flat[k]) !== placeholders(srcFlat[k])) fail(`i18n/${lang}.json: segnaposto diversi in "${k}"`);
}

// config.js: stesse lingue dei file i18n
let config = {};
let todoTotal = 0;
try {
  const { CONFIG } = await import(pathToFileURL(join(ROOT, 'assets/js/config.js')).href);
  config = CONFIG;
  const configured = CONFIG.languages.map((l) => l.code).sort().join(',');
  const present = Object.keys(dicts).sort().join(',');
  if (configured !== present) fail(`assets/js/config.js elenca [${configured}] ma i18n/ contiene [${present}]`);
  for (const { code, name } of CONFIG.languages) if (dicts[code]?.meta?.name !== name) fail(`config.js: nome lingua "${name}" diverso da meta.name di ${code}.json`);
  if (!dicts[CONFIG.fallbackLanguage]) fail(`config.js: fallbackLanguage "${CONFIG.fallbackLanguage}" non ha un file i18n`);
  for (const key of Object.keys(CONFIG).filter((k) => k.endsWith('Url'))) {
    if (CONFIG[key] && !String(CONFIG[key]).startsWith('https://')) fail(`config.js: ${key} deve iniziare con https://`);
  }
} catch (e) {
  fail(`assets/js/config.js: ${e.message}`);
}

// ── HTML ──────────────────────────────────────────────────────────────────────
const htmlFiles = [join(ROOT, 'index.html'), ...['it-sud', 'francia', 'badge', 'info'].map((d) => join(ROOT, d, 'index.html'))];
const usedKeys = new Map(); // chiave → { kind, where }
const literalKeys = new Set();
const referencedTemplates = new Set();
const useKey = (key, kind, where) => usedKeys.set(`${kind}:${key}`, { key, kind, where });

for (const file of htmlFiles) {
  if (!existsSync(file)) { fail(`${rel(file)}: pagina mancante`); continue; }
  const html = readFileSync(file, 'utf8');
  const name = rel(file);
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];
  if (!csp) fail(`${name}: manca il CSP`);
  else if (csp !== EXPECTED_CSP) fail(`${name}: il CSP non coincide con quello approvato (EXPECTED_CSP in scripts/check.mjs)`);
  // __SITE_URL__ è un segnaposto sostituito dalla pubblicazione, ammesso solo nelle immagini di anteprima social.
  const withoutOg = html.replace(/<meta (?:property="og:image"|name="twitter:image") content="__SITE_URL__\/assets\/img\/social\.png">/g, '');
  if (withoutOg.includes('__SITE_URL__')) fail(`${name}: __SITE_URL__ ammesso solo nei meta og:image e twitter:image`);
  if (EMAIL.test(html)) fail(`${name}: contiene un indirizzo email (non scrivere email nell'HTML: vengono raccolte dagli spammer)`);
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail(`${name}: script inline (vietato dal CSP)`);
  if (/\sstyle\s*=/i.test(html)) fail(`${name}: attributo style inline (vietato dal CSP)`);
  if (/\son[a-z]+\s*=/i.test(html)) fail(`${name}: gestore di eventi inline (vietato dal CSP)`);
  if (/<(iframe|object|embed)\b/i.test(html)) fail(`${name}: elemento incorporato non consentito`);
  if (!/<html[^>]*\blang=/.test(html) || !/<html[^>]*\bdata-root=/.test(html)) fail(`${name}: <html> deve avere lang e data-root`);
  if (!/<main[^>]*\bid="main"/.test(html)) fail(`${name}: manca <main id="main">`);
  if (!/<h1\b/.test(html)) fail(`${name}: manca <h1>`);
  if (!/<script src="(?:\.\/|\.\.\/)assets\/js\/theme-init\.js"><\/script>/.test(html)) fail(`${name}: manca lo script del tema (theme-init.js) nell'<head>`);
  for (const m of html.matchAll(/data-repo-path="issues\/new\?template=([^"]+)"/g)) referencedTemplates.add(m[1]);
  // Pagina di sezione: deve dichiarare quali dati usa, e quei file devono esistere.
  const sectionName = html.match(/<body[^>]*\bdata-section="([^"]+)"/)?.[1];
  if (sectionName) {
    // Principio del progetto: ogni pagina di sezione dichiara che si condanna ogni violenza, da qualunque parte venga.
    if (!html.includes(`data-i18n="${sectionName}.nonviolence"`)) fail(`${name}: la pagina di sezione deve mostrare la dichiarazione "${sectionName}.nonviolence" (condanna di ogni violenza, da qualunque parte venga)`);
    for (const attr of ['data-news', 'data-stats']) {
      const file = html.match(new RegExp(`<body[^>]*\\b${attr}="([^"]+)"`))?.[1];
      if (!file || !existsSync(join(ROOT, 'data', file))) fail(`${name}: ${attr} non punta a un file in data/ (${file})`);
    }
  }
  const rootAttr = html.match(/data-root="([^"]*)"/)?.[1];
  const expectedRoot = name === 'index.html' ? './' : '../';
  if (rootAttr !== expectedRoot) fail(`${name}: data-root è "${rootAttr}", atteso "${expectedRoot}"`);

  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) useKey(m[1], 'string', name);
  for (const m of html.matchAll(/data-i18n-list="([^"]+)"/g)) useKey(m[1], 'list', name);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of m[1].split(';')) useKey(pair.split(':')[1]?.trim(), 'string', name);
  }
  const title = html.match(/data-title="([^"]+)"/)?.[1];
  if (title) useKey(title, 'string', name);

  // Link e risorse locali devono esistere.
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(url)) {
      if (/^http:/.test(url)) fail(`${name}: link non sicuro (http): ${url}`);
      continue;
    }
    // Su GitHub Pages un repository di progetto vive sotto /<repo>/: un link che parte da "/" punterebbe fuori dal sito.
    if (url.startsWith('/') && !url.startsWith('//')) { fail(`${name}: link assoluto alla radice (${url}): usa percorsi relativi`); continue; }
    const target = resolve(dirname(file), url.split('#')[0].split('?')[0]);
    const exists = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
    if (!exists) fail(`${name}: link locale rotto: ${url}`);
    else if (!existsExactCase(target)) fail(`${name}: maiuscole/minuscole diverse dal file reale (GitHub Pages le distingue): ${url}`);
  }
  for (const m of html.matchAll(/<a\b[^>]*href="https:[^"]*"[^>]*>/g)) {
    if (!/rel="[^"]*noopener[^"]*"/.test(m[0])) fail(`${name}: link esterno senza rel="noopener noreferrer": ${m[0]}`);
  }
  for (const m of html.matchAll(/href="#([^"]+)"/g)) if (!html.includes(`id="${m[1]}"`)) fail(`${name}: ancora #${m[1]} senza destinazione`);

  const todo = (html.match(/class="todo"/g) || []).length;
  todoTotal += todo;
  if (todo) warn(`${name}: ${todo} campi "DA COMPILARE" da completare prima della pubblicazione`);
}
if (todoTotal > 0 && STRICT) fail(`Restano ${todoTotal} campi "DA COMPILARE" in info/index.html: compilali prima di pubblicare (serve un contatto per le correzioni).`);

// Nessun file con dati o segreti nel repository, e nessun indirizzo email in dati e traduzioni.
const SECRET_FILES = /(\.csv|\.pem|\.key|\.p12|\.pfx)$|(^|[\\/])\.env(\.|$)/i;
const walkAll = (dir) => readdirSync(dir).flatMap((n) => {
  if (['.git', 'node_modules', '_site'].includes(n)) return [];
  const f = join(dir, n);
  return statSync(f).isDirectory() ? walkAll(f) : [f];
});
for (const f of walkAll(ROOT)) if (SECRET_FILES.test(rel(f))) fail(`${rel(f)}: file con dati o segreti: non deve stare nel repository`);
for (const f of [...walk(join(ROOT, 'data'), '.json'), ...walk(join(ROOT, 'i18n'), '.json')]) {
  if (EMAIL.test(readFileSync(f, 'utf8'))) fail(`${rel(f)}: contiene un indirizzo email`);
}

// ── JavaScript ────────────────────────────────────────────────────────────────
const FORBIDDEN = [
  [/\.(innerHTML|outerHTML)\b/, 'innerHTML/outerHTML'],
  [/insertAdjacentHTML/, 'insertAdjacentHTML'],
  [/document\.write/, 'document.write'],
  [/\beval\s*\(/, 'eval'],
  [/new\s+Function\s*\(/, 'new Function'],
  [/setTimeout\s*\(\s*['"`]/, 'setTimeout con stringa'],
  [/\bimport\s*\(\s*['"]https?:/, 'import da URL esterno'],
];
for (const file of walk(join(ROOT, 'assets/js'), '.js')) {
  const code = readFileSync(file, 'utf8');
  const code2 = code.replace(/\/\/.*$/gm, '');
  for (const [pattern, label] of FORBIDDEN) if (pattern.test(code2)) fail(`${rel(file)}: usa ${label}`);
  if (/fetch\(\s*['"`]\/(?!\/)/.test(code2)) fail(`${rel(file)}: fetch con percorso assoluto alla radice (non funziona sotto /<repo>/ su GitHub Pages)`);
  for (const m of code.matchAll(/\bt\(\s*'([^'$`]+)'/g)) useKey(m[1], 'string', rel(file));
  for (const m of code.matchAll(/\btList\(\s*'([^'$`]+)'/g)) useKey(m[1], 'list', rel(file));
  // Helper del layout: i18nSpan('tag', 'chiave', ...). Qui una chiave mancante è un errore.
  for (const m of code.matchAll(/i18nSpan\(\s*'[a-z0-9]+',\s*'([^'$`]+)'/g)) useKey(m[1], 'string', rel(file));
  for (const m of code.matchAll(/'data-i18n-attr':\s*'([^']+)'/g)) {
    for (const pair of m[1].split(';')) useKey(pair.split(':')[1]?.trim(), 'string', rel(file));
  }
  // Chiavi passate come semplici stringhe (es. al layout): contano come "usate" solo se esistono davvero.
  for (const m of code.matchAll(/'([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+)'/g)) if (lookup(source || {}, m[1]) !== undefined) literalKeys.add(m[1]);
}

if (source) {
  for (const { key, kind, where } of usedKeys.values()) {
    const value = lookup(source, key);
    if (kind === 'string' && typeof value !== 'string') fail(`${where}: chiave i18n "${key}" non esiste o non è un testo`);
    if (kind === 'list' && !Array.isArray(value)) fail(`${where}: chiave i18n "${key}" non esiste o non è una lista`);
  }
  const used = new Set([...[...usedKeys.values()].map((u) => u.key), ...literalKeys]);
  // Chiavi costruite al volo nel codice (testi delle pagine di sezione, principi del manifesto).
  const dynamicPrefixes = ['home.manifesto.principles', ...['itsud', 'francia'].flatMap((s) => [`${s}.news.`, `${s}.requests.`, `${s}.stats.`])];
  for (const k of sourceKeys) {
    if (k.startsWith('meta.') || dynamicPrefixes.some((p) => k.startsWith(p))) continue;
    const base = k.replace(/\.\d+(\..*)?$/, '');
    if (!used.has(k) && !used.has(base)) warn(`i18n/it.json: la chiave "${k}" non è usata da nessuna pagina`);
  }
}

// ── Dati ──────────────────────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Una data AAAA-MM-GG che esiste davvero (non solo nel formato: 2026-13-45 non è valida). */
const isIsoDate = (s) => {
  if (typeof s !== 'string' || !ISO.test(s) || Number.isNaN(Date.parse(s))) return false;
  return new Date(s).toISOString().slice(0, 10) === s;
};
const seenIds = new Set();
// [file, categorie ammesse, sezione i18n da cui vengono i testi e i gruppi]
const DATA_FILES = [
  ['news.json', ['news', 'request'], 'itsud'],
  ['stats.json', ['stat'], 'itsud'],
  ['francia-news.json', ['news', 'request'], 'francia'],
  ['francia-stats.json', ['stat'], 'francia'],
];
for (const [file, categories, section] of DATA_FILES) {
  const data = readJson(join(ROOT, 'data', file));
  if (!data) continue;
  const GROUPS = Object.keys(source?.[section]?.stats?.groups || {});
  if (!Array.isArray(data.items)) { fail(`data/${file}: manca l'array "items"`); continue; }
  if (data.updated && !isIsoDate(data.updated)) fail(`data/${file}: "updated" non è una data valida AAAA-MM-GG`);
  if (data.requestsAsOf && !isIsoDate(data.requestsAsOf)) fail(`data/${file}: "requestsAsOf" non è una data valida AAAA-MM-GG`);
  if (!categories) continue;
  for (const item of data.items) {
    const id = item.id || '(senza id)';
    const at = `data/${file} → ${id}`;
    if (seenIds.has(item.id)) fail(`${at}: id duplicato`);
    seenIds.add(item.id);
    if (!categories.includes(item.category)) fail(`${at}: category "${item.category}" non valida`);
    for (const f of ['id', 'title', 'source', 'url']) if (typeof item[f] !== 'string' || !item[f].trim()) fail(`${at}: campo "${f}" mancante`);
    if (!isIsoDate(item.date)) fail(`${at}: "date" deve essere una data valida AAAA-MM-GG`);
    if (typeof item.url === 'string' && !item.url.startsWith('https://')) fail(`${at}: "url" deve essere https`);
    if (typeof item.verified !== 'boolean') fail(`${at}: "verified" deve essere true/false`);
    if (item.category !== 'stat' && !item.summary) fail(`${at}: manca "summary"`);
    if (item.category === 'stat') {
      if (!GROUPS.includes(item.group)) fail(`${at}: group "${item.group}" sconosciuto (ammessi: ${GROUPS.join(', ')})`);
      if (!item.value && !item.summary) fail(`${at}: serve "value" o "summary"`);
    }
  }
  const unverified = data.items.filter((i) => i.verified === false).length;
  if (unverified) warn(`data/${file}: ${unverified} voci con verified:false (fonte da ricontrollare sul documento originale)`);
}

// Nessun file di dati imprevisto, e ogni sezione ha i suoi testi nelle traduzioni.
const knownData = new Set([...DATA_FILES.map((f) => f[0]), 'badges.json']);
for (const f of readdirSync(join(ROOT, 'data'))) if (!knownData.has(f)) fail(`data/${f}: file di dati non previsto (aggiungilo a DATA_FILES in scripts/check.mjs se è voluto)`);
const firstPrinciple = source?.home?.manifesto?.principles?.[0]?.text || '';
if (!/qualunque parte/i.test(firstPrinciple)) fail('i18n/it.json: il primo principio del manifesto deve dire che si condanna la violenza da qualunque parte venga');
for (const section of new Set(DATA_FILES.map((f) => f[2]))) {
  const declaration = lookup(source || {}, `${section}.nonviolence`) || '';
  if (!/violenza/i.test(declaration) || !/qualunque parte/i.test(declaration)) fail(`i18n/it.json: "${section}.nonviolence" deve condannare ogni violenza, da qualunque parte venga`);
  for (const key of ['news.title', 'news.empty', 'requests.title', 'requests.intro', 'stats.title', 'stats.intro']) {
    if (typeof lookup(source || {}, `${section}.${key}`) !== 'string') fail(`i18n/it.json: manca "${section}.${key}" (testo della pagina di sezione)`);
  }
  if (!Object.keys(lookup(source || {}, `${section}.stats.groups`) || {}).length) fail(`i18n/it.json: mancano i gruppi "${section}.stats.groups"`);
}

// ── Badge ─────────────────────────────────────────────────────────────────────
try {
  for (const { file, content } of buildAll()) {
    if (!existsSync(file)) fail(`${rel(file)}: manca. Esegui: node scripts/build-badges.mjs`);
    else if (readFileSync(file, 'utf8') !== content) fail(`${rel(file)}: non aggiornato. Esegui: node scripts/build-badges.mjs`);
  }
  for (const file of walk(join(ROOT, 'badges'), '.svg')) {
    const svg = readFileSync(file, 'utf8');
    // Buona formazione minima: dopo il nome di un tag ci dev'essere uno spazio, "/" o ">" (es. "<rectx=" è un errore), e i <a> devono chiudersi.
    const badTag = svg.match(/<([A-Za-z][A-Za-z0-9:-]*)([^\s>\/A-Za-z0-9:-])/);
    if (badTag) fail(`${rel(file)}: tag SVG malformato vicino a "<${badTag[1]}${badTag[2]}"`);
    if ((svg.match(/<a[\s>]/g) || []).length !== (svg.match(/<\/a>/g) || []).length) fail(`${rel(file)}: tag <a> non chiuso`);
    const hrefs = [...svg.matchAll(/(?:xlink:)?href="([^"]*)"/g)].map((m) => m[1]);
    if (/<script|\son[a-z]+=/i.test(svg) || hrefs.some((h) => h !== '__SITE_URL__/')) fail(`${rel(file)}: contiene script o collegamenti diversi da __SITE_URL__/`);
    if (hrefs.length !== 1) fail(`${rel(file)}: deve avere esattamente un link (verso il sito), ne ha ${hrefs.length}`);
  }

  // Lingue del badge: dati completi, direzione coerente con la scrittura, nessun file in più.
  const badgeLanguages = loadBadgeLanguages();
  const RTL_SCRIPT = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  const codes = new Set();
  const needed = readBadges().confirmationsNeeded;
  if (!Number.isInteger(needed) || needed < 2) fail('data/badges.json: confirmationsNeeded deve essere almeno 2 (conferme indipendenti)');
  for (const l of badgeLanguages) {
    const at = `data/badges.json → ${l.code}`;
    if (!/^[a-z]{2,3}$/.test(l.code)) fail(`${at}: codice lingua non valido`);
    if (codes.has(l.code)) fail(`${at}: lingua duplicata`);
    codes.add(l.code);
    if (typeof l.name !== 'string' || !l.name.trim()) fail(`${at}: manca il nome`);
    if (!['ltr', 'rtl'].includes(l.dir)) fail(`${at}: "dir" deve essere "ltr" o "rtl"`);
    if (!['reviewed', 'draft'].includes(l.status)) fail(`${at}: "status" deve essere "reviewed" o "draft"`);
    if (RTL_SCRIPT.test(l.text || '') !== (l.dir === 'rtl')) fail(`${at}: la direzione "${l.dir}" non corrisponde alla scrittura del testo`);

    // Revisione da madrelingua: ogni conferma è legata al testo esatto che è stato letto.
    if (!Array.isArray(l.reviews)) fail(`${at}: manca l'elenco "reviews" (anche vuoto)`);
    else {
      const seenIssues = new Set();
      for (const r of l.reviews) {
        if (!Number.isInteger(r?.issue) || r.issue < 1) fail(`${at}: una conferma non ha un numero di segnalazione valido`);
        else if (seenIssues.has(r.issue)) fail(`${at}: la segnalazione #${r.issue} è registrata due volte (servono conferme indipendenti)`);
        else seenIssues.add(r.issue);
        if (r?.verdict !== 'ok') fail(`${at}: conferma con verdict "${r?.verdict}" (ammesso solo "ok")`);
        if (!isIsoDate(r?.date)) fail(`${at}: una conferma ha una data non valida`);
        if (r?.textHash !== textHash(l.text)) fail(`${at}: la conferma #${r?.issue} riguarda un testo diverso da quello attuale (usa scripts/review-badge.mjs fix per cambiare un testo)`);
      }
      const confirmed = validReviews(l).length;
      if (l.status === 'reviewed' && !l.nativeAuthor && confirmed < needed) fail(`${at}: segnata "reviewed" ma ha ${confirmed} conferme su ${needed}`);
      if (l.status === 'draft' && confirmed >= needed) fail(`${at}: ha già ${confirmed} conferme: passala a "reviewed" con scripts/review-badge.mjs`);
      if (l.nativeAuthor && l.status !== 'reviewed') fail(`${at}: "nativeAuthor" richiede status "reviewed"`);
    }
  }
  // Contrasto dei due stili del badge (testo 4.5:1, icona e bordo 3:1).
  const lumOf = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrastOf = (a, b) => { const [hi, lo] = [lumOf(a), lumOf(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  for (const style of BADGE_STYLES) {
    const c = BADGE_COLORS[style];
    for (const [part, min] of [['text', 4.5], ['icon', 3], ['border', 3]]) {
      const ratio = contrastOf(c[part], c.background);
      if (ratio < min) fail(`badge ${style}: contrasto troppo basso per "${part}" (${ratio.toFixed(2)}:1, minimo ${min}:1)`);
    }
  }
  for (const code of Object.keys(dicts)) if (!codes.has(code)) fail(`data/badges.json: manca la lingua del sito "${code}"`);
  const expectedFiles = new Set(badgeLanguages.flatMap((l) => BADGE_STYLES.map((s) => badgeFileName(l.code, s))));
  for (const name of readdirSync(join(ROOT, 'badges'))) if (!expectedFiles.has(name)) fail(`badges/${name}: file non previsto (lingua assente da data/badges.json)`);
} catch (e) {
  fail(`badge: ${e.message}`);
}

// ── Esito ─────────────────────────────────────────────────────────────────────
// ── Moduli per le segnalazioni (GitHub Issues) ────────────────────────────────
const templatesDir = join(ROOT, '.github', 'ISSUE_TEMPLATE');
const templateFiles = existsSync(templatesDir) ? readdirSync(templatesDir).filter((f) => f.endsWith('.yml')) : [];
if (!templateFiles.includes('config.yml')) fail('.github/ISSUE_TEMPLATE/config.yml mancante');
for (const f of templateFiles) {
  const at = `.github/ISSUE_TEMPLATE/${f}`;
  const text = readFileSync(join(templatesDir, f), 'utf8');
  if (EMAIL.test(text)) fail(`${at}: contiene un indirizzo email`);
  let doc;
  try { doc = parseYaml(text); } catch (e) { fail(`${at}: YAML non valido (${e.message})`); continue; }
  if (f === 'config.yml') {
    if (doc?.blank_issues_enabled !== false) fail(`${at}: blank_issues_enabled deve essere false (solo moduli guidati)`);
    continue;
  }
  for (const err of validateIssueForm(doc)) fail(`${at}: ${err}`);
  const intro = (doc?.body || []).filter((b) => b.type === 'markdown').map((b) => b.attributes?.value || '').join('\n');
  if (!/dati personali|personal data/i.test(intro)) fail(`${at}: manca l'avviso che le segnalazioni sono pubbliche e senza dati personali`);
  const boxes = (doc?.body || []).find((b) => b.type === 'checkboxes');
  if (!boxes || !boxes.attributes?.options?.every((o) => o.required === true)) fail(`${at}: tutte le conferme devono essere obbligatorie (required: true su ogni casella)`);
}
for (const t of referencedTemplates) if (!templateFiles.includes(t)) fail(`una pagina rimanda al modulo "${t}", che non esiste in .github/ISSUE_TEMPLATE/`);

// ── Colori dei due temi ───────────────────────────────────────────────────────
{
  const css = readFileSync(join(ROOT, 'assets/css/style.css'), 'utf8');
  const tokens = (block) => Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = tokens(css.match(/:root \{([^}]*)\}/)?.[1] || '');
  const darkMedia = tokens(css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/)?.[1] || '');
  const darkManual = tokens(css.match(/:root\[data-theme="dark"\] \{([^}]*)\}/)?.[1] || '');
  if (!Object.keys(darkMedia).length || !Object.keys(darkManual).length) fail('assets/css/style.css: mancano i blocchi del tema scuro');
  else if (JSON.stringify(Object.entries(darkMedia).sort()) !== JSON.stringify(Object.entries(darkManual).sort())) fail('assets/css/style.css: i due blocchi del tema scuro (sistema e scelta manuale) non coincidono');
  const channel = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = (hex) => { const [r, g, b] = channel(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const PAIRS = [['--ink', '--bg', 4.5], ['--ink', '--surface', 4.5], ['--muted', '--bg', 4.5], ['--muted', '--surface', 4.5], ['--link', '--bg', 4.5], ['--link', '--surface', 4.5],
    ['--on-brand', '--brand', 4.5], ['--btn-ink', '--btn-bg', 4.5], ['--ok-ink', '--ok-bg', 4.5], ['--warn-ink', '--warn-bg', 4.5], ['--accent', '--brand', 3]];
  for (const [name, theme] of [['chiaro', light], ['scuro', { ...light, ...darkManual }]]) {
    for (const [fg, bg, min] of PAIRS) {
      if (!/^#[0-9a-f]{6}$/i.test(theme[fg] || '') || !/^#[0-9a-f]{6}$/i.test(theme[bg] || '')) { fail(`style.css: colore mancante o non esadecimale (${fg}/${bg}) nel tema ${name}`); continue; }
      const r = ratio(theme[fg], theme[bg]);
      if (r < min) fail(`style.css: contrasto troppo basso nel tema ${name}: ${fg} su ${bg} = ${r.toFixed(2)}:1 (minimo ${min}:1)`);
    }
  }
}

// ── Indirizzo del repository ricavato da GitHub Pages ─────────────────────────
for (const [host, path, expected] of [
  ['utente.github.io', '/tribunus-plebis/', 'https://github.com/utente/tribunus-plebis'],
  ['utente.github.io', '/', 'https://github.com/utente/utente.github.io'],
  ['esempio.org', '/x/', ''],
  ['utente.github.io.attaccante.com', '/repo/', ''],
  ['-sbagliato.github.io', '/repo/', ''],
  ['utente.github.io', '/re po/', ''],
]) {
  if (deriveRepoUrl(host, path) !== expected) fail(`repo.js: deriveRepoUrl("${host}", "${path}") ha dato "${deriveRepoUrl(host, path)}", atteso "${expected}"`);
}

for (const w of warnings) console.log(`⚠  ${w}`);
for (const e of errors) console.log(`✗  ${e}`);
console.log(errors.length ? `\n${errors.length} errori, ${warnings.length} avvisi.` : `\nOK — nessun errore (${warnings.length} avvisi).`);
process.exit(errors.length ? 1 : 0);
