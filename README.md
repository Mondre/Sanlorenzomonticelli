# San Lorenzo Monticelli

Portale calcistico — fase 1: architettura, struttura e design system. L’identità visiva è provvisoria: nome, stemma e colori devono essere confermati dalla società. Nessun risultato sportivo o notizia fittizia è pubblicato.

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

L’adattatore ufficiale è installato per le successive route dinamiche; al momento l’output è statico. Nessuna Function applicativa è ancora presente.

## Segreti e dati

Le variabili elencate in `.env.example` sono un promemoria per le fasi successive, non requisiti per la build attuale. Non inserire valori in Git, nelle variabili `PUBLIC_*` o nel browser. Database Neon e Better Auth non sono ancora configurati né installati; le credenziali saranno utilizzate esclusivamente dal backend. Non è necessario fornire segreti per questa fase.

## Stato e prossime fasi

Implementato: fondazione Astro/React/TypeScript/Tailwind, identità configurabile nel sorgente, componenti e layout responsive, pagina iniziale senza mock, controlli di build e test HTTP.

Da implementare: schema Drizzle e migrazioni Neon, seed separato, Better Auth, ruoli e permessi server, contenuti dinamici, match center, pannello `/admin`, iscrizioni, media e pagine legali. Non sono presenti pulsanti di salvataggio o login simulati. La homepage completa con foto, risultati, notizie e sponsor appartiene alle successive fasi collegate ai dati reali.

Il portale non è ancora una piattaforma di produzione completa e non dichiara conformità GDPR o WCAG certificata.

## Verifiche eseguite nella fase 1

- `npm run check`: 9 file, zero errori e avvisi.
- `npm run build`: completata, asset statici e funzione SSR dell’adattatore generati.
- Test HTTP sul server Astro: 4 eseguiti, 4 passati.
- `npm audit --omit=dev --audit-level=high`: superato come soglia, ma restano 16 segnalazioni (3 basse, 13 moderate) nelle dipendenze transitive Netlify. Non si applica un downgrade incompatibile per silenziarle. Riesaminare prima del deploy.
- Nessun test browser automatizzato, audit WCAG completo, collegamento Neon o deploy remoto eseguito.
