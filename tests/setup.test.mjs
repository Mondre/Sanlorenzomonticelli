import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {setupService} from '../src/server/content/setup-service.ts';
import {contentService} from '../src/server/content/service.ts';
const admin={userId:'setup-user',grants:[{role:'admin',categoryId:null}]};
test('configurazione iniziale senza seed: categorie, stagione, competizione e campo',async t=>{
 const pg=new PGlite();
 try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.query("INSERT INTO users(id,name,email) VALUES ('setup-user','Test Admin','setup@example.test')");
  const db=drizzle(pg),service=setupService(db);let category,competition,season,venue;
  await t.test('creazione categoria senza pubblicare rose o dati personali',async()=>{
   category=(await service.createCategory(admin,{name:'Prima Squadra',sortOrder:1,active:true,isYouth:false})).id;
   const {rows}=await pg.query('SELECT publish_roster FROM categories WHERE id=$1',[category]);assert.equal(rows[0].publish_roster,false);
   assert.equal((await service.catalog(admin)).categories.length,1);
  });
  await t.test('stagione e partecipanti creati atomicamente',async()=>{
   competition=(await service.createCompetition(admin,{name:'Campionato provinciale',categoryId:category,seasonId:null,seasonName:'2026/27',startsOn:'2026-07-01',endsOn:'2027-06-30',clubName:'San Lorenzo',opponents:['Atletico Colle','Sporting Piano'],standingsEnabled:true})).id;
   const catalog=await service.catalog(admin);assert.equal(catalog.competitions.length,1);season=catalog.seasons[0].id;
   assert.equal((await pg.query('SELECT * FROM competition_teams WHERE competition_id=$1',[competition])).rows.length,3);
   assert.equal((await pg.query('SELECT * FROM teams WHERE is_club=true')).rows.length,1);
  });
  await t.test('stessa stagione riutilizza squadre e non duplica la rosa',async()=>{
   await service.createCompetition(admin,{name:'Coppa provinciale',categoryId:category,seasonId:season,seasonName:'',startsOn:null,endsOn:null,clubName:'San Lorenzo',opponents:['Atletico Colle'],standingsEnabled:false});
   assert.equal((await pg.query('SELECT * FROM seasons')).rows.length,1);assert.equal((await pg.query('SELECT * FROM teams')).rows.length,3);
  });
  await t.test('campo utilizzabile nella creazione di una partita reale',async()=>{
   venue=(await service.createVenue(admin,{name:'Campo comunale',address:'Via dello Sport 1',city:'Comune Test'})).id;
   const options=await contentService(db).options(admin.grants);const own=options.participants.find(p=>p.competitionId===competition&&p.name==='San Lorenzo'),away=options.participants.find(p=>p.competitionId===competition&&p.name==='Atletico Colle');
   const match=await contentService(db).createMatch(admin,{competitionId:competition,homeTeamId:own.teamId,awayTeamId:away.teamId,kickoff:'2099-11-01T14:00:00.000Z',round:1,venueId:venue,status:'scheduled',homeScore:null,awayScore:null,report:null});
   const publicMatch=await contentService(db).match(match.id);assert.equal(publicMatch.venue,'Campo comunale');assert.equal(publicMatch.city,'Comune Test');
  });
  await t.test('gestione iniziale vietata a responsabili categoria e redattori',async()=>{
   for(const role of ['category_manager','editor']){const restricted={userId:admin.userId,grants:[{role,categoryId:category}]};await assert.rejects(service.catalog(restricted),e=>e.status===403);await assert.rejects(service.createVenue(restricted,{name:'Campo',address:'Via Test',city:'Comune'}),e=>e.status===403);}
  });
  await t.test('date e nomi duplicati rifiutati, nessuna creazione parziale',async()=>{
   const before=(await service.catalog(admin)).competitions.length;
   await assert.rejects(service.createCompetition(admin,{name:'Competizione non valida',categoryId:category,seasonId:null,seasonName:'Stagione',startsOn:'2027-07-01',endsOn:'2026-06-30',clubName:'San Lorenzo',opponents:['San Lorenzo'],standingsEnabled:true}));
   assert.equal((await service.catalog(admin)).competitions.length,before);
  });
  await t.test('categoria disattivata non è disponibile per nuovi contenuti',async()=>{
   await service.updateCategory(admin,{id:category,name:'Prima Squadra',sortOrder:1,active:false,isYouth:false});
   assert.equal((await contentService(db).publicCategories()).length,0);
   await assert.rejects(contentService(db).createNews(admin,{title:'Notizia in categoria inattiva',excerpt:'Questa categoria non è più attiva.',body:'Testo completo della notizia di prova.',status:'draft',publishAt:null,featured:false,categoryId:category}),e=>e.status===400);
  });
 }finally{await pg.close();}
});

test('avvio senza competizione: categoria per le notizie, stagione autonoma per squadre e staff',async()=>{
 const {teamService}=await import('../src/server/teams/service.ts');
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.query("INSERT INTO users(id,name,email) VALUES ('setup-user','Test Admin','setup@example.test')");
  const db=drizzle(pg),setup=setupService(db),content=contentService(db),teams=teamService(db);
  assert.equal((await content.options(admin.grants)).categories.length,0);assert.equal((await teams.list(admin)).options.seasons.length,0);
  const category=(await setup.createCategory(admin,{name:'Prima Squadra',sortOrder:0,active:true,isYouth:false})).id;
  const options=await content.options(admin.grants);assert.equal(options.categories[0].news,true);assert.equal(options.competitions.length,0);
  await content.createNews(admin,{categoryId:category,title:'Prima notizia della società',excerpt:'Notizia senza dipendere da una competizione.',body:'Testo della prima notizia, senza stagioni e avversarie ancora configurate.',status:'draft'});
  const season=(await setup.createSeason(admin,{name:'2026/27',startsOn:'2026-07-01',endsOn:'2027-06-30'})).id;
  const team=(await teams.create(admin,{name:'San Lorenzo Monticelli',categoryId:category,seasonId:season,description:null,trainingSchedule:null})).id;
  await teams.addStaff(admin,{teamId:team,name:'Collaboratore di prova',role:'Allenatore',publish:false});
  assert.equal((await setup.catalog(admin)).competitions.length,0);assert.equal((await teams.list(admin)).items.length,1);
  for(const role of ['editor','category_manager'])await assert.rejects(setup.createSeason({userId:admin.userId,grants:[{role,categoryId:category}]},{name:'2027/28',startsOn:'2027-07-01',endsOn:'2028-06-30'}),e=>e.status===403);
  await assert.rejects(setup.createSeason(admin,{name:'Date errate',startsOn:'2027-07-01',endsOn:'2026-06-30'}));
  await assert.rejects(setup.createSeason(admin,{name:'2026/27',startsOn:'2026-07-01',endsOn:'2027-06-30'}));
  assert.equal((await setup.catalog(admin)).seasons.length,1);
  assert.equal((await pg.query("SELECT count(*)::integer AS n FROM audit_logs WHERE action='season.create'")).rows[0].n,1);
 }finally{await pg.close();}
});
