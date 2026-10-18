import { CONFIG } from './config.js';
import { start } from './app.js';
import { clear, el, externalLink, safeHttpsUrl } from './dom.js';
import { t } from './i18n.js';

function renderForm() {
  const slot = document.getElementById('form-slot');
  clear(slot);
  const url = safeHttpsUrl(CONFIG.formUrl);
  if (!url) {
    slot.append(el('p', { class: 'notice' }, t('participate.formSoon')));
    return;
  }
  const link = externalLink(url, t('participate.formCta'), t('a11y.newTab'));
  link.classList.add('button');
  slot.append(el('p', {}, link), el('p', { class: 'muted' }, t('participate.formNote')));
}

document.addEventListener('langchange', renderForm);
await start();
