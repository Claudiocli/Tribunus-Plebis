# Traduzioni

Le stringhe del sito stanno in `i18n/<lingua>.json`. **Nessuna traduzione automatica a runtime**: i testi sono scritti da persone e rivisti da madrelingua. Il testo di riferimento è l'italiano.

## Stato delle lingue

| Lingua | File | Stato | Note |
|---|---|---|---|
| Italiano | `it.json` | **riviste** | Scritto dal promotore (madrelingua). Testo di riferimento. |
| English | `en.json` | **bozza** | Scritta con l'assistenza di un modello linguistico, **non ancora rivista** da un madrelingua. |
| Français | `fr.json` | **bozza** | Come sopra. |

Il campo `meta.status` di ogni file (`reviewed` o `draft`) è letto dal sito: quando una lingua è in bozza, il piè di pagina lo dice ai visitatori. Quando un madrelingua ha riletto tutto, cambia `draft` in `reviewed` e aggiorna questa tabella.

La pagina **Info** (`info/index.html`) è tradotta in tutte le lingue (testi in `info.body` di ogni file); le traduzioni non sono state riviste da un legale.

## Aggiungere una lingua

1. Copia `it.json` in `<codice>.json` (codice ISO a due lettere, minuscolo) e traduci **tutti** i valori. Imposta `meta.name` (nome nella lingua stessa), `meta.dir` (`ltr` o `rtl`: arabo ed ebraico sono `rtl`) e `meta.status: "draft"`.
2. Aggiungi la lingua a `languages` in [assets/js/config.js](../assets/js/config.js), con lo stesso nome di `meta.name`.
3. `node scripts/build-badges.mjs` per generare `badges/badge-<codice>.svg`.
4. `node scripts/check.mjs`: controlla che non manchi nessuna chiave e che i segnaposto `{nome}` coincidano.
5. Apri una pull request e chiedi a un madrelingua di rivedere.

Ordine di scelta della lingua: parametro `?lang=` nell'indirizzo, poi la preferenza salvata, poi le lingue del browser, infine l'inglese. (Il parametro `?lang=` ha la precedenza sulla preferenza salvata perché un link condiviso con `?lang=fr` deve aprirsi in francese.)

## Bozze del testo del badge per le prossime lingue

Da far rivedere a un madrelingua **prima** di usarle (chiave `badge.text`). Il generatore dei badge le ha già provate: stanno tutte nel formato 320×40, arabo compreso (testo da destra a sinistra, icona a destra).

| Lingua | Testo (bozza) |
|---|---|
| es | Soy humano y estoy con mis hermanos |
| de | Ich bin ein Mensch und stehe zu meinen Geschwistern |
| pt | Sou humano e estou com os meus irmãos |
| uk | Я людина, і я з моїми братами і сестрами |
| ru | Я человек, и я с моими братьями и сестрами |
| ja | 私は人間であり、兄弟姉妹とともにいます |
| zh | 我是人类，我与我的兄弟姐妹同在 |
| ar | أنا إنسان، وأقف مع إخوتي وأخواتي |
