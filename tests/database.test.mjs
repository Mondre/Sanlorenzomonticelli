import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('migrazioni PostgreSQL, seed e vincoli di integrità',async t=>{
 const db=new PGlite();
 try{
  for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));
  await t.test('seed caricato, pubblicazione rosa giovanile disattivata per default',async()=>{
   const {rows}=await db.query("SELECT publish_roster FROM categories WHERE is_youth=true");
   assert.equal(rows.length,1);assert.equal(rows[0].publish_roster,false);
   assert.equal((await db.query('SELECT * FROM matches')).rows.length,1);
  });
  await t.test('rifiuta risultati negativi o finali mancanti',async()=>{
   await assert.rejects(db.exec('UPDATE matches SET home_score=-1'));
   await assert.rejects(db.exec('UPDATE matches SET home_score=NULL,away_score=NULL'));
  });
  await t.test('rifiuta stessa squadra in casa e trasferta',async()=>{
   await assert.rejects(db.exec('UPDATE matches SET away_team_id=home_team_id'));
  });
  await t.test('rifiuta partecipazioni in stagione diversa',async()=>{
   await db.exec("INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('10000000-0000-4000-8000-000000000002','Altra stagione','2025-07-01','2026-06-30')");
   await assert.rejects(db.exec("UPDATE competition_teams SET season_id='10000000-0000-4000-8000-000000000002'"));
  });
  await t.test('seed duplicato fallisce senza creare nuove partite',async()=>{
   await assert.rejects(db.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8')));
   assert.equal((await db.query('SELECT * FROM matches')).rows.length,1);
  });
 }finally{await db.close();}
});
