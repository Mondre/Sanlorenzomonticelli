import {getStore} from '@netlify/blobs';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {run,clients} from './core.mjs';
const keyPattern=/^images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;
export function mediaKeysFromDump(sql){
 const match=sql.match(/^COPY public\.media \(([^)]+)\) FROM stdin;\r?\n([\s\S]*?)^\\\.$/m);if(!match)throw new Error('BACKUP_MEDIA_TABLE_NOT_FOUND');
 const index=match[1].split(',').map(v=>v.trim()).indexOf('storage_key');if(index<0)throw new Error('BACKUP_MEDIA_SCHEMA_UNKNOWN');
 return match[2].split(/\r?\n/).filter(Boolean).map(line=>line.split('\t')[index]).filter(key=>keyPattern.test(key));
}
function storeConfig(target=false){const siteID=process.env[target?'RESTORE_NETLIFY_SITE_ID':'NETLIFY_SITE_ID'],token=process.env[target?'RESTORE_NETLIFY_AUTH_TOKEN':'NETLIFY_AUTH_TOKEN'];if(!siteID||!token)throw new Error('MEDIA_BACKUP_CREDENTIALS_REQUIRED');return getStore({name:'club-media',siteID,token,consistency:'strong'});}
export async function createBundle(work,dump,env,withMedia,providedStore){
 const keys=mediaKeysFromDump(await run(clients.restore,['--data-only','--table=media','--no-owner','--no-acl','--file=-',dump],env));
 return archiveBundle(work,keys,env,withMedia,providedStore);
}
export async function archiveBundle(work,keys,env,withMedia,providedStore){
 if(keys.length>500||keys.some(key=>!keyPattern.test(key)))throw new Error('INVALID_BACKUP_MEDIA');
 const directory=join(work,'media');await mkdir(directory,{mode:0o700});
 const manifest={format:1,createdAt:new Date().toISOString(),mediaIncluded:withMedia,mediaCount:keys.length,sourceSite:process.env.NETLIFY_SITE_ID??null,files:[]};
 if(withMedia&&keys.length){const store=providedStore??storeConfig();for(const key of keys){const file=await store.get(key,{type:'arrayBuffer'});if(!file||file.byteLength>2*1024*1024)throw new Error('BACKUP_MEDIA_MISSING_OR_INVALID');const name=keyPattern.exec(key)[1]+'.webp',bytes=Buffer.from(file);await writeFile(join(directory,name),bytes,{mode:0o600});manifest.files.push({name,key,sha256:createHash('sha256').update(bytes).digest('hex')});}}
 await writeFile(join(work,'manifest.json'),JSON.stringify(manifest),{mode:0o600});const payload=join(work,'bundle.tar');
 await run('tar',['-cf',payload,'-C',work,'database.dump','manifest.json','media'],env);return {payload,manifest};
}
export async function openBundle(work,payload,env){
 const names=(await run('tar',['-tf',payload],env)).split('\n').filter(Boolean);
 if(names.length>503||!names.includes('database.dump')||!names.includes('manifest.json')||names.some(name=>!['database.dump','manifest.json','media/'].includes(name)&&!/^media\/[0-9a-f-]{36}\.webp$/.test(name))||new Set(names).size!==names.length)throw new Error('INVALID_BACKUP_BUNDLE');
 const types=(await run('tar',['-tvf',payload],env)).split('\n').filter(Boolean);if(types.some(line=>!['-','d'].includes(line[0])))throw new Error('INVALID_BACKUP_BUNDLE');
 await run('tar',['-xf',payload,'-C',work,'--no-same-owner','--no-same-permissions'],env);
 if((await stat(join(work,'manifest.json'))).size>200000)throw new Error('INVALID_BACKUP_MANIFEST');
 const manifest=JSON.parse(await readFile(join(work,'manifest.json'),'utf8'));
 if(manifest.format!==1||typeof manifest.mediaIncluded!=='boolean'||!Array.isArray(manifest.files)||manifest.files.length>500||!Number.isInteger(manifest.mediaCount)||manifest.mediaCount<0||manifest.mediaCount>500||manifest.files.length!==(manifest.mediaIncluded?manifest.mediaCount:0))throw new Error('INVALID_BACKUP_MANIFEST');
 for(const file of manifest.files){if(!keyPattern.test(file.key)||file.name!==keyPattern.exec(file.key)[1]+'.webp'||(await stat(join(work,'media',file.name))).size>2*1024*1024)throw new Error('INVALID_BACKUP_MEDIA');const bytes=await readFile(join(work,'media',file.name));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('INVALID_BACKUP_MEDIA');}
 return manifest;
}
export async function restoreMedia(work,manifest,providedStore){
 if(!manifest.mediaIncluded&&manifest.mediaCount)throw new Error('MEDIA_NOT_INCLUDED_IN_BACKUP');
 if(!manifest.files.length)return async()=>{};
 if(!providedStore&&(!process.env.RESTORE_NETLIFY_SITE_ID||process.env.RESTORE_NETLIFY_SITE_ID===manifest.sourceSite))throw new Error('RESTORE_MEDIA_REQUIRES_DIFFERENT_SITE');
 const store=providedStore??storeConfig(true),existing=await store.list({prefix:'images/'});if(existing.blobs.length)throw new Error('RESTORE_MEDIA_TARGET_NOT_EMPTY');
 const written=[];const cleanup=async()=>{for(const key of written)await store.delete(key);};
 try{for(const file of manifest.files){const bytes=await readFile(join(work,'media',file.name));await store.set(file.key,new Uint8Array(bytes).buffer);written.push(file.key);}}catch{await cleanup();throw new Error('MEDIA_RESTORE_FAILED');}
 return cleanup;
}
