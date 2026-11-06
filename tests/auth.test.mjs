import {test} from 'node:test';
import {configurationIssue,safeAuthFailure,AuthSetupError} from '../src/server/auth/diagnostics.ts';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {eq} from 'drizzle-orm';
import {authorizeRequest,AccessDenied} from '../src/server/auth/authorize-request.ts';
import {bootstrapStatements} from '../src/server/auth/bootstrap-statements.ts';
import {hashPassword} from 'better-auth/crypto';
import {createAuth} from '../src/server/auth/create-auth.ts';
import {validateAuthConfiguration} from '../src/server/auth/config.ts';
import {can,validGrants} from '../src/server/auth/permissions.ts';
import * as schema from '../src/server/db/schema.ts';
const origin='https://club.example';
const configuration={origin,secret:'test-only-secret-for-isolated-database-00000000'};

test('configurazione autenticazione rifiuta origine insicura o segreto mancante',()=>{
 assert.throws(()=>validateAuthConfiguration({origin:'http://club.example',secret:configuration.secret}));
 assert.throws(()=>validateAuthConfiguration({origin,secret:'short'}));
 assert.throws(()=>validateAuthConfiguration({origin:origin+'/path',secret:configuration.secret}));
 assert.equal(validateAuthConfiguration(configuration).origin,origin);
});
test('RBAC: ruoli globali, scope categoria, redattore e negazione predefinita',()=>{
 assert.equal(can([], 'dashboard.read'),false);
 assert.equal(can([{role:'unknown',categoryId:null}],'news.write'),false);
 assert.equal(can([{role:'super_admin',categoryId:null}],'users.manage'),true);
 assert.equal(can([{role:'admin',categoryId:null}],'users.manage'),false);
 assert.equal(can([{role:'admin',categoryId:null}],'matches.write'),true);
 const manager=[{role:'category_manager',categoryId:'cat-a'}];
 assert.equal(can(manager,'matches.write','cat-a'),true);
 assert.equal(can(manager,'matches.write','cat-b'),false);
 assert.equal(can(manager,'matches.write'),false);
 assert.equal(can(manager,'settings.write','cat-a'),false);
 assert.deepEqual(validGrants([{role:'category_manager',categoryId:null},{role:'super_admin',categoryId:'cat-a'}]),[]);
 assert.equal(can([{role:'editor',categoryId:'cat-a'}],'news.write','cat-a'),true);
 assert.equal(can([{role:'editor',categoryId:'cat-a'}],'news.write','cat-b'),false);
 assert.equal(can([{role:'editor',categoryId:null}],'matches.write','cat-a'),false);
});
test('Better Auth su PostgreSQL: login, cookie, sessioni, CSRF e rate limiting',async t=>{
 const pg=new PGlite();
 try{
  for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const db=drizzle(pg,{schema});
  const password='Only-for-test-strong-password-123';
  await db.insert(schema.users).values({id:'auth-test-user',name:'Utente Test',email:'admin@example.test'});
  await db.insert(schema.accounts).values({id:'auth-test-account',userId:'auth-test-user',accountId:'auth-test-user',providerId:'credential',password:await hashPassword(password)});
  const auth=createAuth(db,configuration);
  const request=(path,body,extra={})=>new Request(origin+'/api/auth'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json','x-portal-client-ip':'192.0.2.1',...extra},...(body?{body:JSON.stringify(body)}:{})});
  let cookie;
  await t.test('login reale e cookie HttpOnly/Secure/SameSite',async()=>{
   const response=await auth.handler(request('/sign-in/email',{email:'admin@example.test',password,rememberMe:false}));
   assert.equal(response.status,200,await response.clone().text());
   const cookies=response.headers.getSetCookie();
   const session=cookies.find(value=>value.includes('session_token='));
   assert.ok(session);assert.match(session,/HttpOnly/i);assert.match(session,/Secure/i);assert.match(session,/SameSite=Lax/i);
   cookie=cookies.map(value=>value.split(';')[0]).join('; ');
  });
  await t.test('sessione recuperabile con cookie, assente senza cookie',async()=>{
   const response=await auth.handler(request('/get-session',null,{Cookie:cookie}));
   assert.equal((await response.json()).user.id,'auth-test-user');
   const anonymous=await auth.handler(request('/get-session'));
   assert.equal(await anonymous.json(),null);
  });
  await t.test('autorizzazione server: scope e revoca immediata del ruolo',async()=>{
   const categoryId='20000000-0000-4000-8000-000000000099';
   await db.insert(schema.categories).values({id:categoryId,name:'Categoria Test',slug:'categoria-test'});
   const [role]=await db.insert(schema.roles).values({name:'category_manager'}).returning();
   await db.insert(schema.userPermissions).values({userId:'auth-test-user',roleId:role.id,categoryId});
   const deps={getSession:headers=>auth.api.getSession({headers}),getGrants:userId=>db.select({role:schema.roles.name,categoryId:schema.userPermissions.categoryId}).from(schema.userPermissions).innerJoin(schema.roles,eq(schema.roles.id,schema.userPermissions.roleId)).where(eq(schema.userPermissions.userId,userId))};
   const req=request('/get-session',null,{Cookie:cookie});
   assert.equal((await authorizeRequest(req,'matches.write',categoryId,deps)).session.user.id,'auth-test-user');
   await assert.rejects(authorizeRequest(req,'matches.write','another-category',deps),e=>e instanceof AccessDenied && e.status===403);
   await assert.rejects(authorizeRequest(request('/get-session'),'matches.write',categoryId,deps),e=>e instanceof AccessDenied && e.status===401);
   await db.delete(schema.userPermissions).where(eq(schema.userPermissions.userId,'auth-test-user'));
   await assert.rejects(authorizeRequest(req,'dashboard.read',undefined,deps),e=>e instanceof AccessDenied && e.status===403);
  });
  await t.test('password errata e registrazione pubblica rifiutate',async()=>{
   const bad=await auth.handler(request('/sign-in/email',{email:'admin@example.test',password:'wrong-password'}));
   assert.equal(bad.status,401);
   const signup=await auth.handler(request('/sign-up/email',{name:'Intruso',email:'new@example.test',password}));
   assert.ok(signup.status>=400);
   assert.equal((await db.select().from(schema.users)).length,1);
  });
  await t.test('origine estranea bloccata prima di cambiare la sessione',async()=>{
   const response=await auth.handler(request('/sign-out',{}, {Cookie:cookie,Origin:'https://evil.example'}));
   assert.equal(response.status,403);
   const valid=await auth.handler(request('/get-session',null,{Cookie:cookie}));
   assert.equal((await valid.json()).user.id,'auth-test-user');
  });
  await t.test('logout invalida la sessione nel database',async()=>{
   const response=await auth.handler(request('/sign-out',{}, {Cookie:cookie}));
   assert.equal(response.status,200);
   const loggedOut=await auth.handler(request('/get-session',null,{Cookie:cookie}));
   assert.equal(await loggedOut.json(),null);
  });
  await t.test('sessione scaduta viene rifiutata',async()=>{
   const login=await auth.handler(request('/sign-in/email',{email:'admin@example.test',password}, {'x-portal-client-ip':'192.0.2.2'}));
   assert.equal(login.status,200);
   const expiredCookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
   await db.update(schema.sessions).set({expiresAt:new Date(Date.now()-60_000)}).where(eq(schema.sessions.userId,'auth-test-user'));
   const expired=await auth.handler(request('/get-session',null,{Cookie:expiredCookie}));
   assert.equal(await expired.json(),null);
  });
  await t.test('bootstrap transazionale: primo super admin, audit e blocco seconda esecuzione',async()=>{
   const apply=async(input)=>pg.transaction(async tx=>{for(const statement of bootstrapStatements(input))await tx.query(statement.text,statement.params);});
   const input={userId:'bootstrap-user',accountId:'bootstrap-account',name:'Primo Admin',email:'first@example.test',passwordHash:await hashPassword(password)};
   await apply(input);
   const granted=await db.select().from(schema.userPermissions).where(eq(schema.userPermissions.userId,input.userId));
   assert.equal(granted.length,1);assert.equal(granted[0].categoryId,null);
   assert.equal((await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action,'admin.bootstrap'))).length,1);
   await assert.rejects(apply({...input,userId:'second-bootstrap',accountId:'second-account',email:'second@example.test'}));
   assert.equal((await db.select().from(schema.users).where(eq(schema.users.id,'second-bootstrap'))).length,0);
   const login=await auth.handler(request('/sign-in/email',{email:input.email,password},{'x-portal-client-ip':'192.0.2.5'}));
   assert.equal(login.status,200);
  });
  await t.test('tentativi di login limitati con contatore persistente',async()=>{
   let status;
   for(let i=0;i<6;i++)status=(await auth.handler(request('/sign-in/email',{email:'admin@example.test',password:'wrong-password'}, {'x-portal-client-ip':'192.0.2.44'}))).status;
   assert.equal(status,429);
   assert.ok((await db.select().from(schema.authRateLimits)).length>0);
  });
 }finally{await pg.close();}
});

