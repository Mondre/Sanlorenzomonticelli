# Collaudo del portale

## Eseguito nell’ambiente di sviluppo

- TypeScript/Astro, build Netlify e test dei percorsi pubblici.
- Autenticazione e revoca permessi con Better Auth e PostgreSQL PGlite temporaneo.
- CRUD, limiti di categoria, conflitti e visibilità delle bozze.
- Pipeline reale Sharp: decodifica, dimensioni, orientamento e rimozione dei metadati.
- Collegamento copertine/sponsor, preview autorizzata, pubblicazione, revoca e rimozione in storage in memoria.
- Backup cifrato, autenticità, immagini incluse e rifiuto dei file alterati.
- Recupero del database PostgreSQL 18 in un contenitore separato, con confronto dei dati e dei permessi.

Queste prove non attestano automaticamente l’accesso al Neon e allo storage del sito reale.

## Da eseguire sul sito pubblicato

1. Attendere lo stato **Published** del deploy Netlify e accedere come amministratore.
2. Nella dashboard premere **Verifica database e immagini**. Entrambi devono mostrare **OK**.
3. Caricare nella Libreria immagini un logo o una foto autorizzata; creare una notizia in bozza e sceglierla come copertina. Da una finestra senza login la bozza e il file scollegato non devono essere visibili.
4. Pubblicare la notizia di collaudo, aprirla senza login e controllare copertina, testo alternativo e visualizzazione da telefono. Revocare l’immagine nella libreria: la copertina deve sparire nelle letture successive. Ripristinare il consenso solo se appropriato. Alla fine rimuovere i contenuti e i file di collaudo.
5. Provare lo stesso file come logo di uno sponsor; controllare attivazione e disattivazione. L’eliminazione di un file usato deve essere impedita.
6. Creare una partita di collaudo, verificare data/campo/risultato e importare il file ICS nell’app calendario. Eliminare o correggere il contenuto di prova al termine. Non usarlo come dato societario reale.
7. Con un collaboratore di categoria verificare che gli altri contenuti e la Libreria immagini siano inaccessibili. La creazione di utenti richiede il trigger della migrazione 0004: controllare eventuali indicazioni nel pannello.
8. Provare menu, tema, moduli e pulsanti su telefono e con tastiera. Verificare che i messaggi d’errore siano comprensibili e che non ci siano scorrimenti orizzontali imprevisti.
9. Tenere disattivata la raccolta delle richieste finché la società non fornisce l’informativa definitiva. L’invio reale del modulo va collaudato dopo quella configurazione, senza usare dati personali di terzi per le prove.
10. Eseguire il primo backup del database reale da un terminale sicuro e provarne il ripristino in un database vuoto separato, secondo `docs/operations.md`. Non sostituire direttamente la produzione.

## Controlli HTTP pubblici ripetibili

```sh
npm run smoke:live
```

Il comando controlla pagine, API pubbliche e rifiuto degli accessi amministrativi anonimi, senza scrivere dati né inviare credenziali. Non stampa i corpi delle risposte. Per un diverso dominio si può passare soltanto l’origine HTTPS pubblica:

```sh
npm run smoke:live -- https://dominio-della-societa.example
```

Questo ambiente cloud deve avere accesso di rete al dominio del sito. La configurazione attiva al momento dello sviluppo non autorizzava `sanlorenzomonticelli.netlify.app`; è stata preparata una bozza con il dominio aggiunto. Finché non viene applicata, il collaudo remoto resta da completare. Anche con accesso pubblico disponibile, i salvataggi autenticati richiedono una sessione amministrativa; non condividere password o cookie in chat.

## Fuori da questo collaudo

Romagna Sport risponde HTTP 403 alle richieste da Netlify: le verifiche di immagini, calendario locale e backup non dipendono da quella fonte. Non dichiarare riuscita l’importazione automatica finché la fonte non consente effettivamente il collegamento.
