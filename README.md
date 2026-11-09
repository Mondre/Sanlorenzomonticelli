# San Lorenzo Monticelli

Portale calcistico con Astro, React, TypeScript, Tailwind, Netlify Functions, Better Auth, Drizzle e Neon PostgreSQL. Nessun Firebase o Supabase. Logo ufficiale in `public/logo-societa.png`, colori verde e oro.

## Cosa è implementato

- Homepage con feed di notizie, ultimo risultato e prossime partite letti dal database.
- `/notizie`: ricerca, filtro categoria, paginazione e articoli con URL stabili. I contenuti sono renderizzati sul server. Le bozze e le pubblicazioni future non sono pubbliche.
- `/partite`: calendario, risultati, filtri, paginazione e scheda partita con cronaca, stato e indicazioni Google Maps.
- `/squadre`: categorie, squadre e archivio stagioni; pagine con presentazione, allenamenti, staff autorizzati, partite e notizie. Le rose giovanili non sono esposte.
- `/richieste`: informazioni/prove/segreteria con dati del referente adulto, consenso e antispam persistente. Il modulo resta disabilitato fino alla pubblicazione dell’informativa.
- `/privacy` e `/cookie`: informativa delle richieste configurabile e informazioni sui cookie tecnici del portale.
- `/classifiche`: competizione e stagione selezionabili, punti dai risultati terminati e rettifiche. L’ordine a parità di punti è indicativo, da confrontare con i regolamenti ufficiali.
- `/admin`: accesso email/password, sessioni e permessi server; configurazione iniziale sportiva; notizie con bozze/pubblicazione/programmazione/modifica/eliminazione confermata; creazione partite e aggiornamento di stato, risultato, campo e cronaca; gestione squadre/staff e richieste alla segreteria; utenti/permessi per super amministratori e cambio password personale.
- Configurazione iniziale: creazione/modifica/disattivazione/ordinamento categorie; creazione stagioni, competizioni e partecipanti; creazione campi sportivi. Le squadre con stesso nome, categoria e stagione vengono riutilizzate.
- Audit delle scritture, controllo di versione per notizie e partite, validazione Zod, query parametrizzate, protezione origine/CSRF per le mutazioni e limite di 64 KiB ai payload JSON.

Il codice è verificato con PostgreSQL in memoria nei test. Il collegamento al progetto Neon e il deploy remoto del proprietario non sono stati verificati in questa sessione. Senza credenziali o migrazioni applicate, le sezioni dinamiche mostrano indisponibilità e restituiscono 503; non usano dati finti come alternativa.

## Avvio e verifiche

Node.js 24 (vedere `.node-version`). Dalla cartella del repository:

```sh
npm ci
npm run check
npm run build
npm run test:unit
npm run dev
```

Nel cloud con home non scrivibile, esportare `ASTRO_TELEMETRY_DISABLED=1` prima dei comandi Astro. Astro 7 avvia il server in background; per un server avviato da te usare `npx astro dev stop` per arrestarlo. Ogni task cloud è già isolato: usare il checkout esistente senza creare worktree, salvo richiesta esplicita.

Con Astro attivo:

```sh
TEST_BASE_URL=http://127.0.0.1:4321 node --test tests/routes.test.mjs
```

`npm test` esegue test unitari/database e test HTTP, perciò richiede il server e TEST_BASE_URL. I test PostgreSQL usano PGlite temporaneo in memoria, esclusivamente come dipendenza di sviluppo. Per verificare il routing delle Functions e i loro contesti usare Netlify Dev o un deploy di test con variabili backend configurate. Le verifiche locali non attestano una prova su Neon remoto.

## Collegamento a Neon e attivazione dell’area riservata

1. Creare un progetto Neon PostgreSQL. Configurare `DATABASE_URL` solo nel backend Netlify e nel terminale sicuro usato per le migrazioni. Consentire l’host Neon effettivo nella rete dell’ambiente cloud se si eseguono qui query remote.
2. Configurare `BETTER_AUTH_URL` sull’origine HTTPS esatta del sito, senza percorsi, e `BETTER_AUTH_SECRET` con un segreto casuale di almeno 32 caratteri. Generarlo sul proprio computer, ad esempio con `openssl rand -base64 48`, e inserirlo nelle impostazioni sicure. Non inserire segreti in chat, Git o variabili `PUBLIC_*`.
3. Impostare nel terminale sicuro DATABASE_URL ed eseguire:

