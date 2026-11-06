import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {openBundle,restoreMedia} from './backup/bundle.mjs';
import {passphrase,connection,run,decryptFile,clients} from './backup/core.mjs';
async function main(){
 process.umask(0o077);const args=process.argv.slice(2),withMedia=args.includes('--with-media');if(withMedia)args.splice(args.indexOf('--with-media'),1);if(args.length!==2||args[0]!=='--file')throw new Error('USAGE: npm run db:restore -- --file /percorso/privato/backup.slmbak');
 const source=connection(process.env.DATABASE_URL),target=connection(process.env.RESTORE_DATABASE_URL);
 if(source.identity===target.identity)throw new Error('RESTORE_TARGET_EQUALS_SOURCE');
 const phrase=await passphrase(),work=await mkdtemp(join(tmpdir(),'slm-db-restore-'));
 try{
  const payload=join(work,'payload.tar'),dump=join(work,'database.dump');await decryptFile(resolve(args[1]),payload,phrase);const manifest=await openBundle(work,payload,target.env);await run(clients.restore,['--list',dump],target.env);
  const nonempty=await run(clients.psql,['-X','-A','-t','--set','ON_ERROR_STOP=on','--command',"SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f'))"],target.env);
  if(nonempty!=='f')throw new Error('RESTORE_TARGET_NOT_EMPTY');
  const cleanup=withMedia?await restoreMedia(work,manifest):async()=>{};
  try{await run(clients.restore,['--no-owner','--no-acl','--single-transaction','--exit-on-error','--dbname',target.env.PGDATABASE,dump],target.env);}catch(error){await cleanup();throw error;}
  if(!withMedia&&manifest.mediaCount)console.log('RESTORE_DATABASE_ONLY: file immagine non ripristinati. Conserva lo storage originale o usa --with-media su un sito separato.');
  console.log('RESTORE_COMPLETE: ripristino completato nel database separato. Il database sorgente non è stato modificato.');
 }finally{await rm(work,{recursive:true,force:true});}
}
main().catch(error=>{console.error('Ripristino non riuscito:',error.message);process.exitCode=1;});
