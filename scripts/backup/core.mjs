import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {open,writeFile,appendFile,stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {basename} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
const magic=Buffer.from('SLM-BACKUP-1\n');
export async function passphrase(confirm=false){
 let value=process.env.BACKUP_PASSPHRASE;
 if(!value){if(!process.stdin.isTTY)throw new Error('BACKUP_PASSPHRASE_REQUIRED');const muted=new Writable({write(_chunk,_encoding,done){done();}});const rl=createInterface({input:process.stdin,output:muted,terminal:true});
 try{process.stdout.write('Passphrase backup (non visibile): ');value=await rl.question('');process.stdout.write('\n');if(confirm){process.stdout.write('Ripeti passphrase: ');const repeat=await rl.question('');process.stdout.write('\n');if(repeat!==value)throw new Error('PASSPHRASE_MISMATCH');}}finally{rl.close();}}
 if(value.length<20)throw new Error('PASSPHRASE_TOO_SHORT');return value;
}
export function connection(value){
 if(!value)throw new Error('DATABASE_URL_REQUIRED');let url;try{url=new URL(value);}catch{throw new Error('INVALID_DATABASE_URL');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||url.pathname.length<2)throw new Error('INVALID_DATABASE_URL');
 return {identity:url.hostname.replace(/-pooler(?=\.)/,'').toLowerCase()+':'+(url.port||'5432')+url.pathname,env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:url.searchParams.get('sslmode')||(/^(localhost|127\.0\.0\.1)$/.test(url.hostname)?'disable':'require'),PGCONNECT_TIMEOUT:'15',PGAPPNAME:'san-lorenzo-backup'}};
}
export function run(binary,args,env){return new Promise((resolve,reject)=>{
 const child=spawn(binary,args,{env,stdio:['ignore','pipe','pipe']});let output='',size=0;
 child.stdout.on('data',data=>{size+=data.length;if(size<1_000_000)output+=data.toString();});child.stderr.resume();
 child.on('error',()=>reject(new Error('POSTGRES_CLIENT_UNAVAILABLE')));child.on('close',code=>code===0?resolve(output.trim()):reject(new Error('COMMAND_FAILED_'+(['pg_dump','pg_restore','psql','tar'].includes(basename(binary))?basename(binary).toUpperCase():'CLIENT'))));
});}
export async function encryptFile(input,output,phrase){
 const salt=randomBytes(16),iv=randomBytes(12),header=Buffer.concat([magic,salt,iv]),cipher=createCipheriv('aes-256-gcm',scryptSync(phrase,salt,32),iv);cipher.setAAD(header);
 await writeFile(output,header,{flag:'wx',mode:0o600});
 await pipeline(createReadStream(input),cipher,createWriteStream(output,{flags:'a',mode:0o600}));await appendFile(output,cipher.getAuthTag());
}
export async function decryptFile(input,output,phrase){
 const size=(await stat(input)).size,headerSize=magic.length+28;if(size<headerSize+17)throw new Error('INVALID_BACKUP');
 const file=await open(input,'r');const header=Buffer.alloc(headerSize),tag=Buffer.alloc(16);
 try{await file.read(header,0,header.length,0);await file.read(tag,0,16,size-16);}finally{await file.close();}
 if(!header.subarray(0,magic.length).equals(magic))throw new Error('INVALID_BACKUP');
 const decipher=createDecipheriv('aes-256-gcm',scryptSync(phrase,header.subarray(magic.length,magic.length+16),32),header.subarray(-12));decipher.setAAD(header);decipher.setAuthTag(tag);
 try{await pipeline(createReadStream(input,{start:headerSize,end:size-17}),decipher,createWriteStream(output,{flags:'wx',mode:0o600}));}catch{throw new Error('INVALID_BACKUP_OR_PASSPHRASE');}
}
export const clients={dump:process.env.PG_DUMP_BIN||'pg_dump',restore:process.env.PG_RESTORE_BIN||'pg_restore',psql:process.env.PSQL_BIN||'psql'};
