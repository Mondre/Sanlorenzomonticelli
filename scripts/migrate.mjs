import {neon} from '@neondatabase/serverless';
import {drizzle} from 'drizzle-orm/neon-http';
import {migrate} from 'drizzle-orm/neon-http/migrator';
if(!process.env.DATABASE_URL)throw new Error('Impostare DATABASE_URL nel backend prima delle migrazioni.');
await migrate(drizzle(neon(process.env.DATABASE_URL)),{migrationsFolder:'./drizzle'});
console.log('Migrazioni applicate.');
