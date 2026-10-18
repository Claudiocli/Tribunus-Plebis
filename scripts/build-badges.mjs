// Genera badges/badge-<codice>.svg da data/badges.json (testo, direzione e stato di ogni lingua del badge).
// Uso: node scripts/build-badges.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 320;
const HEIGHT = 40;
const ICON_AREA = 44; // spazio riservato all'icona
const PADDING = 12;
const AVAILABLE = WIDTH - ICON_AREA - PADDING;
const FONT_SIZES = [13, 12, 11];
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Noto Sans CJK JP', 'Noto Sans Arabic', sans-serif";
// Due stili: "dark" (sfondo scuro, il badge originale) e "light" (sfondo chiaro). check.mjs ne controlla il contrasto.
export const BADGE_COLORS = {
  dark: { background: '#14213d', border: '#f2a541', text: '#ffffff', icon: '#f2a541' },
  light: { background: '#ffffff', border: '#14213d', text: '#14213d', icon: '#b45309' },
};
export const BADGE_STYLES = Object.keys(BADGE_COLORS);
/** Nome del file: lo stile scuro mantiene il nome storico (badge-it.svg), quello chiaro aggiunge «-light». */
export const badgeFileName = (code, style = 'dark') => (style === 'light' ? `badge-${code}-light.svg` : `badge-${code}.svg`);
// Dove porta il clic quando l'SVG è aperto da solo. Il segnaposto diventa l'indirizzo vero alla pubblicazione
// (workflow) e in anteprima locale (scripts/serve.mjs). Dentro un <img> il link non funziona: per questo
// la pagina /badge/ dà anche il codice Markdown/HTML che avvolge l'immagine in un link.
const LINK = '__SITE_URL__/';
const HEART = 'M32 51 14 33a10.5 10.5 0 0 1 15-14.7l3 3 3-3A10.5 10.5 0 0 1 50 33z';

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Larghezza stimata (in em) di un carattere: cifre prudenti, perché il font reale dipende dal dispositivo. */
function charEm(ch) {
  const code = ch.codePointAt(0);
  if ((code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7af) || (code >= 0xff00 && code <= 0xffef) || (code >= 0x3000 && code <= 0x303f)) return 1;
  if ((code >= 0x0590 && code <= 0x08ff) || (code >= 0xfb1d && code <= 0xfdff) || (code >= 0xfe70 && code <= 0xfeff)) return 0.6;
  return 0.6;
}
const widthOf = (text, fontSize) => [...text].reduce((sum, ch) => sum + charEm(ch), 0) * fontSize;

/** Divide il testo in 1 o 2 righe equilibrate che stiano nello spazio disponibile. */
function layoutText(text, fontSize) {
  if (widthOf(text, fontSize) <= AVAILABLE) return [text];
  const chars = [...text];
  let best = null;
  for (let i = 1; i < chars.length; i += 1) {
    const atSpace = chars[i] === ' ';
    const cjkBreak = charEm(chars[i - 1]) === 1 && charEm(chars[i]) === 1;
    if (!atSpace && !cjkBreak) continue;
    const first = chars.slice(0, i).join('').trim();
    const second = chars.slice(atSpace ? i + 1 : i).join('').trim();
    const score = Math.max(widthOf(first, fontSize), widthOf(second, fontSize));
    if (!best || score < best.score) best = { score, lines: [first, second] };
  }
  return best && best.score <= AVAILABLE ? best.lines : null;
}

export function renderBadge(lang, text, dir = 'ltr', style = 'dark') {
  const COLORS = BADGE_COLORS[style];
  if (!COLORS) throw new Error(`stile di badge sconosciuto: ${style}`);
  let lines = null;
  let fontSize = 0;
  for (const size of FONT_SIZES) {
    lines = layoutText(text, size);
    if (lines) { fontSize = size; break; }
  }
  if (!lines) throw new Error(`badge-${lang}: il testo è troppo lungo per un badge ${WIDTH}x${HEIGHT}. Accorcialo.`);

  const rtl = dir === 'rtl';
  const iconCx = rtl ? WIDTH - ICON_AREA / 2 : ICON_AREA / 2;
  const textCx = rtl ? (WIDTH - ICON_AREA + PADDING) / 2 : (ICON_AREA + WIDTH - PADDING) / 2;
  const lineHeight = Math.round(fontSize * 1.25);
  const firstBaseline = HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;

  const tspans = lines
    .map((line, i) => `<text x="${textCx}" y="${(firstBaseline + i * lineHeight).toFixed(1)}">${escapeXml(line)}</text>`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="t" lang="${lang}" xml:lang="${lang}">
  <title id="t">${escapeXml(text)}</title>
  <a href="${LINK}" target="_top">
  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="8" fill="${COLORS.background}" stroke="${COLORS.border}"/>
  <path d="${HEART}" fill="${COLORS.icon}" transform="translate(${iconCx - 16} ${HEIGHT / 2 - 16}) scale(0.5)"/>
  <g fill="${COLORS.text}" font-family="${FONT}" font-size="${fontSize}" font-weight="600" text-anchor="middle" direction="${dir}">
    ${tspans}
  </g>
  </a>
</svg>
`;
}

/** Elenco delle lingue del badge, da data/badges.json (diverso dall'elenco delle lingue del sito). */
export function loadBadgeLanguages() {
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'badges.json'), 'utf8'));
  if (!Array.isArray(data.languages) || data.languages.length === 0) throw new Error('data/badges.json: manca l\'elenco "languages"');
  return data.languages;
}

/** Restituisce { file, content } per ogni lingua del badge. Con write=true scrive i file e toglie quelli di lingue non più presenti. */
export function buildAll({ write = false } = {}) {
  const outDir = join(ROOT, 'badges');
  const results = loadBadgeLanguages().flatMap(({ code, text, dir }) => {
    if (typeof text !== 'string' || !text.trim()) throw new Error(`data/badges.json: manca il testo per "${code}"`);
    return BADGE_STYLES.map((style) => ({
      file: join(outDir, badgeFileName(code, style)),
      content: renderBadge(code, text.trim(), dir === 'rtl' ? 'rtl' : 'ltr', style),
    }));
  });
  if (write) {
    mkdirSync(outDir, { recursive: true });
    const keep = new Set(results.map((r) => r.file));
    for (const name of readdirSync(outDir)) {
      const full = join(outDir, name);
      if (name.endsWith('.svg') && !keep.has(full)) unlinkSync(full);
    }
    for (const { file, content } of results) writeFileSync(file, content, 'utf8');
  }
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const built = buildAll({ write: true });
  console.log(`Generati ${built.length} badge: ${built.map((b) => b.file.split(/[\\/]/).pop()).join(', ')}`);
}
