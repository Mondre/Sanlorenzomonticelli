import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {calendarResponse} from '../src/server/calendar/handler.ts';
import {calendarOrigin} from '../src/server/calendar/ical.ts';
import {calendarLink,canExportMatch} from '../src/shared/calendar.ts';
const matchId='50000000-0000-4000-8000-000000000001',category='20000000-0000-4000-8000-000000000001',otherCategory='20000000-0000-4000-8000-000000000002';
const competition='40000000-0000-4000-8000-000000000001',home='30000000-0000-4000-8000-000000000001',away='30000000-0000-4000-8000-000000000002';
const request=(query='',method='GET')=>new Request('https://untrusted-host.example/api/calendar.ics'+query,{method});
const unfold=text=>text.replace(/\r\n[ \t]/g,'');
const eventCount=text=>(text.match(/(?:^|\r\n)BEGIN:VEVENT\r\n/g)||[]).length;
test('calendario: filtri e metodi non validi rifiutati prima di accedere al database',async()=>{
 const unavailable=()=>{throw new Error('database password internal');};
 for(const query of ['?id=bad','?category=bad','?season=bad','?mode=unknown','?extra=value',`?id=${matchId}&category=${category}`])assert.equal((await calendarResponse(request(query),unavailable)).status,400);
 assert.equal((await calendarResponse(request('','POST'),unavailable)).status,405);
 const response=await calendarResponse(request(),unavailable);assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/password|internal/);
 assert.match(calendarOrigin('http://example.com'),/^https:\/\/sanlorenzomonticelli/);assert.equal(calendarOrigin('https://club.example/path'),'https://club.example');
 assert.match(calendarOrigin('https://user:secret@club.example'),/^https:\/\/sanlorenzomonticelli/);
 assert.equal(calendarLink({categoryId:category,mode:'results'}),'/api/calendar.ics?category='+category+'&mode=results');
 assert.equal(canExportMatch({kickoff:null,status:'scheduled'}),false);assert.equal(canExportMatch({kickoff:'2026-11-01T12:00:00Z',status:'postponed'}),false);
});
test('esportazione ICS da PostgreSQL: visibilità, filtri, orari, Unicode e variazioni',async t=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));
  const db=drizzle(pg),getDatabase=()=>db,respond=query=>calendarResponse(request(query),getDatabase,'https://club.example');let originalUID;
  await t.test('file della singola partita: ora UTC reale, URL fidato, nessuna durata inventata',async()=>{
   const response=await respond('?id='+matchId);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/calendar/);assert.match(response.headers.get('content-disposition'),/attachment; filename="san-lorenzo-partita-/);assert.equal(response.headers.get('cache-control'),'no-store');
   const text=await response.text(),body=unfold(text);assert.equal(eventCount(text),1);assert.match(body,/DTSTART:20261025T143000Z\r\n/);assert.match(body,/URL:https:\/\/club.example\/partite\//);assert.doesNotMatch(body,/untrusted-host|DTEND:|DURATION:|ORGANIZER|ATTENDEE|VALARM|METHOD:REQUEST/);
   originalUID=body.match(/UID:[^\r]+/)[0];assert.equal(unfold(await(await respond('?id='+matchId)).text()),body);
  });
  await t.test('testo remoto o editoriale non può creare nuovi eventi/proprietà ICS',async()=>{
   const malicious='È🏟'.repeat(40)+', squadra;\\test\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nATTENDEE:mailto:private@example.test';
   await pg.query('UPDATE teams SET name=$1 WHERE id=$2',[malicious,home]);await pg.query("UPDATE matches SET report='PRIVATE_REPORT_NEVER_EXPORT' WHERE id=$1",[matchId]);
   const text=await(await respond('?id='+matchId)).text(),body=unfold(text);assert.equal(eventCount(text),1);assert.equal((text.match(/\r\nEND:VEVENT\r\n/g)||[]).length,1);assert.match(body,/\\, squadra\\;\\\\test\\nEND:VEVENT/);assert.doesNotMatch(text,/\r\nATTENDEE:|PRIVATE_REPORT_NEVER_EXPORT/);
   for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);assert.equal(text.includes('�'),false);assert.equal(text.replace(/\r\n/g,'').includes('\n'),false);
   await pg.query("UPDATE teams SET name='San Lorenzo DEMO' WHERE id=$1",[home]);
  });
  await t.test('UID stabile, partita annullata segnalata e gare senza data o rinviate escluse',async()=>{
   await pg.query("UPDATE matches SET status='cancelled',kickoff='2026-10-26T15:00:00Z',updated_at=now() WHERE id=$1",[matchId]);
   const body=unfold(await(await respond('?id='+matchId)).text());assert.ok(body.includes(originalUID));assert.match(body,/STATUS:CANCELLED/);assert.match(body,/DTSTART:20261026T150000Z/);
   for(const status of ['postponed','suspended']){await pg.query('UPDATE matches SET status=$1 WHERE id=$2',[status,matchId]);assert.equal((await respond('?id='+matchId)).status,409);}
   await pg.query("UPDATE matches SET status='scheduled',kickoff=NULL WHERE id=$1",[matchId]);assert.equal((await respond('?id='+matchId)).status,409);
   await pg.query("UPDATE matches SET status='finished',kickoff='2026-10-25T14:30:00Z' WHERE id=$1",[matchId]);
  });
  await t.test('calendario completo oltre la paginazione della pagina, filtri e gara inesistente',async()=>{
   for(let i=0;i<30;i++)await pg.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,kickoff,status) VALUES ($1,$2,$3,$4,now()+interval '7 days','scheduled')",[randomUUID(),competition,home,away]);
   assert.equal(eventCount(await(await respond('?mode=all&category='+category)).text()),31);
   assert.equal(eventCount(await(await respond('?mode=upcoming')).text()),30);
   assert.equal(eventCount(await(await respond('?mode=results')).text()),1);
   assert.equal((await respond('?category='+otherCategory)).status,404);assert.equal((await respond('?id='+randomUUID())).status,404);
  });
  await t.test('una partita tra sole avversarie non è esportabile, anche conoscendone l’ID',async()=>{
   const team=randomUUID(),id=randomUUID();await pg.query("INSERT INTO teams(id,name,category_id,season_id,is_club) VALUES ($1,'Avversaria test',$2,'10000000-0000-4000-8000-000000000001',false)",[team,category]);
   await pg.query("INSERT INTO competition_teams(competition_id,team_id,season_id) VALUES ($1,$2,'10000000-0000-4000-8000-000000000001')",[competition,team]);
   await pg.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,kickoff,status) VALUES ($1,$2,$3,$4,now()+interval '1 day','scheduled')",[id,competition,team,away]);
   assert.equal((await respond('?id='+id)).status,404);assert.equal(eventCount(await(await respond('?mode=all')).text()),31);
  });
  await t.test('non tronca silenziosamente un’esportazione superiore al limite',async()=>{
   await pg.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,kickoff,status) SELECT gen_random_uuid(),$1,$2,$3,now()+interval '7 days','scheduled' FROM generate_series(1,501)",[competition,home,away]);
   const response=await respond('?mode=all');assert.equal(response.status,400);assert.match(await response.text(),/troppe partite/);
  });
 }finally{await pg.close();}
});
