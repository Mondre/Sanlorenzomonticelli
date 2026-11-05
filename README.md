# San Lorenzo Monticelli

Portale calcistico — design system e fondazione backend. Colori verde e oro aggiornati; lo stemma originale è in attesa del file caricabile. Nessun risultato sportivo o notizia fittizia è pubblicato.

## Avvio

Node.js 24 e npm. Dalla cartella del repository:

```sh
npm ci
npm run check
npm run build
npm run dev
```

Nel cloud con home non scrivibile, anteporre `ASTRO_TELEMETRY_DISABLED=1` ai comandi Astro. Aprire l’indirizzo indicato da Astro. Le pagine disponibili sono `/`, `/design-system` e la pagina 404. Menu mobile e cambio tema sono componenti React; il tema dura per la pagina corrente e segue inizialmente la preferenza di sistema. Nessun localStorage, servizio esterno o database locale viene usato.

Con il server attivo, in un secondo terminale:

```sh
TEST_BASE_URL=http://127.0.0.1:4321 npm test
```

I test HTTP verificano rendering, stato 404 e asset locale. Non attestano conformità WCAG: occorrono verifiche manuali con tastiera, screen reader e contrasto dopo la personalizzazione.

## File e responsabilità

- `src/config/club.ts`: identità societaria provvisoria.
- `src/styles/global.css`: token di colore, tipografia, spaziatura, temi e componenti.
- `src/layouts/BaseLayout.astro`: struttura HTML, SEO, header e footer.
- `src/components/Navigation.tsx`: menu e tema con Lucide React.
- `src/pages/`: pagine statiche Astro.
- `src/server/`: confine per servizi e autorizzazioni backend futuri.
- `netlify/functions/`: destinazione delle API Netlify future.
- `drizzle/`: destinazione delle migrazioni future.
- `tests/`: verifiche HTTP.
- `docs/project-brief.md`: requisiti originali del progetto.
- `docs/architecture.md`: decisioni, verifiche di compatibilità e piano successivo.
- `.env.example`, `.node-version`, `tsconfig.json`, `astro.config.mjs`, `netlify.toml`, `package.json`, `package-lock.json`, `.gitignore`: configurazione e installazione riproducibile.
- `public/crest.svg`, `public/pitch.svg`: asset originali provvisori senza fotografie o dati di minori.

## Netlify

Collegare il repository e usare `netlify.toml`: Node 24, comando `npm run check && npm run build`, pubblicazione `dist`. Il dominio personalizzato e il certificato HTTPS si configurano nel pannello Netlify, senza modificare il codice. Impostare `SITE_URL` sull’origine HTTPS definitiva per attivare i canonical SEO. Dopo il primo deploy verificare home, design system, 404 e asset. Il deploy remoto non è stato eseguito durante la fase 1.

L’adattatore ufficiale è installato per le successive route dinamiche; al momento l’output è statico. Sono presenti due Functions pubbliche di sola lettura per categorie e classifiche; vedere la sezione backend sotto.

## Segreti e dati

Le variabili elencate in `.env.example` sono un promemoria per le fasi successive, non requisiti per la build attuale. Non inserire valori in Git, nelle variabili `PUBLIC_*` o nel browser. Driver Neon e Drizzle sono installati; Better Auth non è ancora implementato. DATABASE_URL serve per API e migrazioni, ma non per build e pagine statiche. Le credenziali sono utilizzate esclusivamente dal backend.

## Stato e prossime fasi

Implementato: fondazione Astro/React/TypeScript/Tailwind, identità configurabile nel sorgente, componenti e layout responsive, pagina iniziale senza mock, controlli di build e test HTTP.

Da implementare: collegamento remoto Neon, Better Auth, ruoli e permessi server, contenuti dinamici, match center, pannello `/admin`, iscrizioni, media e pagine legali. Non sono presenti pulsanti di salvataggio o login simulati. La homepage completa con foto, risultati, notizie e sponsor appartiene alle successive fasi collegate ai dati reali.

Il portale non è ancora una piattaforma di produzione completa e non dichiara conformità GDPR o WCAG certificata.

## Verifiche eseguite nella fase 1

