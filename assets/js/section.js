// Pagina di sezione (Italia – Sud, Francia, ...): notizie, richieste e numeri da due file di dati.
// La pagina dichiara nel <body> quale sezione è: data-section="itsud", data-news="news.json", data-stats="stats.json".
// I testi vengono da i18n: <sezione>.* (specifici) e section.* (comuni).
import { start } from './app.js';
import { ROOT, formatDate, t, tKeys } from './i18n.js';
import { clear, el, externalLink } from './dom.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SECTION = document.body.dataset.section;

let news = null;
let stats = null;
let failed = false;

/** Scarta le voci malformate: titolo, fonte, data ISO e link https sono obbligatori. */
function isValid(item) {
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  const okUrl = typeof item?.url === 'string' && item.url.startsWith('https://');
  const valid = item && text(item.id) && text(item.title) && text(item.source) && ISO_DATE.test(item.date || '') && okUrl;
  if (!valid) console.warn('Voce scartata (malformata):', item);
  return valid;
}

async function load(file) {
  const response = await fetch(`${ROOT}data/${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const data = await response.json();
  return { ...data, items: (Array.isArray(data.items) ? data.items : []).filter(isValid) };
}

function verifiedBadge(item) {
  return el(
    'span',
    { class: item.verified ? 'tag tag-ok' : 'tag tag-warn' },
    t(item.verified ? 'section.verified.yes' : 'section.verified.no'),
  );
}

function sourceLine(item) {
  return el(
    'p',
    { class: 'source' },
    `${t('common.source')}: `,
    externalLink(item.url, item.source, t('a11y.newTab')),
    ' ',
    verifiedBadge(item),
  );
}

function extras(item) {
  return [
    item.attribution ? el('p', { class: 'attribution' }, item.attribution) : null,
    item.note ? el('p', { class: 'muted' }, item.note) : null,
  ];
}

function newsCard(item) {
  return el(
    'article',
    { class: 'card' },
    el('p', { class: 'card-date' }, el('time', { datetime: item.date }, formatDate(item.date))),
    el('h4', {}, item.title),
    el('p', {}, item.summary),
    extras(item),
    sourceLine(item),
  );
}

function requestCard(item) {
  return el(
    'article',
    { class: 'card' },
    el('h4', {}, item.title),
    el('p', {}, el('strong', {}, `${t('section.status')}: `), item.summary),
    extras(item),
    sourceLine(item),
  );
}

function statCard(item) {
  const meta = [item.period && `${t('section.period')}: ${item.period}`, item.original_body && `${t('section.body')}: ${item.original_body}`]
    .filter(Boolean)
    .join(' · ');
  return el(
    'article',
    { class: 'card stat' },
    item.value ? el('p', { class: 'stat-value' }, item.value) : null,
    el('h4', {}, item.title),
    item.summary ? el('p', {}, item.summary) : null,
    meta ? el('p', { class: 'muted' }, meta) : null,
    extras(item),
    sourceLine(item),
  );
}

function updatedLine(iso) {
  return iso && ISO_DATE.test(iso) ? el('p', { class: 'muted' }, t('common.updated', { date: formatDate(iso) })) : null;
}

function render() {
  const slot = document.getElementById('section-content');
  clear(slot);
  if (failed || !news || !stats) {
    slot.append(el('p', { class: 'notice' }, t('common.loadError')));
    return;
  }

  const byDateDesc = (a, b) => b.date.localeCompare(a.date);
  const newsItems = news.items.filter((i) => i.category === 'news').sort(byDateDesc);
  const requestItems = news.items.filter((i) => i.category === 'request');
  const statItems = stats.items.filter((i) => i.category === 'stat');
  const hasRequests = requestItems.length > 0;
  // L'ordine dei gruppi è quello in cui compaiono nel file di traduzione.
  const groups = tKeys(`${SECTION}.stats.groups`);

  slot.append(
    el(
      'section',
      { 'aria-labelledby': 'h-news' },
      el('h2', { id: 'h-news' }, t(`${SECTION}.news.title`)),
      updatedLine(news.updated),
      el('div', { class: 'stack' }, newsItems.length ? newsItems.map(newsCard) : el('p', {}, t(`${SECTION}.news.empty`))),
    ),
    hasRequests
      ? el(
          'section',
          { 'aria-labelledby': 'h-requests' },
          el('h2', { id: 'h-requests' }, t(`${SECTION}.requests.title`)),
          el('p', {}, t(`${SECTION}.requests.intro`)),
          ISO_DATE.test(news.requestsAsOf || '') ? el('p', { class: 'muted' }, t('common.asOf', { date: formatDate(news.requestsAsOf) })) : null,
          el('div', { class: 'stack' }, requestItems.map(requestCard)),
        )
      : null,
    el(
      'section',
      { 'aria-labelledby': 'h-stats' },
      el('h2', { id: 'h-stats' }, t(`${SECTION}.stats.title`)),
      el('p', {}, t(`${SECTION}.stats.intro`)),
      updatedLine(stats.updated),
      groups.map((group) => {
        const items = statItems.filter((i) => i.group === group);
        if (!items.length) return null;
        return el('div', { class: 'stat-group' }, el('h3', {}, t(`${SECTION}.stats.groups.${group}`)), el('div', { class: 'grid' }, items.map(statCard)));
      }),
    ),
  );
}

document.addEventListener('langchange', render);
await start();

try {
  [news, stats] = await Promise.all([load(document.body.dataset.news), load(document.body.dataset.stats)]);
} catch (error) {
  console.error(error);
  failed = true;
}
render();
