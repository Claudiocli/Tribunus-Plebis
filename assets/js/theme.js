import { el } from './dom.js';
import { t } from './i18n.js';

const KEY = 'theme';
const SVG_NS = 'http://www.w3.org/2000/svg';
const root = document.documentElement;

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

const ICONS = {
  moon: () => [svgNode('path', { d: 'M21 14.5A9 9 0 0 1 9.5 3a9 9 0 1 0 11.5 11.5z', fill: 'currentColor' })],
  sun: () => [
    svgNode('circle', { cx: 12, cy: 12, r: 4.5, fill: 'currentColor' }),
    svgNode('path', { d: 'M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
  ],
};

/** Tema in uso: quello scelto con il pulsante, altrimenti quello del sistema. */
export function currentTheme() {
  const chosen = root.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Pulsante per passare dal tema chiaro a quello scuro e viceversa. Mostra l'icona del tema a cui si passerebbe. */
export function buildThemeToggle() {
  const button = el('button', { type: 'button', class: 'theme-toggle' });

  const render = () => {
    const dark = currentTheme() === 'dark';
    const label = t(dark ? 'theme.toLight' : 'theme.toDark');
    button.setAttribute('aria-label', label);
    button.title = label;
    const icon = svgNode('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    icon.append(...(dark ? ICONS.sun() : ICONS.moon()));
    button.replaceChildren(icon);
  };

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* memoria non disponibile: la scelta vale solo per questa pagina */ }
    render();
  });
  document.addEventListener('langchange', render);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  render();
  return button;
}
