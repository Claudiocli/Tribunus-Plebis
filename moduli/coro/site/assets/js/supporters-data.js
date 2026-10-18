// Lettura e validazione delle adesioni al coro (nessun accesso al DOM: testabile in Node con scripts/test-supporters.mjs).
// Ogni adesione ha solo un nome scelto da chi aderisce e un paese/regione. Nessun testo libero.

export const LIMITS = { name: 40, place: 60, shown: 2000 };

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const LINK_PATTERN = /:\/\/|www\./i;
const MARKUP_PATTERN = /[<>]/;
const YES = new Set(['si', 'yes', 'true', '1', 'oui']);

// Nomi delle colonne accettati (confronto senza accenti e senza maiuscole).
const COLUMNS = {
  name: ['nome', 'name'],
  place: ['paese', 'country', 'place'],
  anonymous: ['anonimo', 'anonymous'],
  approved: ['approved', 'approvato'],
};

const fold = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

/** Neutralizza le "formule" (=, +, -, @ iniziali) anche in visualizzazione. */
const neutralize = (value) => String(value ?? '').trim().replace(/^[=+\-@\t\r]+/, '').trim();

/** Parser CSV (RFC 4180): campi tra virgolette, virgolette raddoppiate, a capo dentro i campi. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Controlla e ripulisce un'adesione. Restituisce null se è malformata o contiene dati che non devono comparire.
 * Se chi aderisce non vuole mostrare il nome (o non l'ha scritto), l'adesione conta nel totale ma
 * nome e luogo vengono scartati subito: non arrivano mai alla pagina.
 */
export function cleanSupporter({ name, place, anonymous } = {}) {
  const cleanName = neutralize(name);
  const cleanPlace = neutralize(place);
  if (cleanName.length > LIMITS.name || cleanPlace.length > LIMITS.place) return null;
  for (const value of [cleanName, cleanPlace]) {
    if (EMAIL_PATTERN.test(value) || LINK_PATTERN.test(value) || MARKUP_PATTERN.test(value)) return null;
  }
  const hidden = YES.has(fold(anonymous)) || !cleanName;
  return hidden ? { name: '', place: '', hidden: true } : { name: cleanName, place: cleanPlace, hidden: false };
}

/**
 * Adesioni dal CSV della scheda pubblica. Conta SOLO le righe con approved = sì.
 * Rifiuta tutto (lancia un errore) se manca la colonna "approved" o "nome",
 * o se la scheda contiene una colonna email: significa che è stata pubblicata la scheda sbagliata.
 */
export function supportersFromCsv(text) {
  const [header = [], ...rows] = parseCsv(text);
  const names = header.map(fold);
  if (names.some((n) => n.includes('mail'))) {
    throw new Error('La scheda pubblicata contiene una colonna email: pubblica solo la scheda pubblica.');
  }
  // Solo le colonne previste: se la scheda pubblicata ne ha altre (data, consenso...) è quella sbagliata.
  const allowed = new Set(Object.values(COLUMNS).flat());
  const unexpected = names.filter((n) => n && !allowed.has(n));
  if (unexpected.length) throw new Error('Colonne non previste nella scheda pubblicata: ' + unexpected.join(', ') + '. Pubblica solo la scheda "Pubblico".');  const index = Object.fromEntries(Object.entries(COLUMNS).map(([key, aliases]) => [key, names.findIndex((n) => aliases.includes(n))]));
  if (index.name < 0 || index.approved < 0) throw new Error('Colonne "nome" e "approved" obbligatorie.');
  const cell = (r, key) => (index[key] >= 0 ? r[index[key]] : '');
  return rows
    .filter((r) => YES.has(fold(cell(r, 'approved'))))
    .map((r) => cleanSupporter({ name: cell(r, 'name'), place: cell(r, 'place'), anonymous: cell(r, 'anonymous') }))
    .filter(Boolean);
}

/** Adesioni da data/supporters.json (cache opzionale, già approvate a mano). */
export function supportersFromJson(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter((v) => v && typeof v === 'object').map(cleanSupporter).filter(Boolean);
}

/** True solo per un URL https://docs.google.com/spreadsheets/... */
export function isGoogleSheetsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'docs.google.com' && url.pathname.startsWith('/spreadsheets/');
  } catch {
    return false;
  }
}
