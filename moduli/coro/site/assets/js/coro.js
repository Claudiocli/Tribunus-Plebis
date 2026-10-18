import { CONFIG } from './config.js';
import { start } from './app.js';
import { ROOT, formatNumber, t } from './i18n.js';
import { clear, el } from './dom.js';
import { LIMITS, isGoogleSheetsUrl, supportersFromCsv, supportersFromJson } from './supporters-data.js';

let supporters = null;
let failed = false;

async function loadSupporters() {
  if (CONFIG.supportersCsvUrl) {
    if (!isGoogleSheetsUrl(CONFIG.supportersCsvUrl)) throw new Error('supportersCsvUrl non valido.');
    const response = await fetch(CONFIG.supportersCsvUrl, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`CSV: HTTP ${response.status}`);
    return supportersFromCsv(await response.text());
  }
  const response = await fetch(`${ROOT}data/supporters.json`);
  if (!response.ok) throw new Error(`supporters.json: HTTP ${response.status}`);
  return supportersFromJson(await response.json());
}

function nameItem(person) {
  return el('li', {}, el('strong', {}, person.name), person.place ? el('span', { class: 'place' }, person.place) : null);
}

function render() {
  const slot = document.getElementById('chorus-content');
  clear(slot);
  if (failed) {
    slot.append(el('p', { class: 'notice' }, t('common.loadError')));
    return;
  }
  if (!supporters) return;
  if (!supporters.length) {
    slot.append(el('p', { class: 'notice' }, t('chorus.empty')));
    return;
  }

  const visible = supporters.filter((s) => !s.hidden);
  const hiddenCount = supporters.length - visible.length;
  const total = supporters.length;
  slot.append(
    el('p', { class: 'chorus-count' }, total === 1 ? t('chorus.countOne') : t('chorus.count', { count: formatNumber(total) })),
    hiddenCount ? el('p', { class: 'muted' }, t('chorus.hidden')) : null,
    visible.length ? el('ul', { class: 'chorus-list', 'aria-label': t('chorus.listLabel') }, visible.slice(0, LIMITS.shown).map(nameItem)) : null,
  );
}

document.addEventListener('langchange', render);
await start();

try {
  supporters = await loadSupporters();
} catch (error) {
  console.error(error);
  failed = true;
}
render();
