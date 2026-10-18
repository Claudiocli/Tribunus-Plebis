import { CONFIG } from './config.js';

/**
 * Ricava il repository GitHub da un sito GitHub Pages: https://<utente>.github.io/<repo>/ → https://github.com/<utente>/<repo>.
 * `rootPathname` è il percorso della radice del sito ("/" per un sito utente, "/<repo>/" per un sito di progetto).
 * Con un dominio personalizzato non si può ricavare: serve `repoUrl` in config.js. Funzione pura, provata da check.mjs.
 */
export function deriveRepoUrl(hostname, rootPathname) {
  const host = /^([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)\.github\.io$/i.exec(hostname);
  if (!host) return '';
  const repo = rootPathname.split('/').filter(Boolean)[0] ?? `${host[1]}.github.io`;
  return /^[A-Za-z0-9._-]{1,100}$/.test(repo) ? `https://github.com/${host[1]}/${repo}` : '';
}

/** Indirizzo del repository: quello in config.js, altrimenti quello ricavato da GitHub Pages, altrimenti stringa vuota. */
export function getRepoUrl() {
  if (CONFIG.repoUrl) return CONFIG.repoUrl;
  const root = document.documentElement.dataset.root || './';
  return deriveRepoUrl(location.hostname, new URL(root, location.href).pathname);
}
