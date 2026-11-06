import {randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {hashPassword} from 'better-auth/crypto';
import {z} from 'zod';
import {resetAdminStatement} from '../src/server/auth/reset-admin-statement.ts';
import {safeAuthFailure} from '../src/server/auth/diagnostics.ts';
async function main(){
 const config=z.object({DATABASE_URL:z.string().min(1),ADMIN_RESET_EMAIL:z.email().transform(v=>v.toLowerCase()),ADMIN_RESET_PASSWORD:z.string().min(14).max(128)}).safeParse(process.env);
 if(!config.success){console.error('Configurare DATABASE_URL, ADMIN_RESET_EMAIL e ADMIN_RESET_PASSWORD (14–128 caratteri).');process.exitCode=1;return;}
 const c=config.data,statement=resetAdminStatement({email:c.ADMIN_RESET_EMAIL,passwordHash:await hashPassword(c.ADMIN_RESET_PASSWORD),accountId:randomUUID()});
 const rows=await neon(c.DATABASE_URL).query(statement.text,statement.params);
 if(rows.length!==1){console.error('ADMIN_NOT_FOUND: nessun super amministratore globale trovato per questa email. Nessun dato modificato.');process.exitCode=1;return;}
 console.log('PASSWORD_UPDATED: password aggiornata e sessioni precedenti chiuse. Contenuti e permessi conservati.');
}
main().catch(error=>{console.error('Ripristino non riuscito:',safeAuthFailure(error));process.exitCode=1;});