```sh
npm run db:migrate
```

Le migrazioni versionate comprendono schema di dominio, tabelle Better Auth e `updated_at` delle partite per i controlli di concorrenza. La build non applica automaticamente migrazioni. `npm run db:generate` serve agli sviluppatori per generare nuove migrazioni dallo schema, senza connessione al database.

4. Configurare temporaneamente `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` nel terminale sicuro e invocare:

```sh
npm run admin:bootstrap
```

Password da 14 a 128 caratteri. Non scrivere password nei comandi salvati nella cronologia: usare il gestore sicuro delle variabili dell’ambiente/terminale. Il bootstrap usa scrypt, query parametrizzate, lock transazionale e audit e impedisce una seconda inizializzazione. Non è un endpoint web. Rimuovere successivamente le variabili BOOTSTRAP_ADMIN_*.

5. Eseguire il deploy e accedere a `/admin`. Verificare login/logout sul dominio HTTPS reale.
6. Aprire **Configurazione sportiva**: creare categorie, competizioni/stagioni/partecipanti ed eventuali campi. Quindi utilizzare **Notizie** e **Partite e risultati**. Non è richiesto il seed per configurare la società reale.

## Ruoli e sicurezza

- `super_admin`: accesso completo.
- `admin`: contenuti e configurazione sportiva, non gestione utenti.
- `category_manager`: notizie, partite, squadre e staff delle sole categorie assegnate. Nessun accesso alle richieste personali.
- `editor`: notizie entro gli scope assegnati.

I permessi sono riletti sul server; la loro revoca vale dalla richiesta successiva. Le API verificano sia lo scope originale sia il contenuto da modificare e rifiutano campi estranei. I conteggi globali della dashboard sono riservati agli amministratori globali. La registrazione pubblica è disabilitata; cookie HttpOnly/Secure/SameSite=Lax su HTTPS, sessioni PostgreSQL di 8 ore, nessun token in localStorage. Better Auth mantiene i controlli di origine. Il rate limiting del login è persistente; l’IP proviene dal contesto Netlify, non dalle intestazioni liberamente inviate dal client.

L’editor attuale è di **testo semplice**: React e Astro eseguono l’escaping, senza rendering HTML arbitrario. L’editor rimane in testo semplice; il caricamento immagini è disponibile nella Libreria immagini amministrativa. Le API pubbliche non esportano dati dei giocatori o richieste personali; la creazione di categorie non abilita la pubblicazione delle rose, che rimane disattivata. Pianificare conservazione e cancellazione di sessioni, contatori e audit con la società. Nessuna certificazione GDPR o WCAG è dichiarata.

## Pubblicazione su Netlify

Collegare il repository al branch `main`. `netlify.toml` imposta Node 24, build `npm run check && npm run build`, output `dist` e Functions in `netlify/functions`. Impostare `SITE_URL` sull’origine HTTPS definitiva per canonical e condivisione WhatsApp. Dominio e certificato HTTPS si configurano dal pannello Netlify, senza modifiche al codice.

Per questa versione con pagine dinamiche e API serve il deploy **da repository o CLI Netlify con Functions**. Il vecchio ZIP statico della fase 1 non contiene i nuovi servizi. Dopo il deploy verificare home, notizie, calendario, classifiche, pagina inesistente e login sul sito reale. Le query di pagina e i salvataggi leggono il database a runtime: pubblicare un articolo non richiede una nuova build.

## API principali

- `/api/auth/*`: Better Auth.
- `/api/admin/dashboard`: riepilogo autenticato.
- `/api/admin/news`: GET paginata, POST creazione, PUT modifica, DELETE eliminazione.
- `/api/admin/matches`: GET paginata, POST creazione, PUT aggiornamento.
- `/api/admin/setup`: configurazione sportiva, solo amministratori globali.
- `/api/club-feed`: GET pubblica per homepage.
- `/api/admin/users`: gestione riservata ai super amministratori.
- `/api/admin/teams`: squadre della società e staff, con scope per categoria.
- `/api/admin/requests`: elenco paginato, presa in carico/chiusura ed eliminazione delle richieste, solo amministratori globali.
- `/api/admin/request-settings`: configurazione/versioni dell’informativa, solo amministratori globali.
- `/api/registration-settings`: dati del modulo e challenge antispam.
- `/api/requests`: invio pubblico con consenso e protezione origine.
- `purge-requests`: Function pianificata giornaliera per scadenza richieste e contatori, senza path pubblico personalizzato.
- `/.netlify/functions/categories` e `/.netlify/functions/standings`: letture pubbliche iniziali.

