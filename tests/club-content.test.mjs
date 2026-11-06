import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {clubContentService} from '../src/server/club-content/service.ts';
import {publicHttpsUrl,mapsLink} from '../src/shared/club-content.ts';
const actor={userId:'club-admin',grants:[{role:'admin',categoryId:null}]};
const sponsor={name:"Sponsor d'esempio",description:'Partner locale',website:'https://example.com',tier:'Partner',logoId:null,sortOrder:0,active:true};
const venue={name:'Campo centrale',address:'Via dello Sport 1',city:'Monticelli',directions:'Ingresso principale',parking:null};
test('URL pubblici e mappe controllati',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://localhost','https://127.0.0.1','https://2130706433','https://foo.local.'])assert.equal(publicHttpsUrl(url),null);
 assert.equal(publicHttpsUrl('https://example.com'),'https://example.com/');
 assert.equal(new URL(mapsLink(venue)).searchParams.get('query'),'Campo centrale, Via dello Sport 1, Monticelli');
});
test('sponsor e campi: persistenza, autorizzazioni e concorrenza',async t=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,name,email,email_verified) VALUES ('club-admin','Admin','club@example.test',true)");
  const service=clubContentService(drizzle(pg));let id;
  await t.test('solo amministratori possono modificare',async()=>{
   for(const role of ['editor','category_manager']){
    const restricted={...actor,grants:[{role,categoryId:null}]};
    await assert.rejects(service.createSponsor(restricted,sponsor),e=>e.status===403);
    await assert.rejects(service.venues(restricted),e=>e.status===403);
   }
  });
  await t.test('pubblica solo sponsor attivi e protegge da aggiornamenti obsoleti',async()=>{
   id=(await service.createSponsor(actor,sponsor)).id;
   await service.createSponsor(actor,{...sponsor,name:'Riservato',active:false});
   const visible=await service.publicSponsors();assert.equal(visible.length,1);assert.equal(visible[0].name,sponsor.name);assert.equal('version' in visible[0],false);
   const row=(await service.sponsors(actor)).items.find(r=>r.id===id);
   const update={...sponsor,id,version:row.version,active:false};await service.updateSponsor(actor,update);
   await assert.rejects(service.updateSponsor(actor,update),e=>e.status===409);
   assert.equal((await service.publicSponsors()).length,0);
   const current=(await service.sponsors(actor)).items.find(r=>r.id===id);await service.deleteSponsor(actor,{id,version:current.version});
   assert.equal((await pg.query("SELECT * FROM audit_logs WHERE action='sponsor.update'")).rows.length,1);
  });
  await t.test('consenso e formato del logo controllati anche nelle letture pubbliche',async()=>{
   const media='90000000-0000-4000-8000-000000000001';
   await pg.query("INSERT INTO media(id,storage_key,url,alt,mime_type,size_bytes,publication_consent) VALUES ($1,'logo-test','https://example.com/logo.png','Logo','image/png',100,true)",[media]);
   const created=await service.createSponsor(actor,{...sponsor,logoId:media});assert.equal((await service.publicSponsors())[0].logoUrl,'https://example.com/logo.png');
   await pg.query('UPDATE media SET publication_consent=false WHERE id=$1',[media]);assert.equal((await service.publicSponsors())[0].logoUrl,null);
   await assert.rejects(service.createSponsor(actor,{...sponsor,logoId:media}),e=>e.status===400);
   await pg.query("UPDATE media SET publication_consent=true,mime_type='image/svg+xml' WHERE id=$1",[media]);
   await assert.rejects(service.createSponsor(actor,{...sponsor,logoId:media}),e=>e.status===400);
   assert.equal((await service.sponsors(actor)).logos.length,0);assert.ok(created.id);
  });
  await t.test('campi: conflitti rilevati e rimozione vietata quando usati dalle partite',async()=>{
   const {id}=await service.createVenue(actor,venue);const row=(await service.venues(actor)).items.find(r=>r.id===id);
   await service.updateVenue(actor,{...venue,id,version:row.version,name:'Campo aggiornato'});
   await assert.rejects(service.updateVenue(actor,{...venue,id,version:row.version}),e=>e.status===409);
   await pg.query('UPDATE matches SET venue_id=$1',[id]);
   const current=(await service.venues(actor)).items.find(r=>r.id===id);assert.equal(current.matchesCount,1);
   await assert.rejects(service.deleteVenue(actor,{id,version:current.version}),e=>e.status===409);
   assert.equal((await service.publicVenues()).length,1);
   await pg.exec('UPDATE matches SET venue_id=NULL');await service.deleteVenue(actor,{id,version:current.version});assert.equal((await service.publicVenues()).length,0);
  });
 }finally{await pg.close();}
});
