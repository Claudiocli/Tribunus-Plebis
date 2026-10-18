# Sicurezza

Hai trovato una vulnerabilità o un problema di privacy in questo sito?

**Non aprire una issue pubblica.** Usa la segnalazione privata di GitHub: scheda **Security → Report a vulnerability** di questo repository.

## Perimetro

Il sito è statico: nessun server, nessun database, nessun account, nessun modulo, nessun cookie e nessun dato personale raccolto. Gli unici file pubblicati sono pagine HTML, CSS, JavaScript, traduzioni e dati (notizie e statistiche con fonte).

Le difese principali, controllate automaticamente da `scripts/check.mjs` a ogni pubblicazione:

- Content-Security-Policy rigida in ogni pagina: script e stili solo dal proprio dominio, nessuna richiesta a terzi, nessun `unsafe-inline` né `unsafe-eval`, Trusted Types obbligatori.
- Testo esterno inserito solo con `textContent`, mai con `innerHTML`; link esterni solo `https` con `rel="noopener noreferrer nofollow"`.
- Pagine che non si mostrano se incorniciate in un altro sito.
- Pubblicazione con azioni GitHub bloccate sul commit esatto e permessi minimi.