Nessuna credenziale nel frontend. Per le scritture è richiesta l’origine corretta e JSON; gli errori non espongono query, stack trace o valori di configurazione.

## Dati dimostrativi separati

Solo su un database Neon di test, dopo le migrazioni:

```sh
ALLOW_DEMO_SEED=I_UNDERSTAND npm run db:seed:demo
```

Il seed è esplicito, transazionale, vietato con `CONTEXT=production` o `NODE_ENV=production`, usa nomi DEMO e UUID dedicati e non contiene dati personali. Non viene invocato da installazione o build. Una seconda esecuzione fallisce senza duplicare il dataset. Non usarlo per inizializzare il database reale della società.

## Struttura e file

- `src/config/club.ts`, `public/logo-societa.png`: identità societaria.
- `src/styles/global.css`, `src/layouts/BaseLayout.astro`: design system, temi e layout.
- `src/components/admin/`: accesso, configurazione sportiva, notizie, partite e client API.
- `src/components/public/`: card condivise e feed homepage.
- `src/pages/notizie/`, `src/pages/partite/`, `src/pages/classifiche.astro`: pagine pubbliche on-demand.
- `src/shared/content.ts`, `src/shared/setup.ts`: DTO, validazioni e formattazione condivise.
- `src/server/auth/`: Better Auth, autorizzazioni e bootstrap.
- `src/server/teams/`, `src/server/requests/`: servizi squadre, privacy, antispam e richieste.
- `src/server/content/`: letture pubbliche, CRUD autorizzati, configurazione sportiva e gestione degli errori.
- `src/server/db/`, `drizzle/`, `drizzle.config.ts`: schema e migrazioni Drizzle.
- `src/server/services/standings.ts`: calcolo classifiche.
- `netlify/functions/`: confini HTTP serverless.
- `scripts/`: migrazioni, primo amministratore e seed opt-in.
- `tests/`: autenticazione, permessi, SQL, concorrenza, configurazione e test HTTP.
- `.env.example`, `.node-version`, `astro.config.mjs`, `netlify.toml`, `tsconfig.json`, `package*.json`: configurazione riproducibile.
- `docs/project-brief.md`, `docs/architecture.md`: requisiti e decisioni architetturali.

## Cosa rimane

Editor rich text sicuro; gestione avanzata e modifica dei singoli collaboratori, CRUD giocatori adulti con consensi e anonimizzazione dei profili; gallerie; timeline degli eventi e formazioni; completamento/revisione delle informative societarie e verifiche manuali di accessibilità. È disponibile il collegamento limitato ai dati sportivi essenziali di Romagna Sport, descritto sotto; altre fonti richiedono un connettore dedicato.

Gli avvisi di dipendenze bassi/moderati noti nelle transitive Netlify/Drizzle sono documentati nelle verifiche precedenti; riesaminare `npm audit` prima della pubblicazione. Non eseguire downgrade incompatibili con `--force` solo per silenziare l’audit.


## Squadre: gestione e privacy

Da **Squadre e staff** gli amministratori e i responsabili della categoria possono creare una squadra della società in una stagione esistente, modificarne presentazione e orari, aggiungere un collaboratore adulto e rimuoverlo. La pubblicazione del nome/ruolo dello staff richiede un’azione esplicita; per correggere un collaboratore, rimuoverlo e inserirlo nuovamente. Le stagioni sono create dalla configurazione sportiva iniziale.

Le pagine pubbliche non mostrano staff riservato né squadre avversarie come squadre della società. Le rose giovanili rimangono escluse anche se un flag nel database fosse permissivo. Per gli adulti servono sia l’abilitazione della rosa nella categoria sia il consenso del singolo giocatore; la gestione dei giocatori/consensi via pannello non è ancora implementata. Le partite dell’archivio sono filtrate per la stagione scelta, non mescolate a quella corrente.

## Richieste, informativa e conservazione

Dopo aver collegato Neon, applicare la nuova migrazione con `npm run db:migrate`. Gli accessi continuano a richiedere DATABASE_URL, BETTER_AUTH_URL e BETTER_AUTH_SECRET: non occorrono altri segreti o servizi CAPTCHA per questo modulo.

