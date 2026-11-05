import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {contentService} from '../src/server/content/service.ts';
import {standingsFor} from '../src/server/content/standings.ts';
import {ContentError} from '../src/server/content/errors.ts';
import {mutationOrigin,readInput,contentFailure} from '../src/server/content/request.ts';
const category='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const fixture={competitionId:'40000000-0000-4000-8000-000000000001',homeTeamId:'30000000-0000-4000-8000-000000000001',awayTeamId:'30000000-0000-4000-8000-000000000002',kickoff:'2099-10-25T14:30:00.000Z',round:2,venueId:null,status:'scheduled',homeScore:null,awayScore:null,report:null};
const base={title:'La notizia della società',excerpt:'Un aggiornamento per tutti i nostri sostenitori.',body:'Questo è il testo completo della notizia, senza contenuti dimostrativi nel sito pubblico.',status:'draft',publishAt:null,featured:false,categoryId:category};
const admin={userId:'content-admin',grants:[{role:'super_admin',categoryId:null}]};
const manager={userId:'content-admin',grants:[{role:'category_manager',categoryId:category}]};
const editor={userId:'content-admin',grants:[{role:'editor',categoryId:category}]};
const forbidden=e=>e instanceof ContentError&&e.status===403;
test('notizie e partite su PostgreSQL: CRUD, visibilità, scope, audit e conflitti',async t=>{
 const pg=new PGlite();
 try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));
  await pg.query("INSERT INTO users(id,name,email) VALUES ('content-admin','Test Admin','content@example.test')");
  const service=contentService(drizzle(pg));
  let articleId,foreignId,scheduledId,createdMatch;
  await t.test('bozze private, testo con apici parametrizzato e slug stabile',async()=>{
   const created=await service.createNews(admin,{...base,title:"Una vittoria d'orgoglio: è festa!",body:'Testo sicuro anche con <script>alert(1)</script> che sarà mostrato come testo.'});articleId=created.id;
   const list=await service.listAdminNews(admin.grants);const article=list.items.find(a=>a.id===articleId);
   assert.match(article.slug,/una-vittoria-d-orgoglio-e-festa/);
   assert.match(article.body,/<script>/);
   assert.equal(await service.article(article.slug),null);
   assert.equal((await service.listPublicNews()).items.length,0);
   await assert.rejects(service.createNews(admin,{...base,authorId:'injected-user'}));
  });
  await t.test('pubblicazione immediata e programmata senza cron',async()=>{
   const article=(await service.listAdminNews(admin.grants)).items.find(a=>a.id===articleId);
   const {id,version,title,excerpt,body,featured}=article;
   await service.updateNews(manager,{id,version,title,excerpt,body,featured,status:'published',publishAt:null});
   assert.ok((await service.listPublicNews()).items.some(a=>a.id===articleId));
   scheduledId=(await service.createNews(admin,{...base,title:'La pubblicazione programmata',status:'scheduled',publishAt:'2099-01-01T12:00:00.000Z'})).id;
   assert.equal((await service.listPublicNews()).items.some(a=>a.id===scheduledId),false);
   await pg.query('UPDATE news SET publish_at=$1 WHERE id=$2',['2000-01-01T12:00:00Z',scheduledId]);
   assert.equal((await service.listPublicNews()).items.some(a=>a.id===scheduledId),true);
   await assert.rejects(service.createNews(admin,{...base,status:'scheduled',publishAt:null}),e=>e.status===400);
  });
  await t.test('scope categoria, inclusa notizia con più categorie',async()=>{
   foreignId=(await service.createNews(admin,{...base,categoryId:other})).id;
   await assert.rejects(service.createNews(manager,{...base,categoryId:other}),forbidden);
   assert.equal((await service.listAdminNews(manager.grants)).items.some(a=>a.id===foreignId),false);
   const foreign=(await service.listAdminNews(admin.grants)).items.find(a=>a.id===foreignId);
   await assert.rejects(service.deleteNews(manager,{id:foreign.id,version:foreign.version}),forbidden);
   await pg.query('INSERT INTO news_categories(news_id,category_id) VALUES ($1,$2)',[articleId,other]);
   assert.equal((await service.listAdminNews(manager.grants)).items.some(a=>a.id===articleId),false);
   const article=(await service.listAdminNews(admin.grants)).items.find(a=>a.id===articleId);
   await assert.rejects(service.updateNews(manager,{id:article.id,version:article.version,title:article.title,excerpt:article.excerpt,body:article.body,status:'draft',publishAt:null,featured:false}),forbidden);
   await pg.query('DELETE FROM news_categories WHERE news_id=$1 AND category_id=$2',[articleId,other]);
  });
  await t.test('versione obsoleta rifiutata senza audit fittizio',async()=>{
   const article=(await service.listAdminNews(admin.grants)).items.find(a=>a.id===articleId);
   const input={id:article.id,version:article.version,title:article.title,excerpt:article.excerpt,body:article.body,status:'published',publishAt:article.publishAt,featured:false};
   await service.updateNews(admin,input);
   const before=(await pg.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='news.update'")).rows[0].count;
   await assert.rejects(service.updateNews(admin,input),e=>e.status===409);
   const after=(await pg.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='news.update'")).rows[0].count;
   assert.equal(after,before);
  });
  await t.test('ricerca e filtri non trattano percentuali o SQL come istruzioni',async()=>{
   await service.createNews(admin,{...base,title:'Una notizia al 100% speciale',status:'published'});
   const found=await service.listPublicNews({search:'100%'});assert.equal(found.items.length,1);
   assert.equal((await service.listPublicNews({search:"' OR 1=1 --"})).items.length,0);
   assert.equal((await service.listPublicNews({categoryId:other})).items.length,0);
   await assert.rejects(service.listPublicNews({page:-1}),e=>e.status===400);
  });
  await t.test('partita creata e aggiornata, risultato incluso nella classifica',async()=>{
   createdMatch=(await service.createMatch(manager,fixture)).id;
   assert.ok((await service.listPublicMatches({mode:'upcoming'})).items.some(m=>m.id===createdMatch));
   const match=(await service.listAdminMatches(manager.grants)).items.find(m=>m.id===createdMatch);
   const update={id:match.id,version:match.version,kickoff:'2026-10-25T14:30:00.000Z',round:2,venueId:null,status:'finished',homeScore:3,awayScore:0,report:'La cronaca della partita.'};
   await service.updateMatch(manager,update);
   assert.ok((await service.listPublicMatches({mode:'results'})).items.some(m=>m.id===createdMatch));
   const ranking=await standingsFor(drizzle(pg),fixture.competitionId);
   assert.equal(ranking.items.find(row=>row.teamId===fixture.homeTeamId).points,6);
   assert.equal(ranking.items[0].name,'San Lorenzo — DEMO');
   await assert.rejects(service.updateMatch(manager,update),e=>e.status===409);
  });
  await t.test('risultati invalidi e utenti senza scope rifiutati',async()=>{
   await assert.rejects(service.createMatch(editor,fixture),forbidden);
   await assert.rejects(service.createMatch(admin,{...fixture,status:'finished'}));
   await assert.rejects(service.createMatch(admin,{...fixture,awayTeamId:fixture.homeTeamId}));
   const scopedOther={...manager,grants:[{role:'category_manager',categoryId:other}]};
   assert.equal((await service.listAdminMatches(scopedOther.grants)).items.length,0);
   await assert.rejects(service.createMatch(scopedOther,fixture),forbidden);
   const opts=await service.options(editor.grants);assert.equal(opts.competitions.length,0);assert.equal(opts.categories[0].news,true);assert.equal(opts.categories[0].matches,false);
  });
  await t.test('eliminazione notizia rimuove relazioni e scrive audit',async()=>{
   const article=(await service.listAdminNews(admin.grants)).items.find(a=>a.id===articleId);
   await service.deleteNews(admin,{id:article.id,version:article.version});
   assert.equal(await service.article(article.slug),null);
   assert.equal((await pg.query('SELECT * FROM news_categories WHERE news_id=$1',[article.id])).rows.length,0);
   assert.equal((await pg.query("SELECT * FROM audit_logs WHERE entity_id=$1 AND action='news.delete'",[article.id])).rows.length,1);
  });
  await t.test('paginazione applicata dopo lo scope',async()=>{
   for(let i=0;i<27;i++)await service.createNews(admin,{...base,title:'Notizia della categoria '+i,categoryId:other});
   const own=await service.listAdminNews(manager.grants);assert.ok(own.items.every(a=>a.categoryIds.includes(category)));assert.equal(own.hasMore,false);
   const first=await service.listAdminNews(admin.grants,1),second=await service.listAdminNews(admin.grants,2);assert.equal(first.items.length,25);assert.equal(first.hasMore,true);assert.ok(second.items.length>0);
   assert.equal(new Set([...first.items,...second.items].map(a=>a.id)).size,first.items.length+second.items.length);
  });
 }finally{await pg.close();}
});
test('API mutazioni: origine, formato JSON, dimensione e messaggi sicuri',async()=>{
 assert.throws(()=>mutationOrigin(new Request('https://club.example',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'}}),'https://club.example'),e=>e.status===403);
 assert.throws(()=>mutationOrigin(new Request('https://club.example',{method:'POST',headers:{Origin:'https://club.example','Content-Type':'text/plain'}}),'https://club.example'),e=>e.status===415);
 await assert.rejects(readInput(new Request('https://club.example',{method:'POST',body:'x'.repeat(65537)})),e=>e.status===413);
 await assert.rejects(readInput(new Request('https://club.example',{method:'POST',body:'invalid'})),e=>e.status===400);
 const response=contentFailure(new Error('postgres://sensitive-connection'));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/postgres|sensitive/);
});