- `npm run check`: 9 file, zero errori e avvisi.
- `npm run build`: completata, asset statici e funzione SSR dell’adattatore generati.
- Test HTTP sul server Astro: 4 eseguiti, 4 passati.
- `npm audit --omit=dev --audit-level=high`: superato come soglia, ma restano 16 segnalazioni (3 basse, 13 moderate) nelle dipendenze transitive Netlify. Non si applica un downgrade incompatibile per silenziarle. Riesaminare prima del deploy.
- Nessun test browser automatizzato, audit WCAG completo, collegamento Neon o deploy remoto eseguito.


## Aggiornamento: identità e fondazione backend

Palette aggiornata a verde scuro e oro. Per usare lo stemma originale caricare **il file originale** in `public/logo-societa.png` (sono accettati anche `.jpg`, `.jpeg` e `.webp`) e fare commit/push. La build lo rileva automaticamente e lo utilizza in header, hero, footer e favicon. Finché il file manca rimane lo stemma provvisorio; l’immagine mostrata nella chat non è risultata disponibile come file nel workspace. Non è stata ricreata né modificata con strumenti generativi.

Aggiunti schema Drizzle di 21 tabelle, migrazione iniziale, calcolo classifiche, seed dimostrativo esplicito e API pubbliche Netlify di sola lettura:

- `GET /.netlify/functions/categories`: categorie attive ordinate, senza dati personali.
- `GET /.netlify/functions/standings?competition=<UUID>`: classifica associata alla competizione e alla stagione, rettifiche incluse. L’ordinamento a parità di punti è indicativo e non sostituisce i regolamenti ufficiali.

Senza database configurato le API rispondono 503, senza esporre credenziali o dettagli interni. Nessun endpoint amministrativo è stato attivato. La homepage resta statica e non visualizza i dati di queste API finché non sarà completata la fase pagine pubbliche.

### Collegare Neon

Creare un progetto Neon e configurare `DATABASE_URL` **solo nel backend** delle impostazioni Netlify (Functions) e nel terminale sicuro dove si eseguono le migrazioni. Non incollare credenziali in chat o committare `.env`. Il nome host Neon effettivo dovrà essere consentito nella rete dell’ambiente cloud prima dei test remoti. Non servono variabili `PUBLIC_`.

```sh
npm run db:generate   # genera SQL dallo schema, senza connessione
npm run db:migrate    # richiede DATABASE_URL; esegue migrazioni versionate
npm run test:unit     # classifiche + migrazioni su PostgreSQL WASM in memoria
```

Le migrazioni non vengono eseguite automaticamente a ogni deploy. Lo schema contiene l’identità utenti e i permessi di dominio; sessioni/account/verifiche Better Auth saranno aggiunti nella fase autenticazione. I permessi non sono ancora applicati a CRUD amministrativi perché tali API non esistono ancora.

### Seed separato

Solo su un database Neon di test, dopo le migrazioni:

```sh
ALLOW_DEMO_SEED=I_UNDERSTAND npm run db:seed:demo
```

Il seed è vietato quando `CONTEXT=production` o `NODE_ENV=production`, usa nomi DEMO e UUID dedicati e non contiene dati personali. È una transazione esplicita: una seconda esecuzione fallisce senza duplicare i dati. Non viene invocato da installazione o build.

### Limiti delle verifiche backend

Migrazione e seed verificati su PostgreSQL WASM temporaneo (PGlite, solo dipendenza di test), non su Neon remoto. Nessun database locale viene usato in produzione. Non dichiarare funzionante un collegamento Neon finché una query sul progetto reale non è stata eseguita. Upload immagini e autenticazione rimangono da implementare.


### File aggiunti per il backend

`drizzle.config.ts`, `drizzle/0000_smiling_hammerhead.sql`, `drizzle/meta/*`, `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/server/http.ts`, `src/server/services/standings.ts`, `netlify/functions/categories.ts`, `netlify/functions/standings.ts`, `scripts/migrate.mjs`, `scripts/seed-demo.mjs`, `scripts/seed-demo.sql`, `tests/database.test.mjs`, `tests/standings.test.mjs`, `src/env.d.ts`.

Verifiche dell’aggiornamento: TypeScript senza errori, build completata, 9 test unitari/database e 4 test HTTP passati. Ulteriori 5 verifiche manuali delle API compilate hanno controllato metodi HTTP, UUID non valido, assenza di database e mancata esposizione di dettagli interni. Logo originale e connessione Neon remota non verificati perché i rispettivi file/credenziali non sono disponibili.
