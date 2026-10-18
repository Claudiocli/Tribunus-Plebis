// Applica subito il tema scelto con il pulsante (prima del primo disegno della pagina), per evitare il lampo di colore.
// Script classico e minuscolo, caricato nell'<head>: gli script inline sono vietati dal CSP.
try {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
} catch {
  /* memoria del browser non disponibile: si resta sul tema del sistema */
}
