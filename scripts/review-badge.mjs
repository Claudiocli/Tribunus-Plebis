// Registra la revisione di un testo del badge da parte di un madrelingua. Uso:
//   node scripts/review-badge.mjs --list
//   node scripts/review-badge.mjs ok  <codice> <n. segnalazione> [AAAA-MM-GG]      un madrelingua conferma il testo attuale
//   node scripts/review-badge.mjs fix <codice> <n. segnalazione> "<nuovo testo>"   un madrelingua propone un testo corretto
//
// Regole (spiegate in docs/revisione-traduzioni.md):
// - `ok` aggiunge una conferma al testo attuale. Con `confirmationsNeeded` conferme da segnalazioni diverse la lingua
//   passa a "reviewed" e la scritta «bozza» sparisce da sola dalla pagina del badge.
// - `fix` sostituisce il testo, azzera le conferme precedenti (riguardavano un altro testo) e conta la proposta come
//   la prima conferma del testo nuovo. La lingua torna "draft" finché non arrivano le altre.
import { buildAll, renderBadge } from './build-badges.mjs';
import { readBadges, textHash, validReviews, writeBadges } from './badge-data.mjs';

const [command, code, issueArg, extra] = process.argv.slice(2);
const data = readBadges();
const today = () => new Date().toISOString().slice(0, 10);
const die = (message) => { console.error(`✗ ${message}`); process.exit(1); };

if (command === '--list') {
  console.log(`Conferme necessarie per passare a "reviewed": ${data.confirmationsNeeded}\n`);
  for (const l of data.languages) {
    const n = validReviews(l).length;
    const state = l.status === 'reviewed' ? (l.nativeAuthor ? 'rivista (autore madrelingua)' : 'rivista') : `bozza, conferme ${n}/${data.confirmationsNeeded}`;
    console.log(`${l.code.padEnd(3)} ${l.name.padEnd(18)} ${state.padEnd(32)} ${l.text}`);
  }
  process.exit(0);
}

if (!['ok', 'fix'].includes(command)) die('uso: review-badge.mjs --list | ok <codice> <n. segnalazione> [data] | fix <codice> <n. segnalazione> "<nuovo testo>"');
const language = data.languages.find((l) => l.code === code);
if (!language) die(`lingua sconosciuta "${code}" (vedi: node scripts/review-badge.mjs --list)`);
const issue = Number(issueArg);
if (!Number.isInteger(issue) || issue < 1) die('indica il numero della segnalazione GitHub (intero positivo): è la prova pubblica della revisione');

if (command === 'ok') {
  const date = extra ?? today();
  const isRealDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!isRealDate) die('la data deve essere una data reale nel formato AAAA-MM-GG');
  if (validReviews(language).some((r) => r.issue === issue)) die(`la segnalazione #${issue} è già registrata per ${code}: servono conferme indipendenti`);
  language.reviews = [...validReviews(language), { issue, date, verdict: 'ok', textHash: textHash(language.text) }];
} else {
  const text = (extra ?? '').normalize('NFC').trim();
  if (!text) die('manca il nuovo testo');
  if (text === language.text) die('il testo proposto è identico a quello attuale: usa "ok"');
  try { renderBadge(code, text, language.dir); } catch (e) { die(e.message); }
  language.text = text;
  language.reviews = [{ issue, date: today(), verdict: 'ok', textHash: textHash(text) }];
  if (!language.nativeAuthor) language.status = 'draft';
}

const confirmed = validReviews(language).length;
if (!language.nativeAuthor) language.status = confirmed >= data.confirmationsNeeded ? 'reviewed' : 'draft';
writeBadges(data);
buildAll({ write: true });
console.log(`✓ ${code} (${language.name}): ${language.status === 'reviewed' ? 'RIVISTA' : 'bozza'} — conferme ${confirmed}/${data.confirmationsNeeded} — "${language.text}"`);
console.log('Ora esegui: node scripts/check.mjs, poi pubblica.');
