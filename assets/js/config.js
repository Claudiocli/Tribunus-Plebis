// Configurazione del sito. Nessun segreto qui: tutto ciò che sta in questo file è pubblico.
export const CONFIG = {
  // Lingua usata se nessuna preferenza corrisponde a una lingua disponibile.
  fallbackLanguage: 'en',

  // Lingue disponibili. Per aggiungerne una: i18n/<code>.json + una riga qui + `node scripts/build-badges.mjs`.
  languages: [
    { code: 'it', name: 'Italiano' },
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
  ],

  // Indirizzo del repository del progetto (facoltativo, https). Se c'è, compaiono il link nel piè di pagina
  // e il pulsante "Proponi una sezione" nella home.
  repoUrl: '',
};
