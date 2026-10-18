# Come configurare «Il coro» (modulo Google + foglio), senza raccogliere email

> Modulo **archiviato**: leggi prima [README.md](README.md). Questi passaggi servono solo se decidi di riattivarlo.

Il principio di sicurezza: **il modulo non chiede l'email** e raccoglie il minimo (un nome, un paese, un consenso). Meno dati hai, meno ne puoi perdere.

## 1. Il modulo (forms.google.com)

Campi, **in quest'ordine** (l'ordine determina le colonne del foglio):

| Campo | Tipo | Note |
|---|---|---|
| Nome da mostrare | Risposta breve, obbligatoria | Lunghezza massima 40. Guida: «Il tuo nome di battesimo o un soprannome. Mai il nome di un'altra persona.» |
| Paese o regione | Menu a tendina, obbligatorio | |
| Non mostrare il mio nome (conta solo nel totale) | Caselle di controllo, una sola opzione «Sì» | |
| Consenso | Caselle di controllo, obbligatoria | Copia **parola per parola** `participate.consent` da `i18n/it.json` di questa cartella: è il consenso esplicito. |

Impostazioni: **nessuna raccolta di indirizzi email**, «Consenti modifica risposte» disattivato, nessun limite «una risposta» (richiede l'accesso con Google).

## 2. Il foglio e la scheda pubblica

1. Dalla scheda **Risposte** collega un foglio. La scheda «Risposte del modulo 1» ha le colonne **A** Informazioni cronologiche, **B** Nome, **C** Paese, **D** Non mostrare il nome, **E** Consenso.
2. Aggiungi a mano **F1 = `approved`**. Resta vuota finché non approvi.
3. Crea una scheda «Pubblico». In A1:D1 scrivi: `nome`, `paese`, `anonimo`, `approved`. In A2:

   ```
   =QUERY('Risposte del modulo 1'!A2:F; "select B, C, D, F where F = 'sì'"; 0)
   ```

   (con le impostazioni del foglio in inglese usa la virgola al posto del punto e virgola).

## 3. Pubblicare solo la scheda «Pubblico»

File → Condividi → **Pubblica sul web** → scheda **«Pubblico»** (non «Intero documento») → **CSV**. Apri il link in una finestra anonima: devono esserci **solo** le colonne `nome, paese, anonimo, approved`. Il sito rifiuta qualunque CSV con colonne diverse, ma i dati sarebbero comunque pubblici all'indirizzo: se vedi altro, annulla la pubblicazione.

## 4. Moderazione e rimozione

- Scrivi `sì` in colonna F solo se il nome è plausibile (di battesimo o soprannome, **non** di un'altra persona, **non** slogan, insulti, link o simboli di partito) e il consenso è spuntato.
- Il sito toglie da solo email, link, markup e nomi troppo lunghi, ma **non può sapere se un nome appartiene a una persona che non ha aderito**: lo decidi tu.
- Senza email non puoi ricontattare chi aderisce: chi vuole la rimozione ti scrive all'indirizzo di contatto indicato nella pagina legale; cerca il nome e cancella il `sì`.

## 5. Sicurezza e limiti

- Autenticazione a due fattori su Google e GitHub; non condividere il foglio; non pubblicare mai la scheda con le risposte grezze.
- Google Forms non ha captcha né verifica l'identità: chiunque può inviare il nome di un altro. La difesa è la moderazione manuale.
- Con molte adesioni la moderazione a mano diventa un lavoro.
