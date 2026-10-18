import { start } from './app.js';
import { wireRepoLinks } from './layout.js';
import { ROOT, getLang, t } from './i18n.js';
import { setupShare } from './share.js';

const select = document.getElementById('badge-lang');
const previewLink = document.getElementById('badge-link');
const preview = document.getElementById('badge-preview');
const compare = document.getElementById('badge-compare');
const previewDark = document.getElementById('badge-preview-dark');
const previewLight = document.getElementById('badge-preview-light');
const markdown = document.getElementById('snippet-markdown');
const html = document.getElementById('snippet-html');
const mdSection = document.getElementById('md-section');
const htmlTitle = document.getElementById('html-title');
const styleNote = document.getElementById('style-note');
const note = document.getElementById('local-note');
const draftNote = document.getElementById('badge-draft');
const reviewedNote = document.getElementById('badge-reviewed');
const progress = document.getElementById('badge-progress');
const reviewLink = document.getElementById('badge-review-link');

/** Lingue del badge, da data/badges.json (diverse da quelle del sito). Si scartano le voci malformate. */
let languages = [];
let confirmationsNeeded = 2;
async function loadLanguages() {
  const response = await fetch(`${ROOT}data/badges.json`);
  if (!response.ok) throw new Error(`badges.json: HTTP ${response.status}`);
  const data = await response.json();
  const text = (v) => typeof v === 'string' && v.trim() !== '';
  confirmationsNeeded = Number.isInteger(data.confirmationsNeeded) && data.confirmationsNeeded > 0 ? data.confirmationsNeeded : 2;
  languages = (Array.isArray(data.languages) ? data.languages : []).filter((l) => /^[a-z]{2,3}$/.test(l?.code) && text(l.name) && text(l.text));
}

const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAlt = (value) => value.replace(/[[\]]/g, '');
/** Come in scripts/build-badges.mjs: lo stile scuro mantiene il nome storico. */
const fileName = (code, style) => (style === 'light' ? `badge-${code}-light.svg` : `badge-${code}.svg`);
const currentStyle = () => document.querySelector('input[name="badge-style"]:checked')?.value ?? 'dark';

function update() {
  const language = languages.find((l) => l.code === select.value) ?? languages[0];
  if (!language) return;
  const { code, name, text } = language;
  const style = currentStyle();
  const siteUrl = new URL(ROOT, location.href);
  siteUrl.search = '';
  siteUrl.hash = '';
  const site = siteUrl.href;
  const absolute = (s) => new URL(`badges/${fileName(code, s)}`, site).href;

  // Anteprima: un solo badge, oppure i due stili affiancati nella modalità automatica.
  const auto = style === 'auto';
  previewLink.hidden = auto;
  compare.hidden = !auto;
  styleNote.hidden = !auto;
  mdSection.hidden = auto;
  if (auto) {
    for (const [img, s] of [[previewDark, 'dark'], [previewLight, 'light']]) {
      img.src = `${ROOT}badges/${fileName(code, s)}`;
      img.alt = text;
      img.lang = code;
    }
    // Nel README di GitHub l'immagine cambia con il tema di chi guarda: scuro con scuro, chiaro con chiaro.
    html.textContent = `<a href="${site}"><picture><source media="(prefers-color-scheme: dark)" srcset="${absolute('dark')}"><source media="(prefers-color-scheme: light)" srcset="${absolute('light')}"><img src="${absolute('light')}" alt="${escapeAttr(text)}" width="320" height="40"></picture></a>`;
    htmlTitle.textContent = t('badge.htmlAutoTitle');
  } else {
    preview.src = `${ROOT}badges/${fileName(code, style)}`;
    preview.alt = text;
    preview.lang = code;
    markdown.textContent = `[![${escapeAlt(text)}](${absolute(style)})](${site})`;
    html.textContent = `<a href="${site}"><img src="${absolute(style)}" alt="${escapeAttr(text)}" width="320" height="40"></a>`;
    htmlTitle.textContent = t('badge.htmlTitle');
  }

  // Revisione: finché il testo non è confermato da madrelingua è una bozza, e c'è il modo di aiutare a rivederlo.
  const confirmed = Array.isArray(language.reviews) ? language.reviews.length : 0;
  draftNote.hidden = language.status !== 'draft';
  reviewedNote.hidden = language.status !== 'reviewed';
  progress.textContent = language.status === 'draft' && confirmed > 0 ? t('badge.reviewProgress', { n: confirmed, total: confirmationsNeeded }) : '';
  reviewLink.dataset.repoPath = `issues/new?template=badge-review.yml&language=${encodeURIComponent(`${name} (${code})`)}&current_text=${encodeURIComponent(text)}`;
  wireRepoLinks();

  note.hidden = !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

function fillLanguages() {
  select.replaceChildren(
    ...languages.map(({ code, name }) => {
      const option = document.createElement('option');
      option.value = code;
      option.lang = code;
      option.textContent = name;
      return option;
    }),
  );
  // Si parte dalla lingua del sito se c'è un badge in quella lingua, altrimenti dall'inglese.
  const preferred = [getLang(), 'en'].find((code) => languages.some((l) => l.code === code));
  select.value = preferred ?? languages[0]?.code ?? '';
}

async function copy(button, source) {
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(source.textContent);
    status.textContent = t('badge.copied');
  } catch {
    status.textContent = t('badge.copyFail');
  }
  button.focus();
}

setupShare(document.getElementById('share-button'), document.getElementById('share-status'));
select.addEventListener('change', update);
for (const radio of document.querySelectorAll('input[name="badge-style"]')) radio.addEventListener('change', update);
document.addEventListener('langchange', () => { if (languages.length) { fillLanguages(); update(); } });
document.getElementById('copy-markdown').addEventListener('click', (e) => copy(e.currentTarget, markdown));
document.getElementById('copy-html').addEventListener('click', (e) => copy(e.currentTarget, html));

try {
  await loadLanguages();
} catch (error) {
  console.error(error);
}
await start();
