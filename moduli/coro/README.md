# Modulo «Il coro» (archiviato, NON attivo)

Questa cartella contiene una funzione messa da parte: una pagina **«Il coro»** con l'elenco dei nomi di chi aderisce (nome di battesimo o soprannome + paese, nessun commento) e la pagina **«Partecipa»** con il link a un modulo Google. Funziona e ha i suoi test, ma **non fa parte del sito pubblicato**: il workflow non la copia e nessuna pagina la richiama.

## Perché è spenta

Il sito pubblicato **non raccoglie dati personali**, e per questo non ha bisogno di informative complesse, consensi o procedure di rimozione. Questo modulo è l'unica parte che raccoglierebbe e pubblicherebbe **nomi di persone**, e un elenco di chi sostiene una protesta può rivelare un'opinione (dato che il GDPR tratta con più attenzione, art. 9). Riattivarlo significa assumersi quei doveri: informativa, consenso esplicito, moderazione, richieste di cancellazione, e una revisione legale consigliata.

## Cosa c'è

| Percorso | Contenuto |
|---|---|
| `site/coro/`, `site/partecipa/` | Le due pagine |
| `site/assets/js/` | `coro.js`, `partecipa.js`, `supporters-data.js` (lettura e filtro dei nomi) |
| `site/data/supporters.json` | Elenco manuale di riserva (vuoto) |
| `i18n/` | Testi it/en/fr del modulo, da unire a quelli del sito |
| `legale-con-coro.html` | Pagina legale con le sezioni sui nomi (da rivedere) |
| `setup-coro.md` | Come configurare modulo e foglio Google, senza raccogliere email |
| `test-supporters.mjs` | Test del filtro (`node moduli/coro/test-supporters.mjs`) |

Il filtro è prudente: mostra solo le righe con `approved = sì`, scarta nomi con email, link o markup, **rifiuta tutto se il CSV ha colonne non previste** (segno che è stata pubblicata la scheda sbagliata), e chi sceglie di non mostrare il nome viene solo contato.

## Per riattivarlo

Non è un semplice copia-incolla: bisogna riportare le pagine e gli script nel sito, unire le traduzioni, aggiungere le voci di menu, **aprire nel CSP un'eccezione per Google solo sulla pagina del coro** (oggi il sito non fa richieste a terzi, ed è una delle sue difese) e riscrivere la pagina legale. Se vuoi farlo, chiedilo e lo rifacciamo insieme, con la configurazione e i controlli aggiornati.
