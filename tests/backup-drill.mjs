// Opt-in integration test: PostgreSQL 18 in a disposable local Docker container.
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,readdir,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'slm-backup-drill-')),container='slm-drill-'+Date.now();
const dockerEnv={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[k];
function exec(command,args,{env=dockerEnv,input}={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{env,stdio:['pipe','pipe','pipe'],cwd:root});let out='',err='';child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>err+=v);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));child.stdin.end(input);});}
const docker=(args,input)=>exec('docker',['--host=unix:///var/run/docker.sock',...args],{input});
const sql=async(db,input)=>{const result=await docker(['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-A','-t','-v','ON_ERROR_STOP=1'],input);assert.equal(result.code,0,'PostgreSQL fixture query failed');return result.out.trim();};
try{
 const started=await docker(['run','--detach','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=slm_source','postgres:18']);assert.equal(started.code,0,'Docker PostgreSQL not available');
 let ready=false;for(let i=0;i<60;i++){if((await docker(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres'])).code===0){ready=true;break;}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'PostgreSQL did not start');
 await sql('postgres','CREATE DATABASE slm_restore; CREATE DATABASE slm_wrong_key; CREATE DATABASE slm_nonempty;');await sql('slm_nonempty','CREATE TABLE keep_me(id integer); INSERT INTO keep_me VALUES(42);');
 for(const f of (await readdir(join(root,'drizzle'))).filter(f=>f.endsWith('.sql')).sort())await sql('slm_source',await readFile(join(root,'drizzle',f),'utf8'));
 await sql('slm_source',await readFile(join(root,'scripts/seed-demo.sql'),'utf8'));
 await sql('slm_source',"INSERT INTO users(id,name,email) VALUES ('backup-admin','Backup Test','test@example.test'); INSERT INTO user_permissions(user_id,role_id) SELECT 'backup-admin',id FROM roles WHERE name='super_admin';");
 const helper=join(dir,'client.mjs');
 await writeFile(helper,`import {spawn} from 'node:child_process';import {createReadStream,createWriteStream} from 'node:fs';let args=process.argv.slice(3),tool=process.argv[2],input,output;if(tool==='pg_dump'){const i=args.indexOf('--file');output=args[i+1];args.splice(i,2);}if(tool==='pg_restore'){input=args.pop();}const child=spawn('docker',['--host=unix:///var/run/docker.sock','exec','-i','-e','PGUSER','-e','PGPASSWORD','-e','PGDATABASE','-e','PGSSLMODE','-e','PGHOST=127.0.0.1','-e','PGPORT=5432',${JSON.stringify(container)},tool,...args],{stdio:['pipe','pipe','pipe']});if(input)createReadStream(input).pipe(child.stdin);else child.stdin.end();if(output)child.stdout.pipe(createWriteStream(output,{mode:0o600}));else child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);child.on('close',code=>{process.exitCode=code;});`);
 const vars={...dockerEnv,DATABASE_URL:'postgres://postgres@localhost/slm_source',RESTORE_DATABASE_URL:'postgres://postgres@localhost/slm_restore',BACKUP_PASSPHRASE:'Test-only-recovery-passphrase-12345'};
 for(const [name,tool] of [['PG_DUMP_BIN','pg_dump'],['PG_RESTORE_BIN','pg_restore'],['PSQL_BIN','psql']]){const wrapper=join(dir,tool);await writeFile(wrapper,'#!/bin/sh\nexec '+JSON.stringify(process.execPath)+' '+JSON.stringify(helper)+' '+tool+' "$@"\n',{mode:0o700});await chmod(wrapper,0o700);vars[name]=wrapper;}
 const file=join(dir,'test.slmbak');let result=await exec(process.execPath,['scripts/backup-database.mjs','--out',file],{env:vars});assert.equal(result.code,0,'Backup command failed: '+result.out+result.err);
 result=await exec(process.execPath,['scripts/restore-database.mjs','--file',file],{env:{...vars,RESTORE_DATABASE_URL:vars.DATABASE_URL}});assert.notEqual(result.code,0);assert.match(result.err,/RESTORE_TARGET_EQUALS_SOURCE/);
 result=await exec(process.execPath,['scripts/restore-database.mjs','--file',file],{env:{...vars,RESTORE_DATABASE_URL:'postgres://postgres@localhost/slm_wrong_key',BACKUP_PASSPHRASE:'Wrong-test-passphrase-long-enough'}});assert.notEqual(result.code,0);assert.match(result.err,/INVALID_BACKUP_OR_PASSPHRASE/);
 result=await exec(process.execPath,['scripts/restore-database.mjs','--file',file],{env:{...vars,RESTORE_DATABASE_URL:'postgres://postgres@localhost/slm_nonempty'}});assert.notEqual(result.code,0);assert.match(result.err,/RESTORE_TARGET_NOT_EMPTY/);assert.equal(await sql('slm_nonempty','SELECT id FROM keep_me'),'42');
 result=await exec(process.execPath,['scripts/restore-database.mjs','--file',file],{env:vars});assert.equal(result.code,0,'Restore command failed: '+result.out+result.err);
 for(const table of ['users','user_permissions','matches','teams','seasons','roles'])assert.equal(await sql('slm_restore',`SELECT count(*) FROM ${table}`),await sql('slm_source',`SELECT count(*) FROM ${table}`),table+' count differs');
 assert.equal(await sql('slm_restore',"SELECT count(*) FROM pg_trigger WHERE tgname='preserve_last_super_admin' AND tgenabled='O'"),'1');
 console.log('BACKUP_DRILL_OK: cifratura, ripristino PostgreSQL 18, dati/ruoli/trigger conservati; sorgente e destinazioni non vuote protette.');
}finally{await docker(['rm','--force',container]);await rm(dir,{recursive:true,force:true});}