1. In `/admin` aprire **Richieste → Informativa privacy e attivazione del modulo**.
2. Inserire denominazione/indirizzo del titolare, contatto privacy, testo approvato dalla società e durata di conservazione (da 30 a 365 giorni). Il testo deve comprendere finalità, base giuridica, destinatari, eventuali trasferimenti, diritti e reclamo. Non sono forniti dati legali inventati né una certificazione di conformità GDPR.
3. Dopo la verifica della società, abilitare il modulo e salvare. Una bozza o un’informativa mancante non abilita la raccolta dati. Il testo resta in forma semplice, senza HTML arbitrario.
4. Verificare `/privacy` e un invio su `/richieste` nel dominio primario HTTPS. Il campo consenso è obbligatorio e si riferisce alla risposta alla richiesta; non è un consenso marketing. Non raccogliere dati personali o sanitari dei minori nel messaggio.
5. La segreteria autorizzata può prendere in carico, chiudere o eliminare la richiesta. L’eliminazione rimuove i dati personali della richiesta; l’audit registra solo azione e UUID, senza copiare il messaggio o i recapiti. Non vengono inviate email automatiche; il collegamento email apre il programma di posta dell’operatore.

Ogni invio conserva data e versione dell’informativa; le versioni pubblicate sono archiviate in una tabella separata e non vengono sovrascritte. Un aggiornamento dell’informativa invalida i moduli precedenti finché l’utente non li aggiorna e conferma nuovamente il consenso. La versione corrente è pubblica; lo storico è conservato nel database, non esposto con un endpoint pubblico.

Antispam: campo honeypot, challenge HMAC firmata vincolata a IP/versione, compilazione minima di 3 secondi e validità massima di 30 minuti; quota atomica di 3 invii ogni 15 minuti per digest IP. L’IP arriva esclusivamente dal contesto Netlify, mai da intestazioni scelte dal client. È memorizzato solo un digest HMAC pseudonimizzato, non l’IP in chiaro. Il secret è derivato per scopi separati da BETTER_AUTH_SECRET; ruotarlo invalida anche le challenge già emesse. I digest non sono da considerare dati anonimi. I reinvii con lo stesso identificativo non duplicano richieste né quota; i payload JSON hanno il limite comune di 64 KiB. Queste misure riducono lo spam senza promettere di eliminarlo completamente.

Conservazione: `purge-requests` è configurata come Function Netlify giornaliera (`0 3 * * *`, ore 04:00 italiane in inverno/05:00 in estate). La durata effettiva è il minore tra quella dell’informativa accettata e quella attuale: aumentare la durata non prolunga retroattivamente la conservazione delle vecchie richieste. Le richieste prive di storico legacy usano una soglia prudente di 30 giorni. I digest con più di 24 ore vengono rimossi al passaggio giornaliero. L’esecuzione periodica deve essere verificata sul deploy di produzione Netlify; non è attestata dai test locali.

Pulizia manuale alternativa, da un terminale sicuro con DATABASE_URL impostata:

```sh
npm run requests:purge
```

Il comando elimina solo dati oltre la soglia prevista e produce conteggi, senza stampare dati personali. Il processo è idempotente. Controllare con la società le durate, i fornitori e le regioni effettivamente configurati prima di pubblicare l’informativa. Le pagine privacy/cookie non sostituiscono questa verifica.

## File aggiunti nell’aggiornamento

`src/shared/teams.ts`, `src/shared/requests.ts`; `src/server/teams/service.ts`; `src/server/requests/service.ts`, `security.ts`; `src/components/admin/TeamsManager.tsx`, `RequestsManager.tsx`, `PolicyEditor.tsx`; `src/components/public/RegistrationForm.tsx`; `src/pages/squadre/*`, `richieste.astro`, `privacy.astro`, `cookie.astro`; `netlify/functions/admin-teams.ts`, `admin-requests.ts`, `request-settings.ts`, `registration-settings.ts`, `registration.ts`, `purge-requests.ts`; `scripts/purge-requests.mjs`; migrazione `0003` e snapshot; `tests/teams.test.mjs`, `tests/requests.test.mjs`. Aggiornati navigazione, footer, homepage, schema/permessi, filtro stagionale e test HTTP.

## Esito delle verifiche dell’aggiornamento

