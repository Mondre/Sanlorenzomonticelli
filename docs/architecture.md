# Architettura e compatibilità — fase 1

Verifica del 5 novembre 2026: metadati npm (versioni, engines e peerDependencies), documentazione ufficiale Better Auth per Astro e README ufficiale del driver Neon.

## Stack selezionato

Node 24; Astro 7.4.5, @astrojs/react 7.1.2, @astrojs/netlify 8.2.11; React 19; TypeScript strict; Tailwind 4 tramite plugin Vite; Lucide React; Zod 4. Il lockfile fissa la risoluzione completa. La linea Astro 6 è stata esclusa dopo gli avvisi di sicurezza npm. Con Astro 7 si evita di fissare oxc-transform-react nel progetto: npm risolve le dipendenze richieste dalle integrazioni; nessun --legacy-peer-deps o --force.

## Confini

Browser → pagine Astro / isole React → Netlify Functions → servizi server-only → Drizzle → Neon PostgreSQL. Nessuna credenziale nel browser. L’output attuale è statico; i contenuti dinamici saranno recuperati dal backend o renderizzati con route on-demand tramite l’adattatore ufficiale. Le categorie proverranno dal database, non da enumerazioni nel frontend.

Per Better Auth il gestore standard accetta Request e restituisce Response; il backend Netlify dovrà montarlo su `/api/auth/*`, preservando cookie e intestazioni. Usare sessioni nel database, origine attendibile esplicita, iscrizioni pubbliche disabilitate per gli amministratori e rate limiting persistente. Non basare rate limiting su memoria di una Function. Le sessioni e RBAC richiedono una verifica reale su deploy HTTPS; il supporto documentato non equivale a una verifica end-to-end.

Per Drizzle/Neon scegliere driver HTTP per query semplici e batch; le transazioni interattive richiedono un driver compatibile e connessioni chiuse entro la richiesta. Non assumere che il driver HTTP supporti tutte le transazioni richieste dall’adattatore di autenticazione. Schema e versioni backend saranno fissati e testati prima dell’implementazione.

## Storage immagini: decisione rinviata, nessun upload implementato

Non assumere che il piano gratuito Neon includa un object storage o API di upload immagini. PostgreSQL conserva metadati, permessi e riferimenti; evitare immagini base64 nel database. Prima della fase media verificare documentazione, quote e API correnti di un servizio gratuito separato (candidato: Cloudinary) oppure Netlify Blobs, includendo limiti di traffico e costi. Nessun piano gratuito o limite numerico è dato per garantito. Implementare poi upload firmati lato server, controllo byte/MIME/dimensioni, autorizzazioni e consenso esplicito per foto di minori. Nessuno storage è stato dichiarato operativo.

## Moduli successivi

1. Schema normalizzato: identità e sessioni, stagioni, categorie, squadre, competizioni, partecipazioni, partite ed eventi, rettifiche, contenuti e tassonomie, media, sponsor, campi, richieste, impostazioni e audit.
2. Migrazioni versionate e seed opt-in, chiaramente dimostrativo. Nessun seed automatico in produzione.
3. Autenticazione e RBAC su ogni operazione, con scope di categoria e test di accesso negato.
4. Pagine pubbliche collegate al database; successivamente CRUD amministrativi, form e media.

Nessun Firebase, Supabase, scraping o servizio realtime richiesto. Le fasi database/deploy richiedono un progetto Neon e un sito Netlify dell’utente; nessun servizio è stato creato o pubblicato.

## Fonti

- https://www.npmjs.com/package/astro
- https://www.npmjs.com/package/@astrojs/react
- https://www.npmjs.com/package/@astrojs/netlify
- https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/astro.mdx
- https://github.com/neondatabase/serverless/blob/main/README.md
- https://docs.astro.build/en/guides/deploy/netlify/

Solo le prime cinque fonti sono state consultate tramite metadati npm o contenuto del repository; il link Astro è fornito come riferimento per il deploy. I limiti commerciali di storage e hosting restano da verificare prima della relativa implementazione.

## Aggiornamento fase 2

Implementati schema Drizzle (21 tabelle), migrazione iniziale, client Neon HTTP, API Netlify GET per categorie/classifiche, calcolo classifiche, seed DEMO opt-in. I dati restano nel backend e non ci sono scritture pubbliche. Le credenziali Neon sono assenti: migrazione/seed sono stati testati in PostgreSQL WASM in memoria, non su un servizio Neon remoto. Better Auth e sessioni restano nella fase 3. API verificate localmente nei rami 400/405/503 e senza esposizione di dettagli interni. Il successo delle query GET col database remoto richiede ancora test sul progetto Neon reale.

