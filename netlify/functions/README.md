# API Netlify

`categories.ts` e `standings.ts` espongono GET pubbliche di sola lettura; ogni altro metodo restituisce 405. Credenziali DATABASE_URL solo nell’ambiente backend. Errori interni e database mancante restituiscono 503 senza dettagli. Better Auth e CRUD amministrativi non sono ancora attivi. Non aggiungere scritture senza sessioni, RBAC e validazione server.