- Test di dominio/database/autenticazione/configurazione/richieste/squadre: 60/60 passati.
- Test HTTP: 14/14, inclusi logo originale, contenitore amministrativo, pagine pubbliche, stato del modulo e filtri non validi.
- 19 controlli sulle nuove Functions compilate: metodi, origini, indisponibilità sicura e configurazione della pianificazione.
- TypeScript: 83 file, nessun errore/avviso/hint. Build Netlify completata.
- Nessuna connessione Neon remota, migrazione su database dell’utente, invio di dati personali reali o esecuzione cron su Netlify effettuata. Rimangono il collaudo del deploy HTTPS e le verifiche manuali di accessibilità.

## Diagnostica accesso non disponibile

La Function `auth` registra un evento JSON `auth_failure` con `reference`, `stage` e un codice scelto da un elenco fisso. La risposta pubblica conserva il messaggio generico e contiene soltanto il riferimento, non la causa interna. Non vengono registrati credenziali, URL del database, cookie, corpi delle richieste, query o messaggi originali delle eccezioni.

Dopo un deploy aggiornato, aprire `/api/auth/ok`. In caso di 503, cercare il riferimento in Netlify → Functions → auth → Logs. Condividere solo `code` e `stage`, non log completi. Codici `DATABASE_URL_MISSING`, `AUTH_SECRET_MISSING`, `AUTH_SECRET_TOO_SHORT`, `AUTH_URL_MISSING` e `AUTH_URL_INVALID` distinguono problemi delle variabili runtime. `DATABASE_SCHEMA_MISSING`/`DATABASE_SCHEMA_OUTDATED` indicano migrazioni da verificare nel database/branch effettivamente usato dalla Function; `DATABASE_AUTH_FAILED`, `DATABASE_NETWORK_ERROR` e `CLIENT_IP_UNAVAILABLE` guidano le diagnosi successive senza esporre i valori. Un codice non dimostra da solo che il collegamento remoto sia stato riparato.

Verifiche della modifica: 14 test autenticazione/diagnostica passati, typecheck senza errori/avvisi e build completata; Function compilata verificata nei rami di configurazione mancante/invalida e contesto IP non valido, controllando che valori sensibili non compaiano nei log o nelle risposte.

## Ripristinare la password del primo amministratore

Da un terminale sicuro con Node 24 e checkout aggiornato, configurare temporaneamente DATABASE_URL (la stessa di Netlify), ADMIN_RESET_EMAIL e ADMIN_RESET_PASSWORD (14–128 caratteri), quindi eseguire `npm run admin:reset-password`. Usare input nascosto per connessione e password; non scrivere segreti nella cronologia o nei file Git. Rimuovere le tre variabili al termine.

Il comando aggiorna solo un super amministratore globale già esistente, conserva account/contenuti/permessi, revoca tutte le sue sessioni e registra un evento di manutenzione senza credenziali. È un singolo comando SQL atomico con query parametrizzata e hash scrypt Better Auth. Non è esposto come API web. Con email non trovata o senza ruolo appropriato restituisce ADMIN_NOT_FOUND e non promuove né crea utenti. In quel caso verificare l’email e il database effettivo; il bootstrap iniziale resta la procedura per un database privo di amministratore.

Verifiche: 5 test PostgreSQL passati (nuova password, rifiuto vecchia password/sessione, conservazione dati, email assente e utente senza privilegi); TypeScript senza errori/avvisi. Il ripristino sul database reale deve essere eseguito dall’operatore nel proprio terminale sicuro.


## Utenti, permessi e cambio password

La sezione **Utenti e permessi** è riservata ai super amministratori globali. Consente creazione degli account con password iniziale, assegnazione di un ruolo e delle categorie, riattivazione/disattivazione, aggiornamento del nome e reimpostazione della password degli altri collaboratori. L’email di accesso rimane immutabile in questa schermata. Non vengono inviate email automatiche: comunicare le credenziali con un canale privato e invitare il collaboratore a usare **La mia password**.

I responsabili devono avere almeno una categoria. I redattori possono ricevere categorie specifiche oppure tutte le notizie, con una scelta esplicita. I ruoli amministrativi sono globali. Non sono ammessi ruoli arbitrari, categorie inesistenti o campi estranei; password, hash e token non sono restituiti nell’elenco utenti. Una modifica dei permessi o una reimpostazione della password revoca le sessioni del destinatario. Disattivare elimina i grant e blocca nuovi login; riattivare richiede una nuova assegnazione esplicita. Identità e riferimenti editoriali sono conservati: la disattivazione non è una cancellazione/anonimizzazione GDPR.

