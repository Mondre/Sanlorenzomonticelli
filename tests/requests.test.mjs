import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {requestService} from '../src/server/requests/service.ts';
import {ipDigest,issueChallenge,verifyChallenge} from '../src/server/requests/security.ts';
const secret='test-only-request-secret-0000000000000000',ip='192.0.2.20';
const actor={userId:'request-admin',grants:[{role:'admin',categoryId:null}]};
const policy={enabled:true,controllerName:'Società Test',controllerAddress:'Via Test 1, Comune Test',contactEmail:'privacy@example.test',body:'Informativa approvata solo per il database di test. '.repeat(8),retentionDays:90,expectedVersion:null};
const category='20000000-0000-4000-8000-000000000001';
test('challenge firmata: IP, versione, scadenza e tempo minimo',()=>{
 const now=Date.now(),hash=ipDigest(secret,ip),version=randomUUID(),token=issueChallenge(secret,hash,version,now);
 verifyChallenge(secret,hash,version,token,now+4000);
 assert.throws(()=>verifyChallenge(secret,hash,version,token,now+500),e=>e.status===400);
 assert.throws(()=>verifyChallenge(secret,hash,version,token,now+31*60_000),e=>e.status===400);
 assert.throws(()=>verifyChallenge(secret,ipDigest(secret,'192.0.2.21'),version,token,now+4000));
 assert.throws(()=>verifyChallenge(secret,hash,randomUUID(),token,now+4000));
 assert.throws(()=>verifyChallenge(secret,hash,version,token.slice(0,-1)+'x',now+4000));
 assert.throws(()=>ipDigest(secret,'not-an-ip'),e=>e.status===503);
 assert.equal(ipDigest(secret,'2001:0db8::1'),ipDigest(secret,'2001:db8:0:0:0:0:0:1'));
});
test('richieste PostgreSQL: privacy, invio, antispam, autorizzazioni e cancellazione',async t=>{
 const pg=new PGlite();
 try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));
  await pg.query("INSERT INTO users(id,name,email) VALUES ('request-admin','Test Admin','requests@example.test')");
  const service=requestService(drizzle(pg));let current,form;
  const data=()=>({requestId:randomUUID(),contactName:'Referente adulto',email:'referente@example.test',phone:null,categoryId:category,message:'Vorrei informazioni per una prova nella categoria.',type:'trial',consent:true,privacyVersion:current.version,challenge:form.challenge,website:''});
  await t.test('modulo disattivato finché l’informativa non è pubblicata',async()=>{
   assert.equal(await service.publicPolicy(),null);await assert.rejects(service.form(secret,ip),e=>e.status===503);
   await assert.rejects(service.saveSettings(actor,{...policy,body:'breve'}));
   current=await service.saveSettings(actor,policy);assert.equal((await service.publicPolicy()).version,current.version);
   assert.equal((await pg.query('SELECT * FROM request_privacy_versions')).rows.length,1);
   form=await service.form(secret,ip);assert.ok(form.categories.length>0);
  });
  await t.test('richiesta salvata con versione dell’informativa e senza IP in chiaro',async()=>{
   await service.submit(data(),secret,ip,Date.now()+4000);
   const {rows}=await pg.query('SELECT * FROM registration_requests');assert.equal(rows.length,1);assert.equal(rows[0].privacy_record_id,current.version);assert.equal(rows[0].status,'new');
   const limits=await pg.query('SELECT * FROM request_rate_limits');assert.match(limits.rows[0].key,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(limits.rows),/192\.0\.2\.20/);
   assert.equal((await pg.query('SELECT * FROM audit_logs WHERE entity_id=$1',[rows[0].id])).rows.length,1);
  });
  await t.test('reinvio idempotente non duplica dati o contatori',async()=>{
   const request=data();await service.submit(request,secret,ip,Date.now()+4000);await service.submit(request,secret,ip,Date.now()+4000);
   assert.equal((await pg.query('SELECT * FROM registration_requests')).rows.length,2);
   assert.equal((await pg.query('SELECT count FROM request_rate_limits')).rows[0].count,2);
  });
  await t.test('rate limit persistente blocca il quarto invio nella finestra',async()=>{
   await service.submit(data(),secret,ip,Date.now()+4000);await assert.rejects(service.submit(data(),secret,ip,Date.now()+4000),e=>e.status===429);
   assert.equal((await pg.query('SELECT * FROM registration_requests')).rows.length,3);
  });
  await t.test('honeypot, consenso mancante, campi extra e categoria non attiva rifiutati',async()=>{
   await assert.rejects(service.submit({...data(),website:'spam.example'},secret,ip,Date.now()+4000),e=>e.status===400);
   await assert.rejects(service.submit({...data(),consent:false},secret,ip,Date.now()+4000));
   await assert.rejects(service.submit({...data(),childBirthDate:'2015-01-01'},secret,ip,Date.now()+4000));
   await pg.query('UPDATE categories SET active=false WHERE id=$1',[category]);await assert.rejects(service.submit(data(),secret,ip,Date.now()+4000),e=>e.status===400);await pg.query('UPDATE categories SET active=true WHERE id=$1',[category]);
  });
  await t.test('nuova informativa invalida form precedenti senza perdere lo storico',async()=>{
   const old=data();const previous=current;current=await service.saveSettings(actor,{...policy,expectedVersion:current.version,retentionDays:180});
   await assert.rejects(service.submit(old,secret,ip,Date.now()+4000),e=>e.status===409);
   await assert.rejects(service.saveSettings(actor,{...policy,expectedVersion:previous.version}),e=>e.status===409);
   assert.equal((await pg.query('SELECT * FROM request_privacy_versions')).rows.length,2);assert.equal((await pg.query('SELECT retention_days FROM request_privacy_versions WHERE id=$1',[previous.version])).rows[0].retention_days,90);
   form=await service.form(secret,ip);
  });
  await t.test('richieste e impostazioni inaccessibili a redattori e responsabili categoria',async()=>{
   for(const role of ['editor','category_manager']){const user={userId:actor.userId,grants:[{role,categoryId:category}]};await assert.rejects(service.list(user),e=>e.status===403);await assert.rejects(service.settings(user),e=>e.status===403);await assert.rejects(service.saveSettings(user,{...policy,expectedVersion:current.version}),e=>e.status===403);}
  });
  await t.test('presa in carico, conflitto di versione e cancellazione personale',async()=>{
   const item=(await service.list(actor)).items[0];await service.update(actor,{id:item.id,version:item.version,status:'in_progress'});await assert.rejects(service.update(actor,{id:item.id,version:item.version,status:'closed'}),e=>e.status===409);
   const updated=(await service.list(actor)).items.find(r=>r.id===item.id);assert.equal(updated.status,'in_progress');await service.remove(actor,{id:updated.id,version:updated.version});assert.equal((await pg.query('SELECT * FROM registration_requests WHERE id=$1',[item.id])).rows.length,0);
  });
  await t.test('reinvii simultanei: una sola richiesta e quota consumata una volta',async()=>{
   const anotherIp='192.0.2.80',f=await service.form(secret,anotherIp),request={...data(),challenge:f.challenge};
   await Promise.all([service.submit(request,secret,anotherIp,Date.now()+4000),service.submit(request,secret,anotherIp,Date.now()+4000)]);
   assert.equal((await pg.query('SELECT count FROM request_rate_limits WHERE key=$1',[ipDigest(secret,anotherIp)])).rows[0].count,1);
   assert.equal((await pg.query('SELECT * FROM registration_requests WHERE message=$1',[request.message])).rows.length,3);
  });
  await t.test('pulizia applica la durata originaria e rimuove digest scaduti',async()=>{
   await pg.query("UPDATE registration_requests SET created_at=now()-interval '100 days' WHERE privacy_version<>$1",[current.version]);
   await pg.query("UPDATE request_rate_limits SET window_started=now()-interval '2 days'");
   const before=(await service.list(actor)).items.length,result=await service.purge();assert.ok(result.requests>0);assert.ok(result.limits>0);assert.ok((await service.list(actor)).items.length<before);
   assert.equal((await pg.query('SELECT * FROM request_privacy_versions')).rows.length,2);
  });
 }finally{await pg.close();}
});
