import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import sharp from 'sharp';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {prepareImage,maxUpload} from '../src/server/media/image.ts';
import {mediaService} from '../src/server/media/service.ts';
import {contentService} from '../src/server/content/service.ts';
import {clubContentService} from '../src/server/club-content/service.ts';
import {safeImageUrl} from '../src/shared/media.ts';
const admin={userId:'media-admin',grants:[{role:'admin',categoryId:null}]};
const category='20000000-0000-4000-8000-000000000001';
const base={title:'Nuova notizia con copertina',excerpt:'Una notizia della società per tutti.',body:'Un articolo completo con una fotografia autorizzata.',status:'draft',featured:false,categoryId:category};
const image=await sharp({create:{width:80,height:40,channels:4,background:{r:0,g:100,b:50,alpha:.5}}}).png().withMetadata({orientation:6}).toBuffer();
test('immagini: verifica del file reale, rimozione metadati, limiti e URL',async()=>{
 const prepared=await prepareImage(image),meta=await sharp(prepared).metadata();assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);assert.equal(meta.orientation,undefined);assert.equal(meta.hasAlpha,true);
 const large=await sharp({create:{width:2500,height:10,channels:3,background:'green'}}).png().toBuffer();assert.ok((await sharp(await prepareImage(large)).metadata()).width<=2048);
 for(const data of [new Uint8Array(maxUpload+1),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),Buffer.from('fake jpeg')])await assert.rejects(prepareImage(data));
 for(const url of ['https://localhost.','//attacker.example/file','javascript:alert(1)','https://example.com/photo?token=secret','/media/not-an-id.webp'])assert.equal(safeImageUrl(url),null);
});
test('media e contenuti: consenso, ruoli, copertine, sponsor, cancellazioni e rollback',async t=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));await pg.exec("INSERT INTO users(id,name,email) VALUES ('media-admin','Admin','media@example.test')");
  const files=new Map(),store={async put(k,v){files.set(k,new Uint8Array(v).buffer);},async get(k){return files.get(k)??null;},async remove(k){files.delete(k);}};
  const db=drizzle(pg),service=mediaService(db,store),news=contentService(db),club=clubContentService(db),data=await prepareImage(image);let id,articleId;
  const item=async()=>(await service.list(admin)).items.find(m=>m.id===id);
  await t.test('caricamento amministrativo, consenso obbligatorio e niente pubblicazione implicita',async()=>{
   for(const role of ['editor','category_manager'])await assert.rejects(service.create({...admin,grants:[{role,categoryId:role==='category_manager'?category:null}]},{alt:'Una foto',consent:true},data),e=>e.status===403);
   await assert.rejects(service.create(admin,{alt:'Una foto',consent:false},data));assert.equal(files.size,0);
   id=(await service.create(admin,{alt:'Una foto della società',consent:true},data)).id;assert.equal(files.size,1);assert.equal(await service.file(id),null);assert.ok(await service.file(id,admin));
   assert.equal((await news.options(admin.grants)).media[0].id,id);
  });
  await t.test('bozza nascosta, copertina visibile solo dopo la pubblicazione',async()=>{
   const before=await item();articleId=(await news.createNews(admin,{...base,coverId:id})).id;assert.notEqual((await item()).version,before.version);assert.equal(await service.file(id),null);
   const draft=(await news.listAdminNews(admin.grants)).items.find(a=>a.id===articleId);const {categoryId,...fields}=base;await news.updateNews(admin,{...fields,id:articleId,coverId:id,version:draft.version,status:'published'});
   const article=(await news.listPublicNews()).items.find(a=>a.id===articleId);assert.equal(article.coverUrl,'/media/'+id+'.webp');assert.ok(await service.file(id));
   await assert.rejects(service.remove(admin,{id,version:(await item()).version}),e=>e.status===409);
  });
  await t.test('revoca immediata nelle letture pubbliche e aggiornamenti obsoleti rifiutati',async()=>{
   const row=await item();await service.update(admin,{id,version:row.version,alt:row.alt,consent:false});await assert.rejects(service.update(admin,{id,version:row.version,alt:row.alt,consent:true}),e=>e.status===409);
   assert.equal(await service.file(id),null);assert.ok(await service.file(id,admin));assert.equal((await news.listPublicNews()).items.find(a=>a.id===articleId).coverUrl,null);
   await assert.rejects(news.createNews(admin,{...base,coverId:id}),e=>e.status===400);
   const current=await item();await service.update(admin,{id,version:current.version,alt:current.alt,consent:true});
  });
  await t.test('logo sponsor locale supportato e immagine collegata protetta dalla cancellazione',async()=>{
   const sponsor=await club.createSponsor(admin,{name:'Partner di prova',description:null,website:null,tier:'Partner',logoId:id,sortOrder:0,active:true});assert.equal((await club.publicSponsors())[0].logoUrl,'/media/'+id+'.webp');
   await news.deleteNews(admin,{id:articleId,version:(await news.listAdminNews(admin.grants)).items.find(a=>a.id===articleId).version});
   await assert.rejects(service.remove(admin,{id,version:(await item()).version}),e=>e.status===409);
   const partner=(await club.sponsors(admin)).items.find(s=>s.id===sponsor.id);await club.deleteSponsor(admin,{id:partner.id,version:partner.version});
   await service.remove(admin,{id,version:(await item()).version});assert.equal(files.size,0);assert.equal(await service.file(id),null);
  });
  await t.test('quota della libreria: limite raggiunto senza file orfani',async()=>{
   await pg.exec("INSERT INTO media(storage_key,url,alt,mime_type,size_bytes,publication_consent) SELECT 'quota-'||i,'https://example.com/'||i||'.png','Foto quota','image/png',100,false FROM generate_series(1,500) i");
   await assert.rejects(service.create(admin,{alt:'Foto oltre limite',consent:true},data),e=>e.status===409);assert.equal(files.size,0);
   await pg.exec("DELETE FROM media WHERE storage_key LIKE 'quota-%'");
  });
  await t.test('inserimento database fallito rimuove il file e mancato storage non crea record',async()=>{
   const brokenDB={execute(){throw new Error('db failed');}};await assert.rejects(mediaService(brokenDB,store).create(admin,{alt:'Una foto',consent:true},data));assert.equal(files.size,0);
   await assert.rejects(mediaService(db,{...store,async put(){throw new Error('storage failed');}}).create(admin,{alt:'Una foto',consent:true},data));assert.equal((await service.list(admin)).items.length,0);
  });
 }finally{await pg.close();}
});