## Aggiornamento fase 3

Better Auth 1.7.17, adattatore Drizzle con transazioni interattive disabilitate per il driver Neon HTTP, mapping esplicito dei modelli. Lettura delle sessioni dal database a ogni controllo; nessuna cache autorizzativa nel browser. Per il bootstrap il driver Neon esegue invece una transazione batch con lock e tutti gli inserimenti atomici. Login pubblico disabilitato per nuove registrazioni; il primo account viene creato da script sicuro con scrypt e audit.

Contatori di rate limiting persistenti nel database. Le Functions accettano come IP autorevole solo il contesto Netlify, non le intestazioni liberamente fornite dal client. Better Auth mantiene i controlli di origine e cookie predefiniti. Il flusso completo è testato con PostgreSQL in memoria; configurazione Neon e routing Functions sul deploy dell’utente rimangono da verificare.

## Notizie, partite e configurazione sportiva

Aggiunti servizi SQL parametrizzati attraverso Drizzle, API con controllo origine/JSON/limite dimensioni e autorizzazioni di categoria, pannelli notizie/partite/configurazione iniziale e pagine Astro on-demand. Le modifiche e l’audit sono atomici tramite CTE PostgreSQL; non dipendono da transazioni interattive non supportate dal driver HTTP. I version token di notizie/partite hanno granularità millisecondo e avanzano in modo monotono; un salvataggio obsoleto restituisce 409 senza registrare un falso successo. Una notizia assegnata a più categorie richiede permessi su tutte le categorie per la gestione.

Pubblicazioni programmate risolte dalla query (status pubblicato/programmato e data trascorsa), senza cron o rebuild. I testi sono semplici ed escaped da React/Astro; non c’è rendering HTML arbitrario. Calendario e classifiche associano squadre/partecipazioni/competizione/stagione, con soli dati pubblici. Homepage usa un’isola React con stati vuoti/errore; liste e dettagli sono SSR per SEO e funzionamento senza JavaScript.

La configurazione iniziale reale non usa il seed: categorie e campi tramite form, competizioni con stagione e partecipanti creati atomicamente; le squadre esistenti della stessa categoria/stagione sono riutilizzate per nome. Creazione di nuovi utenti, gestione avanzata squadre e importazioni restano moduli successivi. Nessun accesso Neon remoto è stato attestato senza credenziali valide.

## Squadre, richieste e conservazione

Squadre: DTO pubblici filtrati nel servizio; nessuna rosa giovanile anche con flag permissivi. Gli adulti richiedono flag categoria e consenso individuale. Staff pubblicabile solo con flag esplicito, editor esclusi dalle mutazioni di squadra e scope per i responsabili. Gestione di presentazione/allenamenti con token di versione monotono e audit atomico. Archivio filtrato per stagione nelle partite correlate.

Richieste: accesso privato solo agli amministratori globali, minimizzazione sui dati del referente adulto. Informativa versionata e modulo disabilitato fino a pubblicazione esplicita del testo della società. Le impostazioni sono salvate con optimistic locking; lo storico delle versioni pubblicate è immutabile. Invio, quota e audit avvengono in un singolo comando PostgreSQL con CTE: nessuna transazione interattiva richiesta a Neon HTTP. Chiave idempotente HMAC per reinvii; in caso di conflitto concorrente la transazione annulla anche il consumo quota e il servizio verifica l’inserimento già avvenuto.

Challenge HMAC a tempo, legata a digest dell’IP autorevole Netlify e versione informativa, honeypot e contatori persistenti. Nessun IP in chiaro nel database. I digest sono pseudonimi, non anonimi. Versione accettata e timestamp consentono ricostruzione dell’informativa; cancellazione e audit non duplicano i recapiti. La Function giornaliera applica la durata minore tra versione originaria e configurazione attuale e ripulisce contatori con più di 24 ore. Attivazione/routing/cron sul provider restano da verificare sul deploy reale, così come completezza giuridica dei testi della società.

## Gestione utenti

Un account è attivo se possiede grant validi; non è introdotta una colonna obbligatoria per il login. Il runtime Better Auth verifica i grant prima della creazione di una sessione. Disattivazione e variazioni di scope rimuovono le sessioni; gli accessi API mantengono la verifica per richiesta. Soltanto super amministratori globali attuali possono gestire utenti; il servizio ricontrolla il grant nel database oltre al controllo del confine HTTP. Scope di categoria espliciti, email normalizzate, password con scrypt e nessun hash/token nei DTO degli elenchi.

