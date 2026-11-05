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
