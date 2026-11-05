# API Netlify

`categories.ts` e `standings.ts` espongono GET pubbliche di sola lettura; ogni altro metodo restituisce 405. Credenziali DATABASE_URL solo nell’ambiente backend. Errori interni e database mancante restituiscono 503 senza dettagli. Better Auth e CRUD amministrativi non sono ancora attivi. Non aggiungere scritture senza sessioni, RBAC e validazione server.

`auth.ts`: Better Auth su /api/auth/*, registrazione pubblica disabilitata, IP dal contesto Netlify. `admin-dashboard.ts`: GET /api/admin/dashboard con verifica sessione e grant server. Conteggi globali solo per amministratori globali; nessuna scrittura contenuti è ancora esposta. Richiede DATABASE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET e le migrazioni.

CRUD: /api/admin/news e /api/admin/matches richiedono sessione e scope server, Origin coerente e JSON per le scritture. /api/admin/setup richiede il ruolo globale amministrativo. Payload massimi 64 KiB, SQL parametrizzato, audit atomico e controllo di versione per articoli/partite. /api/club-feed è sola lettura e non contiene dati personali. Le pagine Astro SSR leggono gli stessi servizi. Consultare il README principale per l’attivazione.

Squadre/staff: /api/admin/teams, scope server per categoria. Richieste private: /api/admin/requests e /api/admin/request-settings, riservate agli amministratori globali. Pubblico: /api/registration-settings emette challenge firmate vincolate al contesto IP Netlify; /api/requests valida origine, consenso e versione informativa prima di salvare. Il secret HMAC è quello backend Better Auth, con namespace per finalità. Nessuna intestazione IP controllabile dal client viene utilizzata.

`purge-requests.ts` usa config.schedule per esecuzione giornaliera; non definisce un path pubblico personalizzato, non restituisce dati o conteggi personali e cancella solo record scaduti. Verificare la pianificazione nel provider dopo il deploy.
