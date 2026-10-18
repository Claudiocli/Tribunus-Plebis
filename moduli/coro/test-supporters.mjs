// Test della logica che decide chi compare nel coro. Uso: node scripts/test-supporters.mjs
import assert from 'node:assert/strict';
import { LIMITS, cleanSupporter, isGoogleSheetsUrl, parseCsv, supportersFromCsv, supportersFromJson } from './site/assets/js/supporters-data.js';

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`✓ ${name}`); };
const HEADER = 'nome,paese,anonimo,approved';
const names = (list) => list.map((s) => s.name);

test('parseCsv: virgolette, virgole e a capo dentro i campi', () => {
  const rows = parseCsv('a,b\r\n"x, y","riga1\nriga2"\r\n"dice ""ciao""",z\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'riga1\nriga2'], ['dice "ciao"', 'z']]);
});

test('conta solo le righe con approved = sì (anche "si", "yes", maiuscole)', () => {
  const csv = [HEADER, 'Anna,Italia,no,sì', 'Luc,Francia,no,SI', 'Bob,UK,no,yes', 'Eve,USA,no,no', 'Zed,USA,no,'].join('\n');
  assert.deepEqual(names(supportersFromCsv(csv)), ['Anna', 'Luc', 'Bob']);
});

test('senza la colonna approved non si mostra niente (errore esplicito)', () => {
  assert.throws(() => supportersFromCsv('nome,paese\nAnna,Italia'), /approved/);
});

test('se la scheda pubblicata ha una colonna email, si rifiuta tutto', () => {
  for (const col of ['email', 'Email', 'E-mail', 'indirizzo email', 'mail']) {
    assert.throws(() => supportersFromCsv(`nome,${col},approved\nAnna,a@b.it,sì`), /email/i, col);
  }
});

test('se la scheda pubblicata ha colonne non previste (data, consenso...), si rifiuta tutto', () => {
  for (const extra of ['timestamp', 'Informazioni cronologiche', 'consenso', 'telefono']) {
    assert.throws(() => supportersFromCsv(`nome,paese,anonimo,approved,${extra}\nAnna,Italia,no,sì,x`), /non previste/, extra);
  }
});
test('scarta le righe con indirizzi email, link o markup nel nome o nel paese', () => {
  const csv = [
    HEADER,
    'anna@example.com,Italia,no,sì',
    'Anna,scrivimi a x@y.it,no,sì',
    'Visita www.esempio.it,Italia,no,sì',
    'Vai su https://evil.example,Italia,no,sì',
    '<b>Mario</b>,Italia,no,sì',
    'Ok,Italia,no,sì',
  ].join('\n');
  assert.deepEqual(names(supportersFromCsv(csv)), ['Ok']);
});

test('chi non vuole mostrare il nome conta nel totale ma nome e luogo non arrivano alla pagina', () => {
  const csv = [HEADER, 'Anna,Italia,no,sì', 'Segreto,Calabria,sì,sì', ',Puglia,no,sì'].join('\n');
  const list = supportersFromCsv(csv);
  assert.equal(list.length, 3); // totale
  assert.deepEqual(list.filter((s) => !s.hidden).map((s) => s.name), ['Anna']);
  const hidden = list.filter((s) => s.hidden);
  assert.equal(hidden.length, 2);
  assert.ok(hidden.every((s) => s.name === '' && s.place === ''), 'i dati nascosti non devono restare in memoria');
  assert.ok(!JSON.stringify(list).includes('Segreto') && !JSON.stringify(list).includes('Calabria'));
});

test('limiti di lunghezza per nome e paese', () => {
  assert.equal(cleanSupporter({ name: 'n'.repeat(LIMITS.name) })?.name.length, LIMITS.name);
  assert.equal(cleanSupporter({ name: 'n'.repeat(LIMITS.name + 1) }), null);
  assert.equal(cleanSupporter({ name: 'ok', place: 'p'.repeat(LIMITS.place + 1) }), null);
});

test('neutralizza le formule iniziali (=, +, -, @)', () => {
  assert.equal(cleanSupporter({ name: '=HYPERLINK("x")' }).name, 'HYPERLINK("x")');
  assert.equal(cleanSupporter({ name: '@mario' }).name, 'mario');
  assert.equal(cleanSupporter({ name: '+39 Luca' }).name, '39 Luca');
});

test('anonimo riconosciuto in più forme', () => {
  assert.equal(cleanSupporter({ name: 'a', anonymous: 'Sì' }).hidden, true);
  assert.equal(cleanSupporter({ name: 'a', anonymous: 'yes' }).hidden, true);
  assert.equal(cleanSupporter({ name: 'a', anonymous: 'no' }).hidden, false);
});

test('colonne in qualsiasi ordine e nomi in inglese', () => {
  const csv = 'approved,country,name\nyes,France,Luc';
  assert.deepEqual(supportersFromCsv(csv), [{ name: 'Luc', place: 'France', hidden: false }]);
});

test('supportersFromJson: voci malformate scartate, dati nulli tollerati', () => {
  assert.equal(supportersFromJson({ items: [{ name: 'A' }, { name: 'x'.repeat(99) }, null, 'testo', 42] }).length, 1); // restano solo gli oggetti validi
  assert.deepEqual(supportersFromJson(null), []);
  assert.deepEqual(supportersFromJson({ items: [] }), []);
});

test('isGoogleSheetsUrl accetta solo https://docs.google.com/spreadsheets/', () => {
  assert.equal(isGoogleSheetsUrl('https://docs.google.com/spreadsheets/d/e/ABC/pub?output=csv'), true);
  for (const bad of ['http://docs.google.com/spreadsheets/d/e/ABC', 'https://evil.example/spreadsheets/', 'https://docs.google.com.evil.example/spreadsheets/', 'javascript:alert(1)', '', 'non un url']) {
    assert.equal(isGoogleSheetsUrl(bad), false, bad);
  }
});

console.log(`\n${passed} test superati.`);