La migrazione custom 0004 installa una protezione PostgreSQL sulle rimozioni/modifiche dei grant super amministrativi globali, con advisory lock transazionale. Le scritture del modulo restano disabilitate se il trigger non è attivo. I profili sono aggiornati con optimistic locking; grant, credenziali, revoca sessioni e audit amministrativo sono atomici tramite CTE. Il proprio account non è modificabile da questa sezione; il cambio password personale usa l’endpoint Better Auth con verifica della corrente e revoca delle altre sessioni. Gli account disattivati restano per preservare attribuzioni editoriali; anonimizzazione e inviti email non sono implementati in questa fase.


## Sponsor e impianti

Sponsor e campi riusano le tabelle esistenti e la versione PostgreSQL `xmin` per impedire sovrascritture concorrenti. Ogni mutazione è accompagnata da audit nello stesso statement CTE; il vincolo esterno delle partite impedisce di cancellare impianti utilizzati. Le API rileggono la sessione e i grant, consentono la gestione soltanto agli amministratori e applicano i controlli di origine alle scritture. Le letture pubbliche espongono DTO ridotti, sponsor attivi e loghi con consenso e formato ammesso verificati al momento della lettura. Non effettuano richieste server verso URL dei partner; i link sono HTTPS e le mappe hanno destinazione Google Maps fissa. Upload e importazioni da fonti esterne restano separati.


## Importazione dei dati sportivi essenziali

Il connettore Romagna Sport è fissato alla stagione 2026/2027 e al girone della prima squadra, con due sole URL server predefinite. Cheerio interpreta HTML non eseguito; il parser restituisce esclusivamente squadre, date, risultati e statistiche aggregate della classifica. Nessun HTML remoto entra nei componenti e nessuna informazione individuale viene conservata. I controlli sulla copertura del girone impediscono di sostituire dati validi con pagine vuote, challenge, stagioni diverse o calendari incompleti.

Lo snapshot validato e la configurazione risiedono in chiavi dedicate di `site_settings`. Un upsert condizionale sulla chiave del tentativo garantisce il cooldown globale di 15 minuti, con token per associare il salvataggio al tentativo corrente. Snapshot e audit vengono salvati nello stesso statement CTE. L’errore conserva lo snapshot precedente; il client segnala dati più vecchi di 24 ore. La Function pianificata legge il flag amministrativo e non espone una route di sincronizzazione pubblica; l’API pubblica restituisce soltanto lo snapshot della fonte attiva. Le tabelle editoriali delle partite restano autonome, evitando sovrascritture e duplicazioni nel database locale.


## Esportazione iCalendar

La Function `/api/calendar.ics` valida filtri e UUID prima di accedere al database. Usa le letture pubbliche delle schede e una query dedicata per l’elenco completo, con limite di 500 eventi e senza paginazione implicita. Non legge dati della fonte esterna né dati individuali. Il serializzatore produce eventi con inizio UTC, UID stabile, ultima modifica e stato; esclude gare senza data utilizzabile. Escaping dei valori testuali, CRLF e folding a 75 ottetti evitano che nomi o indirizzi inseriti nei contenuti generino proprietà o eventi arbitrari. L’origin dei link è scelto dalla configurazione e non da intestazioni del visitatore. I file sono copie scaricabili con `Cache-Control: no-store`, senza accesso ai calendari personali o sincronizzazione automatica.


## Media e recupero

I nuovi media sono WebP ricodificati, senza metadati, conservati nello store persistente Netlify Blobs `club-media`; il database registra UUID, descrizione, consenso e chiave immutabile. Solo gli amministratori caricano, modificano o rimuovono immagini. Le copertine rispettano lo scope editoriale della notizia, mentre la libreria condivisa fornisce soltanto opzioni autorizzate. La route pubblica verifica consenso e collegamento a un contenuto visibile a ogni richiesta; la preview amministrativa richiede sessione e grant aggiornati. Non si espone il token dello storage al browser. Mutazioni DB e audit sono nello stesso statement; quota e cancellazioni usano la serializzazione PostgreSQL, il blob di un caricamento non registrato viene rimosso come compensazione.

Le procedure offline creano un dump PostgreSQL custom, opzionalmente scaricano le immagini elencate nel dump stesso, controllano un manifest e cifrano l’intero pacchetto con AES-256-GCM / scrypt. Il ripristino autentica il file prima delle scritture, controlla percorsi e hash, rifiuta sorgente e destinazioni con dati, e usa una transazione PostgreSQL. Nessun endpoint web esporta password hash, sessioni o backup completi. L’integrazione di prova usa un PostgreSQL 18 temporaneo, indipendente da Neon; le immagini vengono provate con storage in memoria. Verifica della produzione e attivazione delle copie reali rimangono distinte dai test.
