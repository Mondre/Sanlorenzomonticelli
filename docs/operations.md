# Gestione immagini e recupero del portale

## Immagini dal pannello

Dopo il deploy Netlify, accedere come amministratore e aprire **Libreria immagini**. Caricare un JPG, PNG, WebP o AVIF statico fino a 3 MB / 24 megapixel, indicare una descrizione e confermare i diritti di pubblicazione. I file sono convertiti in WebP, orientati correttamente, ridotti entro 2048×2048 e privati dei metadati; il file risultante non supera 2 MB. Sono rifiutati SVG, immagini animate e dati non decodificabili. I caricamenti sono riservati ad amministratori e super amministratori.

La libreria usa Netlify Blobs, store `club-media`, con il contesto backend fornito automaticamente dalle Functions Netlify v2. Non occorre inserire un token nel browser o aprire un nuovo account. La disponibilità e i consumi dello storage dipendono dal piano del sito Netlify: controllarli nel pannello del provider. Il portale limita la libreria a 500 immagini. Native `sharp` è dichiarato esterno al bundle delle Functions in `netlify.toml`.

Nelle **Notizie**, scegliere il file come copertina; negli **Sponsor**, sceglierlo come logo. Redattori e responsabili possono selezionare le copertine autorizzate nelle categorie loro assegnate; i caricamenti e la gestione della libreria restano amministrativi. Le foto compaiono nelle card, nella home e negli articoli, i loghi nelle schede sponsor.

Un file caricato non diventa automaticamente pubblico: `/media/<UUID>.webp` lo serve solo se il consenso è attivo e il file è collegato a una notizia effettivamente pubblicata o a uno sponsor attivo. La preview amministrativa richiede una sessione autorizzata. Revocare il consenso nasconde immagini collegate e file pubblico nelle letture successive; una copia già salvata dal visitatore non può essere richiamata. Le risposte immagine usano `no-store`. Eliminare è possibile soltanto dopo aver scollegato il file da tutti i contenuti, incluse le bozze e gli sponsor disattivati.

Le operazioni sul database sono accompagnate da audit. Se l’inserimento DB fallisce, il file viene rimosso dallo storage. Un errore eccezionale durante la pulizia è segnalato nei log con `media_cleanup_needed` e UUID: il proprietario può rimuovere il corrispondente `images/<UUID>.webp` dallo store dopo aver verificato che non sia più presente nella libreria. I file orfani non sono serviti dall’endpoint pubblico.

## Verifica dei servizi sul deploy reale

La dashboard amministrativa contiene **Verifica database e immagini**: esegue una query e scrittura/lettura/rimozione di pochi byte in un percorso temporaneo dello storage, senza modificare notizie o foto. Il risultato atteso è **Database OK / Storage immagini OK**. Questo controllo non sostituisce la prova di caricamento, pubblicazione e revoca descritta in `docs/collaudo.md`.

## Backup cifrato manuale

Eseguire da una postazione sicura o Codespace, con Node.js 24, `npm ci`, PostgreSQL client (`pg_dump`, `pg_restore`, `psql`) di versione almeno pari al server e `tar`. La procedura è stata provata con PostgreSQL 18. La variabile backend `DATABASE_URL` deve essere disponibile nel terminale. Configurarla con il gestore sicuro dei segreti; non incollarla in chat, nel codice o in comandi salvati nella cronologia.

```sh
npm run db:backup -- --out backups/portale.slmbak
```

Il comando chiede una passphrase nascosta di almeno 20 caratteri e la conferma. Usare una passphrase lunga generata dal gestore password e conservarla separatamente dal file: senza di essa il backup non è recuperabile. In esecuzioni non interattive si può fornire `BACKUP_PASSPHRASE` tramite un secret manager, mai come argomento del comando. Il comando non sovrascrive un file di backup esistente.

Il pacchetto contiene un dump PostgreSQL custom, manifest e, opzionalmente, i file immagine. È cifrato con AES-256-GCM e chiave derivata con scrypt; la passphrase, i token e l’URL DB non sono memorizzati nel manifest. I file temporanei sono privati e rimossi al termine; dopo un arresto forzato della macchina controllare anche gli eventuali percorsi temporanei `slm-db-backup-*` / `slm-db-restore-*` prima di condividere la postazione. Le cartelle `backups/`, i dump e i pacchetti sono esclusi da Git; non spostarli in `public/`, `dist/` o altri percorsi pubblici.

