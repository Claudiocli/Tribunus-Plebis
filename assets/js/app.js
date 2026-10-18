import { buildLayout } from './layout.js';
import { initI18n } from './i18n.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** Avvio comune a tutte le pagine: layout condiviso, poi lingua e traduzioni. */
export async function start() {
  // GitHub Pages non permette di impostare l'intestazione frame-ancestors: se la pagina è incorniciata
  // dentro un altro sito non mostriamo nulla (difesa di base contro il clickjacking). In locale resta visibile.
  if (window.self !== window.top && !LOCAL_HOSTS.includes(location.hostname)) {
    document.documentElement.hidden = true;
    return;
  }
  buildLayout();
  try {
    await initI18n();
  } catch (error) {
    console.error(error);
    const main = document.getElementById('main');
    if (main) main.textContent = 'Error / Errore / Erreur';
  }
}
