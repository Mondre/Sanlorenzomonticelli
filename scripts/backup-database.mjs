import {mkdtemp,mkdir,rm,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {createBundle} from './backup/bundle.mjs';
import {passphrase,connection,run,encryptFile,clients} from './backup/core.mjs';
async function main(){
 process.umask(0o077);const args=process.argv.slice(2),withMedia=args.includes('--with-media');if(withMedia)args.splice(args.indexOf('--with-media'),1);if(args.length!==2||args[0]!=='--out')throw new Error('USAGE: npm run db:backup -- --out /percorso/privato/backup.slmbak');
 const out=resolve(args[1]);if(!out.endsWith('.slmbak'))throw new Error('USE_SLMBACKUP_EXTENSION');
 for(const forbidden of ['public','dist','.git'])if(out.startsWith(resolve(forbidden)+'/'))throw new Error('UNSAFE_OUTPUT_DIRECTORY');
 const source=connection(process.env.DATABASE_URL),phrase=await passphrase(true),work=await mkdtemp(join(tmpdir(),'slm-db-backup-'));await mkdir(dirname(out),{recursive:true,mode:0o700});
 const encrypted=join(dirname(out),'.slm-backup-'+Date.now()+'.partial');
 try{
  const dump=join(work,'database.dump');await run(clients.dump,['--format=custom','--no-owner','--no-acl','--file',dump],source.env);
  await run(clients.restore,['--list',dump],source.env);const bundle=await createBundle(work,dump,source.env,withMedia);await encryptFile(bundle.payload,encrypted,phrase);await link(encrypted,out);
  console.log(withMedia?'BACKUP_MEDIA_INCLUDED: immagini gestite incluse.':'BACKUP_DATABASE_ONLY: file immagine esclusi; usa --with-media per includerli.');
  console.log('BACKUP_CREATED: copia cifrata e archivio PostgreSQL verificato. Conserva la passphrase separatamente.');
 }finally{await rm(work,{recursive:true,force:true});await rm(encrypted,{force:true});}
}
main().catch(error=>{console.error('Backup non riuscito:',error.message);process.exitCode=1;});
