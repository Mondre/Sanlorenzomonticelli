const origin=process.argv[2]||'https://sanlorenzomonticelli.netlify.app';
const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Usa soltanto l’origine HTTPS pubblica, senza credenziali.');
const cases=[['/',200,'logo-societa'],['/notizie',200],['/partite',200],['/classifiche',200],['/squadre',200],['/sponsor',200],['/campi',200],['/richieste',200],['/admin/',200,'noindex'],['/cookie',200],['/api/auth/ok',200],['/api/club-feed',200],['/api/sports-feed',200],['/api/admin/news',401],['/api/admin/media',401],['/api/admin/users',401],['/api/admin/requests',401],['/api/calendar.ics?id=invalid',400],['/pagina-collaudo-inesistente',404]];
let failures=0;
for(const [path,expected,contains] of cases){
 try{const response=await fetch(new URL(path,url),{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html, application/json'}}),body=await response.text();const valid=response.status===expected&&(!contains||body.includes(contains))&&!/postgres(?:ql)?:\/\/|DATABASE_URL|BETTER_AUTH_SECRET|DrizzleQueryError/.test(body);if(!valid)failures++;console.log((valid?'OK':'FAIL')+' '+path+' HTTP '+response.status);}
 catch{failures++;console.log('FAIL '+path+' NETWORK_UNAVAILABLE');}
}
console.log('Verifiche pubbliche e accessi anonimi: '+(cases.length-failures)+'/'+cases.length+'. I salvataggi autenticati e il caricamento immagini richiedono il collaudo dal pannello.');
process.exitCode=failures?1:0;
