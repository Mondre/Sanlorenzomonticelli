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