test('diagnostica configurazione: codici distinti, senza restituire valori',()=>{
 const env={DATABASE_URL:'postgresql://test:private-password@db.example.test/db',BETTER_AUTH_SECRET:'test-only-secret-for-config-validation-0000',BETTER_AUTH_URL:origin};
 assert.equal(configurationIssue(env),null);
 assert.equal(configurationIssue({...env,DATABASE_URL:undefined}),'DATABASE_URL_MISSING');
 assert.equal(configurationIssue({...env,DATABASE_URL:'not-a-connection-string'}),'DATABASE_URL_INVALID');
 assert.equal(configurationIssue({...env,BETTER_AUTH_SECRET:undefined}),'AUTH_SECRET_MISSING');
 assert.equal(configurationIssue({...env,BETTER_AUTH_SECRET:'short'}),'AUTH_SECRET_TOO_SHORT');
 assert.equal(configurationIssue({...env,BETTER_AUTH_URL:undefined}),'AUTH_URL_MISSING');
 assert.equal(configurationIssue({...env,BETTER_AUTH_URL:'club.example'}),'AUTH_URL_INVALID');
 assert.equal(configurationIssue({...env,BETTER_AUTH_URL:origin+'/admin/'}),'AUTH_URL_INVALID');
});
test('classificazione errori non espone query, password o messaggi originali',()=>{
 const sensitive='postgresql://test:private-password@db.example.test/db';
 assert.equal(safeAuthFailure(new AuthSetupError('AUTH_URL_INVALID')),'AUTH_URL_INVALID');
 assert.equal(safeAuthFailure(new Error(sensitive,{cause:{code:'28P01',message:sensitive}})),'DATABASE_AUTH_FAILED');
 assert.equal(safeAuthFailure({cause:{code:'42P01',query:sensitive}}),'DATABASE_SCHEMA_MISSING');
 assert.equal(safeAuthFailure(['query failed',{code:'42703',params:[sensitive]}]),'DATABASE_SCHEMA_OUTDATED');
 const unknown=safeAuthFailure(new Error(sensitive));assert.equal(unknown,'AUTH_INTERNAL_ERROR');assert.ok(!unknown.includes('private-password'));
});
