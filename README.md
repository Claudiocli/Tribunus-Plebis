# Tribunus Plebis

Un sito statico, gratuito, non violento e non partitico, dove le persone di ogni paese possono farsi sentire con fatti verificabili e rispetto reciproco.

> Siamo tutti fratelli e sorelle, da New York a Kiev, da Mosca a Tokyo, da Roma a Sydney.

**Semplice per scelta**: nessun server, nessun database, nessun account, nessun modulo, nessun cookie, **nessun dato personale raccolto**. Per questo il sito non ha bisogno di informative complesse né di consensi.

## Cosa contiene

| Pagina | Percorso | Cosa fa |
|---|---|---|
| Home | `/` | Manifesto, principi, pulsanti «Prendi il tuo badge» e «Condividi» |
| Italia – Sud | `/it-sud/` | Notizie, richieste e dati (da `data/news.json` e `data/stats.json`), sempre con data, fonte e link |
| Badge | `/badge/` | Il badge «Io sono un umano…» in più lingue, con codice Markdown e HTML da copiare. **Cliccandolo si arriva a questo sito** (vedi sotto) |
| Informazioni legali | `/legale/` | Contatti, valore del manifesto, privacy, correzioni |

Lingue: italiano, inglese, francese (le ultime due sono bozze, vedi [i18n/README.md](i18n/README.md)). Layout pronto per l'arabo e l'ebraico (da destra a sinistra). Quando il link viene condiviso su WhatsApp, Telegram o i social compare un'anteprima con immagine.

## Principi non negoziabili

- **Non violento**: nessun contenuto che inciti, giustifichi o celebri violenza. Si condanna la violenza, mai un popolo o una nazionalità.
- **Non partitico**: nessun simbolo di partito, nessun attacco a persone identificabili.
- **Fatti prima degli slogan**: ogni dato ha fonte, data e link; le cifre di parte sono attribuite; ogni voce ha un `verified` che dice se è stata confrontata con la fonte.
- **Nessuna falsa equivalenza** sui conflitti armati: solo fonti verificabili.
- **Nessun pagamento** e nessuna raccolta di dati.

## Anteprima in locale

Serve Node.js 18 o più recente (nessuna dipendenza da installare).

```bash
node scripts/serve.mjs          # http://localhost:8080/
```

Le pagine caricano file con `fetch()`, quindi **non** si aprono con doppio clic da `file://`.

## Controlli

```bash
node scripts/check.mjs            # traduzioni, CSP, link (maiuscole incluse), badge, dati, sicurezza del codice
node scripts/check.mjs --strict   # come sopra, ma blocca anche se resta "DA COMPILARE" (lo usa la pubblicazione)
node scripts/build-badges.mjs     # rigenera i badge dopo aver cambiato un badge.text
```

`check.mjs` blocca, tra l'altro: chiavi di traduzione mancanti; `innerHTML`/`eval`; script o stili inline; **un CSP diverso da quello approvato**; link rotti, assoluti o con maiuscole sbagliate (GitHub Pages le distingue, Windows no); badge non aggiornati; voci di dati malformate; email scritte nell'HTML, nei dati o nelle traduzioni; file `.csv`, `.env` o chiavi nel repository.

## Come si modifica

- **Testi**: `i18n/<lingua>.json`. Nell'HTML non ci sono testi, solo `data-i18n="chiave"`.
- **Notizie e dati**: `data/news.json` (`category`: `news` o `request`) e `data/stats.json` (`category: "stat"`, con `group`, `value`, `period`, `original_body`). Ogni voce vuole `id`, `date` (AAAA-MM-GG), `title`, `source`, `url` (https) e `verified`. Riassumi **con parole tue**. Metti `verified: true` solo dopo aver confrontato la voce con la fonte; se la cifra è di parte, scrivilo in `attribution`.
- **Nuova lingua**: vedi [i18n/README.md](i18n/README.md).
- **Nuova sezione per un paese**: copia `it-sud/`, il suo script e i dati, e aggiungi una voce in `assets/js/layout.js`.
- **Immagine di anteprima social**: sorgente in `docs/social-card.svg`, risultato in `assets/img/social.png`.