Il backup DB include contenuti, richieste, configurazioni, ruoli e credenziali applicative: il file rimane riservato anche quando è cifrato. Copiarlo in una destinazione privata separata dal sito e dal computer di lavoro. Una copia esistente ma mai ripristinata non dimostra la recuperabilità. Al momento non sono configurati scheduler o destinazioni automatiche.

### Includere anche le immagini

Per una copia completa dei file caricati dal nuovo modulo, aggiungere **solo nel terminale sicuro** `NETLIFY_SITE_ID` e `NETLIFY_AUTH_TOKEN` con accesso allo store del sito. Sono credenziali per la procedura offline e non servono al caricamento nel pannello. Non inserire il token nel frontend o in variabili `PUBLIC_`.

```sh
npm run db:backup -- --out backups/portale-completo.slmbak --with-media
```

I file da copiare sono ricavati dalla tabella `media` del dump già prodotto, evitando di inventare un elenco diverso dal punto di recupero del database. Se un file gestito risulta mancante, l’operazione fallisce; non viene dichiarata completa una copia incompleta. Il pacchetto verifica anche l’hash SHA-256 di ogni immagine. URL e immagini esterne preesistenti, non gestiti da questo storage, restano riferimenti esterni e non vengono scaricati. Senza `--with-media`, il comando segnala esplicitamente che il backup è del solo database.

## Prova di ripristino in ambiente separato

Creare un **database vuoto separato** per il recupero. Un branch Neon clonato dalla produzione contiene già dati e viene rifiutato: usare un database nuovo e vuoto. Conservare `DATABASE_URL` della sorgente e impostare `RESTORE_DATABASE_URL` soltanto per il database di prova. Il comando rifiuta sorgente e destinazione coincidenti (inclusi alias pooled/unpooled) e destinazioni con tabelle, viste o sequenze esistenti.

```sh
npm run db:restore -- --file backups/portale.slmbak
```

La passphrase viene chiesta senza mostrarla. Prima delle scritture, il comando autentica e decifra il file, controlla manifest, struttura del pacchetto e dump PostgreSQL. Il ripristino è in una singola transazione: un errore SQL annulla le scritture. Il database originale resta invariato. Verificare sul database recuperato utenti, ruoli, notizie, partite e impostazioni prima di decidere qualsiasi cambio del sito. Il comando non cambia la configurazione Netlify e non commuta il sito sulla copia recuperata.

Per provare anche il recupero dei file immagine, usare **un altro sito Netlify e uno store `club-media` vuoto**, impostando `RESTORE_NETLIFY_SITE_ID` e `RESTORE_NETLIFY_AUTH_TOKEN`. Il sito deve essere diverso da quello registrato nel backup; lo store con file esistenti viene rifiutato.

```sh
npm run db:restore -- --file backups/portale-completo.slmbak --with-media
```

I file sono controllati prima delle scritture; in caso di errore del ripristino DB si prova anche a rimuovere i soli file appena caricati nel target. Senza `--with-media`, un pacchetto con immagini ripristina soltanto il DB e segnala che lo storage deve essere conservato o ripristinato separatamente. Non cancellare lo storage originale durante la prova.

## Prova ripetibile senza dati reali

Con Docker locale disponibile e immagine `postgres:18` scaricabile:

```sh
npm run test:backup-drill
```

Il test avvia un PostgreSQL temporaneo senza porte pubbliche, applica le migrazioni e il seed dimostrativo, crea il backup cifrato e lo ripristina in un secondo database vuoto. Confronta dati, ruoli e trigger; verifica il rifiuto della passphrase errata, del ripristino sulla sorgente e della destinazione non vuota. Rimuove il contenitore e i file temporanei alla fine. I file immagine sono coperti dai test unitari con uno storage in memoria; il vero store Netlify deve essere collaudato dal pannello dopo il deploy.
