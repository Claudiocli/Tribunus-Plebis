// Mini parser per il sottoinsieme di YAML usato nei moduli delle issue di GitHub (.github/ISSUE_TEMPLATE/*.yml).
// Serve solo a controllare i moduli in locale, senza dipendenze. Supporta: mappe, liste, stringhe (semplici, "doppie",
// 'singole'), booleani, liste inline ["a", "b"], blocchi di testo (| e >), commenti a riga intera.
// Rifiuta ciò che in YAML è ambiguo o facile da sbagliare: tabulazioni, indentazione incoerente, chiavi doppie,
// testo semplice che contiene ": " (va messo tra virgolette), virgolette non chiuse.

class YamlError extends Error {
  constructor(line, message) { super(`riga ${line}: ${message}`); this.line = line; }
}

function parseScalar(text, line) {
  let s = text.trim();
  if (s.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)"\s*(#.*)?$/.exec(s);
    if (!m) throw new YamlError(line, 'virgolette doppie non chiuse o testo dopo le virgolette');
    try { return JSON.parse(`"${m[1]}"`); } catch { throw new YamlError(line, 'sequenza di escape non valida tra virgolette doppie'); }
  }
  if (s.startsWith("'")) {
    const m = /^'((?:[^']|'')*)'\s*(#.*)?$/.exec(s);
    if (!m) throw new YamlError(line, 'apici non chiusi o testo dopo gli apici');
    return m[1].replaceAll("''", "'");
  }
  if (s.startsWith('[')) {
    const m = /^\[(.*)\]\s*(#.*)?$/.exec(s);
    if (!m) throw new YamlError(line, 'lista inline non chiusa');
    const inner = m[1].trim();
    if (!inner) return [];
    const parts = [];
    let current = ''; let quote = null;
    for (const ch of inner) {
      if (quote) { current += ch; if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") { quote = ch; current += ch; }
      else if (ch === ',') { parts.push(current); current = ''; }
      else current += ch;
    }
    if (quote) throw new YamlError(line, 'virgolette non chiuse nella lista inline');
    parts.push(current);
    return parts.map((p) => parseScalar(p, line));
  }
  if (s.startsWith('{')) throw new YamlError(line, 'le mappe inline { } non sono ammesse: usa lo stile a blocchi');
  s = s.replace(/\s+#.*$/, '');
  if (/^[@`%&*!|>]/.test(s)) throw new YamlError(line, `il testo non può iniziare con "${s[0]}" senza virgolette`);
  if (/: |:$/.test(s)) throw new YamlError(line, 'il testo semplice contiene ": ": mettilo tra virgolette');
  if (s === 'true' || s === 'false') return s === 'true';
  if (s === 'null' || s === '~' || s === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

export function parseYaml(text) {
  const lines = text.split(/\r?\n/).map((raw, i) => {
    if (/^\s*\t/.test(raw)) throw new YamlError(i + 1, 'tabulazioni non ammesse nell\'indentazione');
    return { indent: raw.length - raw.trimStart().length, body: raw.trim(), n: i + 1, raw };
  });
  let p = 0;
  const skip = () => { while (p < lines.length && (lines[p].body === '' || lines[p].body.startsWith('#'))) p += 1; };

  function blockScalar(parentIndent, style) {
    const collected = [];
    let base = null;
    while (p < lines.length) {
      const l = lines[p];
      if (l.body === '') { collected.push(''); p += 1; continue; }
      if (l.indent <= parentIndent) break;
      if (base === null) base = l.indent;
      if (l.indent < base) throw new YamlError(l.n, 'indentazione incoerente nel blocco di testo');
      collected.push(l.raw.slice(base));
      p += 1;
    }
    while (collected.length && collected[collected.length - 1] === '') collected.pop();
    const keepNewlines = style.startsWith('|');
    return keepNewlines ? `${collected.join('\n')}\n` : `${collected.join(' ').replace(/ +/g, ' ')}\n`;
  }

  function parseBlock(indent) {
    skip();
    if (p >= lines.length || lines[p].indent !== indent) throw new YamlError(lines[Math.min(p, lines.length - 1)]?.n ?? 1, `indentazione inattesa (attesi ${indent} spazi)`);
    return lines[p].body === '-' || lines[p].body.startsWith('- ') ? parseSequence(indent) : parseMapping(indent);
  }

  function parseSequence(indent) {
    const list = [];
    for (;;) {
      skip();
      if (p >= lines.length || lines[p].indent !== indent || !(lines[p].body === '-' || lines[p].body.startsWith('- '))) break;
      const l = lines[p];
      const rest = l.body.slice(1).trimStart();
      const col = indent + (l.body.length - rest.length);
      if (rest === '') {
        p += 1; skip();
        if (p >= lines.length || lines[p].indent <= indent) throw new YamlError(l.n, 'elemento di lista vuoto');
        list.push(parseBlock(lines[p].indent));
      } else if (/^[A-Za-z_][\w-]*:( |$)/.test(rest)) {
        lines[p] = { indent: col, body: rest, n: l.n, raw: ' '.repeat(col) + rest };
        list.push(parseMapping(col));
      } else {
        list.push(parseScalar(rest, l.n));
        p += 1;
      }
    }
    return list;
  }

  function parseMapping(indent) {
    const map = {};
    for (;;) {
      skip();
      if (p >= lines.length || lines[p].indent !== indent) break;
      const l = lines[p];
      if (l.body === '-' || l.body.startsWith('- ')) break;
      const m = /^([A-Za-z_][\w-]*):(?: +(.*))?$/.exec(l.body);
      if (!m) throw new YamlError(l.n, `atteso "chiave: valore", trovato: ${l.body.slice(0, 50)}`);
      const [, key, value = ''] = m;
      if (key in map) throw new YamlError(l.n, `chiave doppia: ${key}`);
      p += 1;
      if (value === '' || value.startsWith('#')) {
        skip();
        if (p < lines.length && lines[p].indent > indent) map[key] = parseBlock(lines[p].indent);
        else if (p < lines.length && lines[p].indent === indent && lines[p].body.startsWith('- ')) map[key] = parseSequence(indent);
        else map[key] = null;
      } else if (/^[|>][+-]?\s*(#.*)?$/.test(value)) {
        map[key] = blockScalar(indent, value);
      } else {
        map[key] = parseScalar(value, l.n);
      }
    }
    return map;
  }

  skip();
  if (p >= lines.length) return null;
  const result = parseBlock(lines[p].indent);
  skip();
  if (p < lines.length) throw new YamlError(lines[p].n, `contenuto non previsto o indentazione sbagliata: ${lines[p].body.slice(0, 50)}`);
  return result;
}

const BODY_TYPES = ['markdown', 'textarea', 'input', 'dropdown', 'checkboxes'];

/** Controlla un modulo issue di GitHub contro le regole documentate. Restituisce un elenco di errori (vuoto = ok). */
export function validateIssueForm(doc) {
  const errors = [];
  const isStr = (v) => typeof v === 'string' && v.trim() !== '';
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['il file non è una mappa'];
  if (!isStr(doc.name)) errors.push('manca "name"');
  if (!isStr(doc.description)) errors.push('manca "description"');
  if (doc.title !== undefined && typeof doc.title !== 'string') errors.push('"title" deve essere testo');
  if (doc.labels !== undefined && !(Array.isArray(doc.labels) && doc.labels.every(isStr))) errors.push('"labels" deve essere una lista di testi');
  if (!Array.isArray(doc.body) || doc.body.length === 0) { errors.push('"body" deve essere una lista non vuota'); return errors; }
  const ids = new Set();
  let interactive = 0;
  doc.body.forEach((item, i) => {
    const at = `body[${i}]`;
    if (!item || typeof item !== 'object') { errors.push(`${at}: non è una mappa`); return; }
    if (!BODY_TYPES.includes(item.type)) { errors.push(`${at}: type "${item.type}" non valido (ammessi: ${BODY_TYPES.join(', ')})`); return; }
    const a = item.attributes;
    if (!a || typeof a !== 'object') { errors.push(`${at}: mancano gli "attributes"`); return; }
    if (item.type !== 'markdown') interactive += 1;
    if (item.id !== undefined) {
      if (!/^[A-Za-z0-9_-]+$/.test(String(item.id))) errors.push(`${at}: id "${item.id}" non valido`);
      if (ids.has(item.id)) errors.push(`${at}: id "${item.id}" duplicato`);
      ids.add(item.id);
    }
    if (item.type === 'markdown' && !isStr(a.value)) errors.push(`${at}: markdown senza "value"`);
    if (item.type !== 'markdown' && !isStr(a.label)) errors.push(`${at}: manca "label"`);
    if (item.type === 'dropdown') {
      if (!Array.isArray(a.options) || a.options.length === 0 || !a.options.every(isStr)) errors.push(`${at}: dropdown senza "options" valide`);
      else if (new Set(a.options).size !== a.options.length) errors.push(`${at}: opzioni duplicate`);
    }
    if (item.type === 'checkboxes') {
      if (!Array.isArray(a.options) || a.options.length === 0) errors.push(`${at}: checkboxes senza "options"`);
      else a.options.forEach((o, j) => {
        if (!o || !isStr(o.label)) errors.push(`${at}.options[${j}]: manca "label"`);
        if (o && o.required !== undefined && typeof o.required !== 'boolean') errors.push(`${at}.options[${j}]: "required" deve essere true/false`);
      });
    }
    if (item.validations !== undefined && (typeof item.validations !== 'object' || (item.validations.required !== undefined && typeof item.validations.required !== 'boolean'))) {
      errors.push(`${at}: "validations.required" deve essere true/false`);
    }
    if (item.type === 'markdown' && item.validations) errors.push(`${at}: markdown non accetta "validations"`);
  });
  if (interactive === 0) errors.push('serve almeno un campo che non sia solo markdown');
  return errors;
}
