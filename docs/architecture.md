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
