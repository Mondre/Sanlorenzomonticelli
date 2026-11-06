import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {parseSports} from '../src/server/sports-import/parser.ts';
import {fetchPage,fetchSports} from '../src/server/sports-import/fetch.ts';
import {sportsImportService} from '../src/server/sports-import/service.ts';
import {sportSource,isStale,retrySeconds} from '../src/shared/sports-import.ts';
import {SourceError,importDiagnostic} from '../src/server/sports-import/diagnostics.ts';
const calendar=await readFile(new URL('./fixtures/romagna-calendar.html',import.meta.url),'utf8');
const standings=await readFile(new URL('./fixtures/romagna-standings.html',import.meta.url),'utf8');
const stamp='2026-11-06T12:00:00.000Z';
const snapshot=()=>parseSports(calendar,standings,stamp);
test('estrazione sportiva da fixture ridotte: 30 gare, 16 squadre, nessun dato personale',()=>{
 const data=snapshot();assert.equal(data.matches.length,30);assert.equal(data.standings.length,16);
 assert.equal(data.matches[0].away.id,'13497');assert.equal(data.matches[0].homeScore,2);assert.equal(data.matches[0].awayScore,1);
 assert.equal(retrySeconds('2026-11-06T12:15:00Z',new Date(stamp).getTime()),900);assert.equal(retrySeconds(stamp,new Date(stamp).getTime()+1000),0);
 const unknown=data.matches.find(m=>m.status==='not_available');assert.equal(unknown.homeScore,null);assert.equal(unknown.awayScore,null);
 assert.ok(data.matches.every(m=>m.home.id==='13497'||m.away.id==='13497'));
 assert.deepEqual(data.matches.map(m=>m.id),snapshot().matches.map(m=>m.id));
 assert.doesNotMatch(JSON.stringify(data),/img|photo|giocatore|email|telefono|script|http/);
 assert.equal(isStale(data,new Date(stamp).getTime()+25*3600000),true);
});
test('parser rifiuta stagione diversa, pagine incomplete, duplicati, risultati ambigui e classifica incoerente',()=>{
 const invalid=[
  [calendar,standings.replace('2026/2027','2025/2026')],
  [calendar.replace('1a giornata','2a giornata'),standings],
  [calendar.replace('N.G.','Live'),standings],
  [calendar.replace('13/09/2026','31/02/2026'),standings],
  [calendar.replace('13/09/2026','13/09/2027'),standings],
  [calendar.replace(/<a href="[^"]+id_squadra=13497">/, '<a href="https://other.example/tuttocalcio/squadra.php?id_squadra=13497">'),standings],
  [calendar,standings.replace('<td>21</td><td>9</td>','<td>21</td><td>8</td>')],
  ['<h1>Verifica browser</h1>',standings],
 ];
 for(const [c,s] of invalid)assert.throws(()=>parseSports(c,s,stamp));
});
test('fetch: URL fissi, niente redirect, richieste limitate e controllo risposte',async()=>{
 const urls=[];
 const data=await fetchSports(async(url,options)=>{
  urls.push(url);assert.equal(options.redirect,'error');assert.ok(options.signal);
  return new Response(url===sportSource.calendarUrl?calendar:standings,{headers:{'Content-Type':'text/html; charset=utf-8'}});
 });
 assert.deepEqual(urls,[sportSource.calendarUrl,sportSource.standingsUrl]);assert.equal(data.matches.length,30);
 for(const response of [new Response('',{status:202,headers:{'Content-Type':'text/html'}}),new Response('{}',{headers:{'Content-Type':'application/json'}}),new Response('x'.repeat(1_000_001),{headers:{'Content-Type':'text/html'}})])await assert.rejects(fetchPage(sportSource.calendarUrl,async()=>response));
 await assert.rejects(fetchSports(async()=>new Response('challenge',{headers:{'Content-Type':'text/html'}})));
 const latin=await fetchPage(sportSource.calendarUrl,async()=>new Response(new Uint8Array([0xe8]),{headers:{'Content-Type':'text/html; charset=ISO-8859-1'}}));assert.equal(latin,'è');
});
test('sincronizzazione persistente: attivazione, cooldown, atomicità e ultimo dato valido',async t=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,name,email,email_verified) VALUES ('sport-admin','Admin','sport@example.test',true)");
  const actor={userId:'sport-admin',grants:[{role:'admin',categoryId:null}]},db=drizzle(pg);let calls=0;
  const service=sportsImportService(db,async()=>{calls++;return snapshot();});
  const expire=()=>pg.exec("UPDATE site_settings SET updated_at=now()-interval '16 minutes' WHERE key='sports.romagnasport.attempt'");
  await t.test('disattivato inizialmente e ruoli limitati esclusi',async()=>{
   assert.equal((await service.state()).enabled,false);assert.equal(await service.publicSnapshot(),null);
   await assert.rejects(service.refresh(actor),e=>e.status===409);assert.equal(calls,0);
   for(const role of ['editor','category_manager']){
    const other={...actor,grants:[{role,categoryId:null}]};await assert.rejects(service.configure(other,{enabled:true}),e=>e.status===403);await assert.rejects(service.refresh(other),e=>e.status===403);
   }
   await service.configure(actor,{enabled:true});
  });
  await t.test('salva solo dati essenziali e limita i tentativi concorrenti',async()=>{
   const outcomes=await Promise.allSettled([service.refresh(actor),service.refresh(actor)]);
   assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,1);
   assert.equal(outcomes.find(r=>r.status==='rejected').reason.status,429);
   assert.deepEqual(await service.publicSnapshot(),snapshot());
   await assert.rejects(service.refresh(actor),e=>e.status===429);assert.equal(calls,1);
   const state=await service.state();assert.ok(state.retryAt);assert.ok(retrySeconds(state.retryAt)>0);
  });
  await t.test('ripetere la sincronizzazione non duplica gare o classifica',async()=>{
   await expire();await service.refresh(actor);assert.equal(calls,2);
   assert.equal((await service.state()).snapshot.matches.length,30);
   assert.equal((await pg.query("SELECT * FROM site_settings WHERE key='sports.romagnasport.2026'")).rows.length,1);
  });
  await t.test('fallimento conserva il precedente snapshot e non espone errori interni',async()=>{
   await expire();const broken=sportsImportService(db,async()=>{throw new Error('private-query-and-password');});
   await assert.rejects(broken.refresh(actor),e=>e.status===503&&!e.message.includes('private-query'));
   const state=await service.state();assert.deepEqual(state.snapshot,snapshot());assert.ok(state.lastError);assert.equal(state.lastErrorCode,'SOURCE_REQUEST_FAILED');assert.ok(state.lastErrorReference);await assert.rejects(service.refresh(actor),e=>e.status===429&&e.message.includes('SOURCE_REQUEST_FAILED'));assert.doesNotMatch(JSON.stringify(state),/private-query-and-password/);
   await expire();await service.refresh(actor);assert.equal((await service.state()).lastError,null);
  });
  await t.test('disattivare nasconde i dati senza cancellarli e audit essenziale',async()=>{
   await service.configure(actor,{enabled:false});assert.equal(await service.publicSnapshot(),null);assert.ok((await service.state()).snapshot);
   const audit=(await pg.query("SELECT metadata FROM audit_logs WHERE action='sports_import.refresh'")).rows;
   assert.equal(audit.length,3);assert.deepEqual(audit[0].metadata,{season:'2026/2027',matches:30,teams:16});
  });
 }finally{await pg.close();}
});


