# API Netlify

`categories.ts` e `standings.ts` espongono GET pubbliche di sola lettura; ogni altro metodo restituisce 405. Credenziali DATABASE_URL solo nell’ambiente backend. Errori interni e database mancante restituiscono 503 senza dettagli. Better Auth e CRUD amministrativi non sono ancora attivi. Non aggiungere scritture senza sessioni, RBAC e validazione server.

`auth.ts`: Better Auth su /api/auth/*, registrazione pubblica disabilitata, IP dal contesto Netlify. `admin-dashboard.ts`: GET /api/admin/dashboard con verifica sessione e grant server. Conteggi globali solo per amministratori globali; nessuna scrittura contenuti è ancora esposta. Richiede DATABASE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET e le migrazioni.
