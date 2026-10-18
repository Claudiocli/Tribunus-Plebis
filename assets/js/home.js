import { start } from './app.js';
import { el } from './dom.js';
import { tList } from './i18n.js';
import { setupShare } from './share.js';

function renderPrinciples() {
  const list = document.getElementById('principles');
  list.replaceChildren(
    ...tList('home.manifesto.principles').map((p) =>
      el('li', { class: 'principle' }, el('h3', {}, p.title), el('p', {}, p.text)),
    ),
  );
}

document.addEventListener('langchange', renderPrinciples);
setupShare(document.getElementById('share-button'), document.getElementById('share-status'));
await start();
