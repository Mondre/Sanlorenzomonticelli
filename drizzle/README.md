# Migrazioni versionate

`npm run db:generate` genera SQL senza accedere al database. `npm run db:migrate` applica la cronologia al progetto Neon indicato da DATABASE_URL (variabile solo backend). Non modificare migrazioni già applicate. Snapshot e journal Drizzle sono versionati in meta/. Seed DEMO separato e opt-in in scripts/, mai eseguito dalla build. Test PGlite in memoria verificano vincoli e seed ma non attestano la connettività a Neon.
