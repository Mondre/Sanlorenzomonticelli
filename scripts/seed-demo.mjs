import {readFile} from 'node:fs/promises';
import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL mancante.');
if(process.env.ALLOW_DEMO_SEED!=='I_UNDERSTAND' || process.env.CONTEXT==='production' || process.env.NODE_ENV==='production')throw new Error('Seed vietato: usare solo un database Neon di test separato e ALLOW_DEMO_SEED=I_UNDERSTAND.');
const sql=neon(process.env.DATABASE_URL);
const statements=(await readFile(new URL('./seed-demo.sql',import.meta.url),'utf8')).split('--> statement-breakpoint').filter(s=>s.trim());
await sql.transaction(statements.map(statement=>sql.query(statement)));
console.log('Dataset DEMO inserito. Una seconda esecuzione fallisce senza duplicare dati.');
