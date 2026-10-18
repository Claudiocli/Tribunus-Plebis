// Lettura e scrittura di data/badges.json con le regole di revisione dei testi da parte di madrelingua.
//
// Ogni lingua ha: code, name, dir, status ("draft" | "reviewed"), text e reviews.
// Una conferma («reviews») dice: «un madrelingua ha letto QUESTO testo e lo trova corretto». Registra il numero della
// segnalazione pubblica su GitHub, la data e un'impronta (hash) del testo letto: se il testo cambia, le conferme
// vecchie non valgono più e vengono azzerate (scripts/review-badge.mjs) o fanno fallire check.mjs.
// Una lingua passa a "reviewed" con `confirmationsNeeded` conferme indipendenti (segnalazioni diverse) sullo stesso testo,
// oppure se il testo è dell'autore del progetto che è madrelingua ("nativeAuthor").
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BADGES_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'badges.json');

/** Impronta breve del testo (normalizzato), per sapere se una conferma si riferisce al testo attuale. */
export const textHash = (text) => createHash('sha256').update(String(text).normalize('NFC').trim()).digest('hex').slice(0, 8);

export function readBadges() {
  return JSON.parse(readFileSync(BADGES_FILE, 'utf8'));
}

/** Una lingua per riga, per leggere facilmente le differenze. */
export function serializeBadges(data) {
  const line = (l) => `    { ${Object.entries(l).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
  return `{
  "note": ${JSON.stringify(data.note)},
  "confirmationsNeeded": ${data.confirmationsNeeded},
  "languages": [
${data.languages.map(line).join(',\n')}
  ]
}
`;
}

export function writeBadges(data) {
  writeFileSync(BADGES_FILE, serializeBadges(data), 'utf8');
}

/** Conferme valide per il testo attuale di una lingua (stesso testo, segnalazioni diverse). */
export function validReviews(language) {
  const hash = textHash(language.text);
  const seen = new Set();
  return (Array.isArray(language.reviews) ? language.reviews : []).filter((r) => {
    const ok = r && r.verdict === 'ok' && r.textHash === hash && Number.isInteger(r.issue) && !seen.has(r.issue);
    if (ok) seen.add(r.issue);
    return ok;
  });
}