Ogni utente autorizzato può cambiare la propria password dalla sezione **La mia password**, indicando la password corrente e confermando la nuova. Better Auth rinnova la sessione corrente e chiude le altre; nessun token viene salvato in localStorage. Da Utenti e permessi non è consentito modificare il proprio account o reimpostare la propria password: usare la funzione personale o, per il recupero del super amministratore, lo script CLI documentato sopra.

### Attivazione della protezione dell’ultimo amministratore

Dal checkout aggiornato in Codespaces, con la stessa DATABASE_URL di Netlify impostata temporaneamente nel terminale sicuro, eseguire `npm run db:migrate`. La migrazione `0004_protect_last_super_admin` aggiunge una funzione e un trigger PostgreSQL per preservare almeno un grant super amministrativo globale nelle cancellazioni/modifiche, serializzando le rimozioni. Le definizioni supportano una riesecuzione in caso di applicazione DDL parziale.

Le nuove scritture di gestione utenti verificano che il trigger sia presente e abilitato, oltre al ruolo attuale dell’operatore nel database. Finché manca la migrazione, la sezione è di sola lettura e segnala il passo richiesto. Non sono aggiunte colonne necessarie al login: il controllo di account attivo usa le tabelle ruoli/permessi già esistenti. Gli account privi di grant validi non ricevono nuove sessioni; le autorizzazioni continuano a essere rilette dal server.

Creazioni, modifiche e reset amministrativi utilizzano SQL parametrizzato e CTE atomiche con audit. Le versioni dei profili prevengono sovrascritture concorrenti. Le password passano soltanto nel corpo HTTPS della richiesta autenticata e sono hashate dal backend con Better Auth. Non sono mostrate negli elenchi né copiate nell’audit. Inviti email, modifica email con verifica e anonimizzazione degli account sono sviluppi successivi.

### File della gestione utenti

`src/shared/users.ts`; `src/server/users/access.ts`, `service.ts`; `src/components/admin/UsersManager.tsx`, `ChangePassword.tsx`; `netlify/functions/admin-users.ts`; `drizzle/0004_protect_last_super_admin.sql` e metadati; `tests/users.test.mjs`. Aggiornati integrazione Better Auth, dashboard, stili e script di test.

Verifiche: 79 test database/autenticazione/dominio passati; 14 test HTTP passati; 4 controlli della Function compilata (metodi, origine e indisponibilità senza configurazione); TypeScript su 94 file senza errori/avvisi e build Netlify completata. Non sono stati creati, disattivati o modificati account reali nel database dell’utente durante queste verifiche. Applicazione della migrazione e collaudo sul sito dell’utente restano da eseguire nell’ambiente di produzione.


### Sponsor e campi sportivi

Gli amministratori possono gestire **Sponsor e partner** e **Campi sportivi** nel pannello. Le pagine pubbliche `/sponsor` e `/campi` leggono i dati reali da Neon; la home mostra fino a sei sponsor attivi, ordinati secondo la priorità scelta. Uno sponsor può essere disattivato senza cancellarlo. I link ai siti devono essere HTTPS pubblici.

I loghi sono selezionabili dai media già registrati con consenso alla pubblicazione, formato PNG/JPEG/WebP/AVIF e URL HTTPS senza parametri. La revoca del consenso nasconde il logo nelle letture successive. In assenza di immagini si mostra il nome; i nuovi file si caricano dalla Libreria immagini amministrativa. Verificare il fornitore dei media nella documentazione privacy prima di usare immagini esterne.

Per ogni campo si gestiscono nome, indirizzo, città, indicazioni e parcheggio. Il collegamento Google Maps viene costruito dall’indirizzo; un campo associato a partite non può essere eliminato. L’API `/api/admin/club-content?kind=sponsors|venues` supporta GET/POST/PUT/DELETE, paginazione, controllo di origine, audit atomico e controllo delle modifiche concorrenti tramite versione PostgreSQL `xmin`. Editor e responsabili di categoria non accedono a queste funzioni.

Si usano le tabelle esistenti, senza nuove migrazioni. Verifiche del modulo in `tests/club-content.test.mjs` con database PGlite temporaneo, senza accesso al database pubblico. L’importazione da Tuttocampo rimane sospesa in attesa di un canale autorizzato e accessibile.


