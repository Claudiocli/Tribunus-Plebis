import { ROOT, t } from './i18n.js';

/** Indirizzo della home del sito, senza parametri: il ?lang= di chi condivide non va passato agli altri. */
function siteUrl() {
  const url = new URL(ROOT, location.href);
  url.search = '';
  url.hash = '';
  return url.href;
}

/** Pulsante "Condividi": foglio di condivisione del dispositivo se c'è, altrimenti copia l'indirizzo. Nessun dato lascia il browser. */
export function setupShare(button, status) {
  button.addEventListener('click', async () => {
    const url = siteUrl();
    status.textContent = '';
    if (navigator.share) {
      try {
        await navigator.share({ title: t('site.name'), text: t('share.text'), url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // l'utente ha chiuso il foglio di condivisione
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = t('share.copied');
    } catch {
      status.textContent = t('share.copyFail');
    }
  });
}
