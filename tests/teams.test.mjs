import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {teamService} from '../src/server/teams/service.ts';
import {contentService} from '../src/server/content/service.ts';
const category='20000000-0000-4000-8000-000000000001',youth='20000000-0000-4000-8000-000000000002',season='10000000-0000-4000-8000-000000000001',teamId='30000000-0000-4000-8000-000000000001';
const actor={userId:'team-admin',grants:[{role:'admin',categoryId:null}]};
const manager={userId:'team-admin',grants:[{role:'category_manager',categoryId:category}]};
test('squadre e staff: gestione, stagioni e filtri privacy pubblici',async t=>{
 const pg=new PGlite();
 try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));
  await pg.query("INSERT INTO users(id,name,email) VALUES ('team-admin','Test Admin','team@example.test')");
  const db=drizzle(pg),service=teamService(db);let youthTeam,privateStaff;
  await t.test('aggiornamento con controllo di versione e audit',async()=>{
   const team=(await service.list(manager)).items.find(t=>t.id===teamId),input={id:team.id,version:team.version,name:team.name,description:'La presentazione della prima squadra.',trainingSchedule:'Martedì e giovedì, 19:00'};
   await service.update(manager,input);await assert.rejects(service.update(manager,input),e=>e.status===409);
   const publicTeam=(await service.publicIndex()).find(t=>t.id===teamId);assert.equal(publicTeam.trainingSchedule,input.trainingSchedule);
   assert.equal((await pg.query("SELECT * FROM audit_logs WHERE action='team.update'")).rows.length,1);
  });
  await t.test('creazione e modifica limitate alla categoria assegnata',async()=>{
   await service.create(manager,{name:'Seconda formazione',categoryId:category,seasonId:season,description:null,trainingSchedule:null});
   await assert.rejects(service.create(manager,{name:'Juniores',categoryId:youth,seasonId:season,description:null,trainingSchedule:null}),e=>e.status===403);
   youthTeam=(await service.create(actor,{name:'Juniores della società',categoryId:youth,seasonId:season,description:null,trainingSchedule:null})).id;
   const y=(await service.list(actor)).items.find(t=>t.id===youthTeam);
   await assert.rejects(service.update(manager,{id:y.id,version:y.version,name:y.name,description:'Non autorizzato',trainingSchedule:null}),e=>e.status===403);
   assert.equal((await service.list({userId:actor.userId,grants:[{role:'editor',categoryId:null}]})).items.length,0);
   await assert.rejects(service.create(manager,{name:'Seconda formazione',categoryId:category,seasonId:season,description:null,trainingSchedule:null}),e=>e.status===400);
  });
  await t.test('staff riservato escluso dalle pagine pubbliche',async()=>{
   privateStaff=(await service.addStaff(manager,{teamId:teamId,name:'Collaboratore Riservato',role:'Dirigente',publish:false})).id;
   await service.addStaff(manager,{teamId:teamId,name:'Allenatore Pubblicabile',role:'Allenatore',publish:true});
   const page=await service.publicCategory('prima-squadra-demo');assert.equal(page.staff.length,1);assert.equal(page.staff[0].name,'Allenatore Pubblicabile');assert.doesNotMatch(JSON.stringify(page),/Collaboratore Riservato/);
   await assert.rejects(service.addStaff(manager,{teamId:youthTeam,name:'Non autorizzato',role:'Allenatore',publish:true}),e=>e.status===403);
  });
  await t.test('rose adulte solo con due abilitazioni esplicite',async()=>{
   await pg.query("INSERT INTO players(team_id,display_name,publication_consent) VALUES ($1,'Adulto autorizzato',true),($1,'Adulto riservato',false)",[teamId]);
   assert.equal((await service.publicCategory('prima-squadra-demo')).players.length,0);
   await pg.query('UPDATE categories SET publish_roster=true WHERE id=$1',[category]);
   const page=await service.publicCategory('prima-squadra-demo');assert.equal(page.players.length,1);assert.equal(page.players[0].name,'Adulto autorizzato');assert.doesNotMatch(JSON.stringify(page),/Adulto riservato/);
  });
  await t.test('rose giovanili mai esposte, anche con flag permissivi nel database',async()=>{
   await pg.query('UPDATE categories SET publish_roster=true WHERE id=$1',[youth]);await pg.query("INSERT INTO players(team_id,display_name,publication_consent) VALUES ($1,'Nome Minore Riservato',true)",[youthTeam]);
   const page=await service.publicCategory('juniores-demo');assert.equal(page.players.length,0);assert.doesNotMatch(JSON.stringify(page),/Nome Minore Riservato/);
  });
  await t.test('stagioni distinte, nessuna partita dell’archivio mescolata',async()=>{
   const otherSeason='10000000-0000-4000-8000-000000000099';await pg.query("INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ($1,'Archivio 2025/26','2025-07-01','2026-06-30')",[otherSeason]);
   await service.create(actor,{name:'Squadra archivio',categoryId:category,seasonId:otherSeason,description:null,trainingSchedule:null});
   const page=await service.publicCategory('prima-squadra-demo',otherSeason);assert.equal(page.season.id,otherSeason);assert.equal(page.teams.length,1);
   assert.equal((await contentService(db).listPublicMatches({categoryId:category,seasonId:otherSeason})).items.length,0);
   assert.equal(await service.publicCategory('prima-squadra-demo','10000000-0000-4000-8000-000000000098'),null);
  });
  await t.test('rimozione staff e categorie disattivate rispettate dal pubblico',async()=>{
   await service.removeStaff(manager,{id:privateStaff});assert.equal((await pg.query('SELECT * FROM team_staff WHERE id=$1',[privateStaff])).rows.length,0);
   assert.equal((await service.publicIndex()).some(t=>t.name==='Atletico Collina — DEMO'),false);
   await pg.query('UPDATE categories SET active=false WHERE id=$1',[youth]);assert.equal(await service.publicCategory('juniores-demo'),null);assert.equal((await service.publicIndex()).some(t=>t.categoryId===youth),false);
  });
 }finally{await pg.close();}
});