### Dati automatici da Romagna Sport

In **Area amministrativa → Dati automatici**, attivare la fonte e premere **Aggiorna ora** per il primo caricamento. È richiesta la sessione di un amministratore o super amministratore. Non occorrono nuove migrazioni o credenziali della fonte; si usano le tabelle `site_settings` e `audit_logs` già esistenti. La fonte è inizialmente disattivata. Disattivarla nasconde i dati automatici e conserva l’ultimo aggiornamento nel database.

Il collegamento riguarda soltanto la prima squadra: **San Lorenzo Monticelli, ID 13497, Prima Categoria Girone A, ID 282, stagione 2026/2027**. Legge due pagine pubbliche fisse: calendario e classifica. Estrae 30 gare della squadra e i dati numerici delle 16 squadre del girone. Non importa rose, persone, marcatori, foto, loghi, articoli o HTML della fonte. La scheda della squadra è soltanto un collegamento informativo, non viene scaricata dal connettore.

I dati vengono mostrati in home, `/partite` (senza un filtro di categoria) e `/classifiche` (senza una competizione locale selezionata), con fonte, stagione e data dell’ultimo aggiornamento. L’elenco importato è distinto dalle partite gestite manualmente: nessun risultato locale viene sovrascritto o ricalcolato a partire dai dati esterni. La classifica segue posizioni e punti della fonte, incluse eventuali rettifiche. Il calendario non fornisce qui l’orario delle singole gare: non vengono inventati orari né campi. `N.G.` resta un risultato non disponibile, mai 0–0.

La Function Netlify `sync-sports` prevede aggiornamenti alle **06:15, 12:15, 18:15 e 23:15 UTC**, soltanto quando la fonte è attiva. Il calendario stagionale è fissato esplicitamente e l’esecuzione programmata termina il 1° luglio 2027: non viene indovinato il girone della stagione successiva. La pianificazione funziona sul deploy Netlify pubblicato; non viene avviata dalla build o dall’ambiente locale. Il primo aggiornamento manuale e l’invocazione pianificata sul provider vanno verificati dopo un futuro deploy: questo sviluppo non pubblica il sito e non scrive nel Neon di produzione.

Tra i tentativi, anche simultanei e anche in errore, è applicata una pausa persistente di 15 minuti. La lettura pubblica `/api/sports-feed` usa solo la copia nel database: le visite non causano richieste alla fonte. Gli endpoint amministrativi sono GET/PUT/POST `/api/admin/sports-import`; le mutazioni richiedono origine valida e JSON. Le richieste esterne hanno URL fissi, niente redirect, timeout di 12 secondi per pagina (richieste parallele) e limite di 1 MB. Il parser verifica stagione, squadre, giornate, duplicati, copertura completa del calendario e coerenza numerica della classifica. Se un controllo fallisce, non sostituisce l’ultimo snapshot valido. Dopo 24 ore senza aggiornamenti, le pagine avvisano che i dati potrebbero essere superati. Non è un servizio di risultati live: data e variazioni vanno verificate sulla fonte.

`tests/sports-import.test.mjs` usa fixture contenenti solo dati sportivi essenziali e un PostgreSQL PGlite temporaneo per provare importazione, permessi, concorrenza, limite dei tentativi, idempotenza e conservazione dell’ultimo aggiornamento valido. La struttura HTML esterna può cambiare: in quel caso il connettore richiede manutenzione.


In caso di importazione fallita, **Dati automatici** mostra il motivo, un codice diagnostico e un riferimento. Il pulsante di aggiornamento rimane disabilitato fino all’orario del prossimo tentativo indicato nel pannello; **Ricarica stato** non effettua richieste alla fonte. Anche una risposta di limite dei tentativi conserva il motivo dell’errore precedente. I log delle Functions contengono l’evento `sports_import_failure` con codice, fase, eventuale stato HTTP e riferimento, senza contenuti delle pagine, query o credenziali. Un errore di rete, timeout, blocco HTTP/challenge, formato e salvataggio nel database sono distinti: il cooldown non viene presentato come causa del fallimento iniziale.


### Salvataggio delle partite nel calendario personale

Le schede partita e le card delle partite gestite dalla società offrono **Salva nel calendario (.ics)** quando è disponibile una data utilizzabile. Nella pagina `/partite` si può scaricare l’intero calendario per la categoria e la modalità selezionate, incluse le gare nelle pagine successive. È un download, senza richiesta di account Google/Microsoft/Apple o accesso ai calendari personali; la pagina include istruzioni per l’importazione nelle tre applicazioni.

