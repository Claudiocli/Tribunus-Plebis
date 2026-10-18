import { CONFIG } from './config.js';
import { el, externalLink, safeHttpsUrl } from './dom.js';
import { ROOT, getLang, isDraft, setLanguage } from './i18n.js';
import { getRepoUrl } from './repo.js';
import { buildThemeToggle } from './theme.js';

const NAV = [
  { page: 'home', href: '', key: 'nav.home' },
  { page: 'it-sud', href: 'it-sud/', key: 'nav.itsud' },
  { page: 'francia', href: 'francia/', key: 'nav.francia' },
  { page: 'badge', href: 'badge/', key: 'nav.badge' },
];

function i18nSpan(tag, key, attrs = {}) {
  return el(tag, { ...attrs, 'data-i18n': key });
}

function buildHeader() {
  const current = document.body.dataset.page;

  const select = el('select', { id: 'lang-select', class: 'lang-select' });
  for (const { code, name } of CONFIG.languages) {
    select.append(el('option', { value: code, lang: code }, name));
  }
  select.addEventListener('change', () => setLanguage(select.value));
  document.addEventListener('langchange', () => { select.value = getLang(); });

  const nav = el(
    'nav',
    { class: 'site-nav', 'data-i18n-attr': 'aria-label:a11y.mainNav' },
    el(
      'ul',
      {},
      NAV.map(({ page, href, key }) =>
        el('li', {}, i18nSpan('a', key, { href: `${ROOT}${href}`, 'aria-current': page === current ? 'page' : null })),
      ),
    ),
  );

  return el(
    'header',
    { class: 'site-header' },
    el(
      'div',
      { class: 'container header-inner' },
      el('a', { class: 'brand', href: ROOT }, i18nSpan('span', 'site.name', { class: 'brand-name' })),
      nav,
      el(
        'div',
        { class: 'header-tools' },
        el(
          'div',
          { class: 'lang-picker' },
          i18nSpan('label', 'a11y.language', { for: 'lang-select', class: 'visually-hidden' }),
          select,
        ),
        buildThemeToggle(),
      ),
    ),
  );
}

function buildFooter() {
  const draft = i18nSpan('p', 'footer.draft', { class: 'footer-draft', hidden: true });
  document.addEventListener('langchange', () => { draft.hidden = !isDraft(); });

  const repo = safeHttpsUrl(getRepoUrl());
  return el(
    'footer',
    { class: 'site-footer' },
    el(
      'div',
      { class: 'container' },
      i18nSpan('p', 'footer.tagline'),
      i18nSpan('p', 'footer.licenses', { class: 'footer-small' }),
      draft,
      el(
        'p',
        { class: 'footer-links' },
        i18nSpan('a', 'nav.info', { href: `${ROOT}info/` }),
        repo ? externalLink(repo, 'GitHub') : null,
      ),
    ),
  );
}

/** Collega i link che puntano al repository (segnalazioni, proposte): compaiono solo se l'indirizzo del repository è noto. */
export function wireRepoLinks() {
  const repo = safeHttpsUrl(getRepoUrl());
  if (!repo) return;
  for (const link of document.querySelectorAll('a[data-repo-path]')) {
    link.href = `${repo.replace(/\/$/, '')}/${link.dataset.repoPath}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow';
    link.hidden = false;
    link.closest('[data-repo-wrap]')?.removeAttribute('hidden');
  }
}

/** Costruisce intestazione e piè di pagina attorno al <main> già presente nell'HTML. */
export function buildLayout() {
  const skip = i18nSpan('a', 'a11y.skip', { class: 'skip-link', href: '#main' });
  document.body.prepend(skip, buildHeader());
  document.body.append(buildFooter());
  wireRepoLinks();
}
