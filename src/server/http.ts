export function json(data: unknown, status = 200) {
 return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
}
export function unavailable() { return json({ error: { code:'SERVICE_UNAVAILABLE', message:'Servizio temporaneamente non disponibile.' } }, 503); }