## Il badge e il clic

Un'immagine incorporata in una pagina (`<img>`, come nel README di GitHub) non può avere un link suo: per questo la pagina `/badge/` dà il codice che **avvolge il badge in un link verso il sito**. Incollato così com'è nel README del profilo o in un sito, chi clicca il badge arriva qui.

In più il file SVG contiene lui stesso il link: se qualcuno lo apre da solo (per esempio dall'indirizzo `…/badges/badge-it.svg`) e lo clicca, arriva al sito. L'indirizzo vero viene scritto alla pubblicazione (segnaposto `__SITE_URL__`) e, in anteprima locale, dal server di prova.

## Pubblicare su GitHub Pages

1. Compila l'email di contatto in `legale/index.html` (i campi gialli «DA COMPILARE»): senza, la pubblicazione automatica si ferma.
2. Crea un repository **pubblico** su GitHub e caricaci questi file.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**, e attiva «Enforce HTTPS».
4. Ogni push su `main` esegue [.github/workflows/pages.yml](.github/workflows/pages.yml): lancia `check.mjs --strict` e, se passa, pubblica **solo** il sito (non `scripts/`, `docs/`, `moduli/`, `.github/`). L'indirizzo vero del sito entra nelle anteprime social al momento della pubblicazione.
5. Il sito sarà su `https://<utente>.github.io/<repo>/`. I percorsi sono relativi: funziona anche sotto il nome del repository e su un dominio personalizzato.
6. Sicurezza dell'account: **autenticazione a due fattori** su GitHub. Facoltativo ma consigliato: in Settings → Branches proteggi `main` e in Settings → Security attiva la segnalazione privata di vulnerabilità e la scansione dei segreti.

## Prima di pubblicare

- [ ] Email di contatto in `legale/index.html`.
- [ ] Inglese e francese riletti da dei madrelingua (sono bozze, e il sito lo dichiara).
- [ ] Le 2 voci con `verified: false` in `data/stats.json` ricontrollate o tolte.
- [ ] Conferma della licenza dei contenuti ([CONTENT-LICENSE.md](CONTENT-LICENSE.md)).
- [ ] Dopo ogni aggiornamento delle notizie: riconfronta con le fonti prima di mettere `verified: true`.

## Sicurezza

- Content-Security-Policy rigida in ogni pagina: script, stili e immagini solo dal proprio dominio, **nessuna richiesta a terzi**, nessun `unsafe-inline` né `unsafe-eval`, Trusted Types obbligatori.
- Testo esterno inserito solo con `textContent` (mai `innerHTML`); link esterni solo `https` con `rel="noopener noreferrer nofollow"`.
- Le pagine non si mostrano se incorniciate in un altro sito (GitHub Pages non permette di impostare `frame-ancestors`).
- Pubblicazione con azioni GitHub bloccate sul commit esatto, permessi minimi e Dependabot per gli aggiornamenti.
- Vedi [SECURITY.md](SECURITY.md) per segnalare un problema.

Cosa **non** è garantito: nessun controllo automatico può dire se un'informazione è vera o se un testo è a norma di legge. Il sito racconta fatti con fonte, ma chi lo gestisce resta responsabile di ciò che pubblica.

## Funzioni messe da parte

[moduli/coro/](moduli/coro/) contiene la pagina «Il coro» (elenco dei nomi di chi aderisce) con il suo modulo. È **spenta** perché raccoglierebbe dati personali: il suo README spiega perché e cosa servirebbe per riattivarla.

## Licenze

Codice: [MIT](LICENSE). Testi e grafiche: CC BY-SA 4.0, **da confermare** ([CONTENT-LICENSE.md](CONTENT-LICENSE.md)).