test('diagnostica distingue errori della fonte e salvataggio senza esporre dettagli interni',async()=>{
 for(const [error,phase,code] of [[new SourceError('SOURCE_HTTP_ERROR','calendar',403),'source','SOURCE_HTTP_ERROR'],[new Error('password=secret SQL SELECT'), 'save','DATABASE_WRITE_FAILED'],[new SourceError('SOURCE_TIMEOUT','standings'),'source','SOURCE_TIMEOUT']]){
  const diagnostic=importDiagnostic(error,phase,'test-reference');assert.equal(diagnostic.code,code);assert.equal(diagnostic.reference,'test-reference');assert.doesNotMatch(JSON.stringify(diagnostic),/password|secret|SELECT/);
 }
 await assert.rejects(fetchPage(sportSource.calendarUrl,async()=>new Response('',{status:403,headers:{'Content-Type':'text/html'}})),e=>e.code==='SOURCE_HTTP_ERROR'&&e.stage==='calendar'&&e.httpStatus===403);
 await assert.rejects(fetchPage(sportSource.standingsUrl,async()=>{throw new DOMException('private info','TimeoutError');}),e=>e.code==='SOURCE_TIMEOUT'&&e.stage==='standings');
 await assert.rejects(fetchPage(sportSource.calendarUrl,async()=>new Response('cf-chl-test',{headers:{'Content-Type':'text/html'}})),e=>e.code==='SOURCE_CHALLENGE');
});
