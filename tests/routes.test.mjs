import { test } from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL;
if (!base) throw new Error('Avvia npm run dev e imposta TEST_BASE_URL prima dei test.');
for (const [path, expected] of [['/', 'Una squadra.'], ['/design-system', 'Palette societaria']]) {
 test(`GET ${path}: HTML renderizzato con lingua e destinazione skip-link`, async () => {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="it">/);
  assert.match(html, /id="contenuto"/);
  assert.ok(html.includes(expected));
  assert.doesNotMatch(html, /postgres(?:ql)?:\/\//);
 });
}
test('risorsa inesistente restituisce 404', async () => {
 const response = await fetch(new URL('/pagina-inesistente', base));
 assert.equal(response.status, 404);
 assert.match(await response.text(), /Questa pagina non c’è/);
});
test('stemma SVG è disponibile senza servizi esterni', async () => {
 const response = await fetch(new URL('/crest.svg', base));
 assert.equal(response.status, 200);
 assert.match(response.headers.get('content-type'), /image\/svg/);
 assert.match(await response.text(), /<svg/);
});

test('logo originale usato nella home e disponibile come PNG',async()=>{
 const home=await (await fetch(new URL('/',base))).text();
 assert.match(home,/src="\/logo-societa\.png"/);
 const image=await fetch(new URL('/logo-societa.png',base));
 assert.equal(image.status,200);
 assert.match(image.headers.get('content-type'),/image\/png/);
 assert.ok((await image.arrayBuffer()).byteLength>1000);
});
test('area riservata renderizza solo il contenitore pubblico e noindex',async()=>{
 const response=await fetch(new URL('/admin',base));
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/noindex, nofollow/);
 assert.match(html,/Verifica dell/);
 assert.doesNotMatch(html,/postgres(?:ql)?:\/\//);
});

for(const path of ['/notizie','/partite','/classifiche']){
 test(`pagina pubblica ${path}: gestisce il database non configurato senza dettagli interni`,async()=>{
  const response=await fetch(new URL(path,base));
  assert.equal(response.status,process.env.DATABASE_URL?200:503);
  const html=await response.text();
  assert.match(html,/<html lang="it">/);
  assert.doesNotMatch(html,/postgres(?:ql)?:\/\/|DATABASE_URL|DrizzleQueryError/);
  if(!process.env.DATABASE_URL)assert.match(html,/non sono disponibili in questo momento/);
 });
}
test('filtri non validi e UUID malformati restituiscono 400/404',async()=>{
 assert.equal((await fetch(new URL('/notizie?page=-1',base))).status,400);
 assert.equal((await fetch(new URL('/partite?category=invalid',base))).status,400);
 assert.equal((await fetch(new URL('/classifiche?competition=invalid',base))).status,400);
 assert.equal((await fetch(new URL('/partite/not-a-uuid',base))).status,404);
});

test('pagina squadre gestisce l’assenza di database senza dati fittizi',async()=>{
 const response=await fetch(new URL('/squadre',base));assert.equal(response.status,process.env.DATABASE_URL?200:503);const html=await response.text();assert.match(html,/Le nostre squadre/);assert.doesNotMatch(html,/postgres(?:ql)?:\/\/|DATABASE_URL|DrizzleQueryError/);
});
test('pagina richieste non rende un modulo attivo prima del caricamento dell’informativa',async()=>{
 const response=await fetch(new URL('/richieste',base));assert.equal(response.status,200);const html=await response.text();assert.match(html,/referente adulto/);assert.match(html,/Caricamento del modulo/);assert.doesNotMatch(html,/name="contactName"|BETTER_AUTH_SECRET/);
});
test('privacy e cookie: informativa configurata oppure stato di indisponibilità',async()=>{
 const response=await fetch(new URL('/privacy',base));assert.ok([200,503].includes(response.status));const html=await response.text();if(!process.env.DATABASE_URL){assert.equal(response.status,503);assert.match(html,/non raccoglie dati/);}assert.doesNotMatch(html,/DATABASE_URL|DrizzleQueryError/);
 const cookie=await fetch(new URL('/cookie',base));assert.equal(cookie.status,200);assert.match(await cookie.text(),/cookie tecnici/);
});
test('stagione malformata delle squadre rifiutata prima della query',async()=>{
 assert.equal((await fetch(new URL('/squadre/prima-squadra?season=invalid',base))).status,400);
});
