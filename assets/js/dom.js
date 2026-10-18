// Helper DOM sicuri. Il testo entra SOLO come nodo di testo (mai innerHTML).

/** Restituisce l'URL normalizzato se è https, altrimenti null. */
export function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Crea un elemento. Gli attributi `on*` e `style` sono rifiutati (CSP). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') || key === 'style') continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Link esterno sicuro: solo https, con rel noopener noreferrer nofollow.
 * Se l'URL non è https restituisce un semplice <span> con il testo, senza link.
 */
export function externalLink(url, text, newTabHint = '') {
  const href = safeHttpsUrl(url);
  if (!href) return el('span', {}, text);
  const link = el('a', { href, target: '_blank', rel: 'noopener noreferrer nofollow' }, text);
  if (newTabHint) link.append(el('span', { class: 'visually-hidden' }, ` ${newTabHint}`));
  return link;
}

/** Svuota un nodo. */
export function clear(node) {
  while (node.firstChild) node.firstChild.remove();
}
