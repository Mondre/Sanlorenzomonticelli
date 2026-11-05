# San Lorenzo Monticelli

Portale calcistico con Astro, React, TypeScript, Tailwind, Netlify Functions, Better Auth, Drizzle e Neon PostgreSQL. Nessun Firebase o Supabase. Logo ufficiale in `public/logo-societa.png`, colori verde e oro.

## Cosa è implementato

- Homepage con feed di notizie, ultimo risultato e prossime partite letti dal database.
- `/notizie`: ricerca, filtro categoria, paginazione e articoli con URL stabili. I contenuti sono renderizzati sul server. Le bozze e le pubblicazioni future non sono pubbliche.
- `/partite`: calendario, risultati, filtri, paginazione e scheda partita con cronaca, stato e indicazioni Google Maps.
- `/classifiche`: competizione e stagione selezionabili, punti dai risultati terminati e rettifiche. L’ordine a parità di punti è indicativo, da confrontare con i regolamenti ufficiali.
- `/admin`: accesso email/password, sessioni e permessi server; configurazione iniziale sportiva; notizie con bozze/pubblicazione/programmazione/modifica/eliminazione confermata; creazione partite e aggiornamento di stato, risultato, campo e cronaca.
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
- `category_manager`: contenuti delle sole categorie assegnate.
- `editor`: notizie entro gli scope assegnati.

I permessi sono riletti sul server; la loro revoca vale dalla richiesta successiva. Le API verificano sia lo scope originale sia il contenuto da modificare e rifiutano campi estranei. I conteggi globali della dashboard sono riservati agli amministratori globali. La registrazione pubblica è disabilitata; cookie HttpOnly/Secure/SameSite=Lax su HTTPS, sessioni PostgreSQL di 8 ore, nessun token in localStorage. Better Auth mantiene i controlli di origine. Il rate limiting del login è persistente; l’IP proviene dal contesto Netlify, non dalle intestazioni liberamente inviate dal client.

L’editor attuale è di **testo semplice**: React e Astro eseguono l’escaping, senza rendering HTML arbitrario. Non sono ancora implementati editor rich text e upload immagini. Le API pubbliche non esportano dati dei giocatori o richieste personali; la creazione di categorie non abilita la pubblicazione delle rose, che rimane disattivata. Pianificare conservazione e cancellazione di sessioni, contatori e audit con la società. Nessuna certificazione GDPR o WCAG è dichiarata.

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
- `src/server/content/`: letture pubbliche, CRUD autorizzati, configurazione sportiva e gestione degli errori.
- `src/server/db/`, `drizzle/`, `drizzle.config.ts`: schema e migrazioni Drizzle.
- `src/server/services/standings.ts`: calcolo classifiche.
- `netlify/functions/`: confini HTTP serverless.
- `scripts/`: migrazioni, primo amministratore e seed opt-in.
- `tests/`: autenticazione, permessi, SQL, concorrenza, configurazione e test HTTP.
- `.env.example`, `.node-version`, `astro.config.mjs`, `netlify.toml`, `tsconfig.json`, `package*.json`: configurazione riproducibile.
- `docs/project-brief.md`, `docs/architecture.md`: requisiti e decisioni architetturali.

## Cosa rimane

Upload immagini/storage e rich text sicuro; gestione completa di squadre, staff, rose con consensi e utenti; richieste/iscrizioni con antispam; sponsor; gallerie; timeline degli eventi e formazioni; esportazione ICS; pagine legali e verifiche manuali di accessibilità. L’importazione automatica di calendari e risultati richiede la fonte ufficiale e la verifica delle sue API/licenze/autorizzazioni: nessuno scraping è attivo.

Gli avvisi di dipendenze bassi/moderati noti nelle transitive Netlify/Drizzle sono documentati nelle verifiche precedenti; riesaminare `npm audit` prima della pubblicazione. Non eseguire downgrade incompatibili con `--force` solo per silenziare l’audit.


## Esito delle verifiche dell’aggiornamento

- Test di dominio/database/autenticazione/configurazione: 40 casi passati complessivamente; il primo giro ha individuato un cast booleano mancante nella creazione dei partecipanti, corretto e riverificato con l’intera suite di configurazione (8/8).
- Test HTTP: 10/10, inclusi logo originale, contenitore amministrativo, stati 503 senza database e filtri/ID non validi.
- 14 controlli delle nuove Functions compilate: metodi HTTP, origine CSRF, errori sicuri e assenza di dettagli interni.
- TypeScript: 60 file, zero errori/avvisi/hint. Build Netlify completata.
- Nessuna connessione Neon remota, migrazione su database dell’utente o verifica del sito Netlify reale eseguita. I test non sostituiscono il collaudo del deploy HTTPS e la verifica manuale di accessibilità.
