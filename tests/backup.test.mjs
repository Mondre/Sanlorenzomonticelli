import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {encryptFile,decryptFile,connection} from '../scripts/backup/core.mjs';
test('backup: cifratura autenticata, password errata e corruzione rifiutate',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'slm-backup-unit-'));try{
  const source=join(dir,'source'),backup=join(dir,'encrypted'),restored=join(dir,'restored'),phrase='Test-only-passphrase-at-least-20-chars';
  await writeFile(source,'private-account-and-contact-data');await encryptFile(source,backup,phrase);
  const encrypted=await readFile(backup);assert.equal(encrypted.includes(Buffer.from('private-account-and-contact-data')),false);
  await decryptFile(backup,restored,phrase);assert.equal(await readFile(restored,'utf8'),'private-account-and-contact-data');
  await assert.rejects(decryptFile(backup,join(dir,'wrong'),phrase+'wrong'),/INVALID_BACKUP_OR_PASSPHRASE/);
  encrypted[encrypted.length-17]^=1;await writeFile(join(dir,'tampered'),encrypted);await assert.rejects(decryptFile(join(dir,'tampered'),join(dir,'corrupt'),phrase),/INVALID_BACKUP_OR_PASSPHRASE/);
  assert.equal(connection('postgresql://user:password@ep-source-pooler.example/db').identity,connection('postgres://other:new@ep-source.example/db').identity);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('pacchetto completo: immagini incluse, verifica hash e ripristino in storage vuoto',async()=>{
 const {archiveBundle,openBundle,restoreMedia,mediaKeysFromDump}=await import('../scripts/backup/bundle.mjs');
 const dir=await mkdtemp(join(tmpdir(),'slm-media-backup-'));try{
  const key='images/90000000-0000-4000-8000-000000000001.webp',data=new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]);
  const source={async get(k){assert.equal(k,key);return data.buffer;}};
  await writeFile(join(dir,'database.dump'),'placeholder database; PostgreSQL restore covered by integration drill');
  const {payload}=await archiveBundle(dir,[key],process.env,true,source),unpacked=join(dir,'unpacked');
  const {mkdir}=await import('node:fs/promises');await mkdir(unpacked);const manifest=await openBundle(unpacked,payload,process.env);assert.equal(manifest.mediaCount,1);assert.equal(manifest.files[0].key,key);
  const files=new Map(),target={async list(){return {blobs:[...files.keys()].map(key=>({key}))};},async set(k,value){files.set(k,value);},async delete(k){files.delete(k);}};
  const undo=await restoreMedia(unpacked,manifest,target);assert.deepEqual(new Uint8Array(files.get(key)),data);
  await assert.rejects(restoreMedia(unpacked,manifest,target),/RESTORE_MEDIA_TARGET_NOT_EMPTY/);await undo();assert.equal(files.size,0);
  assert.deepEqual(mediaKeysFromDump('COPY public.media (id, storage_key, alt) FROM stdin;\n90000000-0000-4000-8000-000000000001\t'+key+'\tLogo\n\\.\n'),[key]);
  await writeFile(join(unpacked,'media',manifest.files[0].name),'changed');
  const corrupted=join(dir,'corrupt.tar');const {run}=await import('../scripts/backup/core.mjs');await run('tar',['-cf',corrupted,'-C',unpacked,'database.dump','manifest.json','media'],process.env);const second=join(dir,'second');await mkdir(second);await assert.rejects(openBundle(second,corrupted,process.env),/INVALID_BACKUP_MEDIA/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