L’endpoint pubblico GET `/api/calendar.ics?id=<UUID>` esporta una partita visibile sul sito. Senza `id` accetta `category=<UUID>`, `season=<UUID>` e `mode=upcoming|all|results` (default `upcoming`). Con `upcoming` include gare in corso e gare future programmate o annullate. Sono sempre escluse partite senza data, rinviate e sospese; la singola gara in questi stati restituisce 409. Le partite annullate con data sono marcate `STATUS:CANCELLED`. L’esportazione include solo partite in cui è presente una squadra della società, coerentemente con la visibilità delle schede pubbliche. Se non ci sono eventi restituisce 404; oltre 500 eventi invita a restringere i filtri, senza troncare il file.

Il file iCalendar usa orari UTC, identificatori stabili, ultima modifica della partita, nome delle squadre e campo disponibile, senza inventare ora o durata della gara. I testi sono trattati come testo semplice con escaping e folding UTF-8 secondo RFC 5545. Non esporta cronache, persone, email o inviti. Gli URL delle schede usano `SITE_URL`, oppure `BETTER_AUTH_URL`, con fallback al dominio Netlify della società, mai l’Host della richiesta. Il download contiene una copia dei dati e **non sincronizza automaticamente le variazioni**: il visitatore deve controllare la scheda della gara e aggiornare il proprio calendario.

Il modulo non dipende da Romagna Sport e non effettua chiamate esterne. Legge solo le partite gestite nel database societario. Nessuna migrazione o variabile aggiuntiva è necessaria. I test in `tests/calendar.test.mjs` verificano con PGlite visibilità, filtri, calendario oltre la prima pagina, cancellazioni, date mancanti, stabilità degli identificatori, orari e protezione da contenuti iniettati nel formato ICS.


### Immagini, verifiche e recupero

- **Libreria immagini**: caricamento amministrativo su Netlify Blobs, validazione e conversione WebP con Sharp, descrizione, consenso, revoca ed eliminazione dei soli file inutilizzati. Copertine delle notizie e loghi sponsor collegati dal pannello. Usa tabelle esistenti, senza nuove migrazioni.
- **Verifica servizi** nella dashboard: query DB e prova temporanea di scrittura/lettura/rimozione nello storage reale.
- `npm run smoke:live`: controlli HTTP di sola lettura del sito pubblicato, senza login.
- `npm run db:backup -- --out backups/portale.slmbak`: backup manuale cifrato. `--with-media` include i file immagine gestiti; richiede le credenziali storage nel terminale sicuro.
- `npm run db:restore -- --file backups/portale.slmbak`: ripristino solo in un database vuoto separato. Nessuna commutazione del sito o sovrascrittura della sorgente.
- `npm run test:backup-drill`: prova di recupero su PostgreSQL 18 temporaneo in Docker.

Istruzioni complete in [docs/operations.md](docs/operations.md) e [docs/collaudo.md](docs/collaudo.md). Non sono attivati backup automatici o destinazioni di archiviazione esterne. Il primo backup reale e il collaudo autenticato dello storage Netlify restano operazioni da eseguire con gli accessi del proprietario; i test di sviluppo non li sostituiscono.

La Configurazione sportiva permette anche di creare una stagione indipendente dalle competizioni. Quando mancano requisiti per una creazione, Notizie, Squadre e staff e Partite e risultati mostrano il motivo e il percorso di configurazione, senza rimuovere i controlli dei permessi. Vedi `docs/collaudo.md` per il flusso con un database vuoto.


`SITE_URL` e `BETTER_AUTH_URL` sono indirizzi pubblici: è previsto che il loro valore compaia nei link, nel codice e nell’HTML generato. Quando coincidono, lo scanner può segnalare lo stesso valore per entrambe le chiavi. `netlify.toml` esclude soltanto questi indirizzi dal controllo dei valori segreti con `SECRETS_SCAN_OMIT_KEYS = "SITE_URL,BETTER_AUTH_URL"`. La scansione rimane attiva per le altre variabili; non disabilitare lo scanner e non aggiungere `DATABASE_URL` o `BETTER_AUTH_SECRET` alle esclusioni. Nel pannello Netlify l’origine pubblica non richiede la classificazione come segreto.
