import process from 'node:process';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.ts';
export function database() {
 const url = process.env.DATABASE_URL;
 if (!url) throw new Error('DATABASE_NOT_CONFIGURED');
 return drizzle(neon(url), { schema });
}
