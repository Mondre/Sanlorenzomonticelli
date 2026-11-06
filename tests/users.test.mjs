import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {hashPassword} from 'better-auth/crypto';
import {userService} from '../src/server/users/service.ts';
import {accountHasAccess} from '../src/server/users/access.ts';
import {createAuth} from '../src/server/auth/create-auth.ts';
import {bootstrapStatements} from '../src/server/auth/bootstrap-statements.ts';
import * as schema from '../src/server/db/schema.ts';
const category='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const root={userId:'users-root',grants:[{role:'super_admin',categoryId:null}]};
const password='Initial-test-password-only-123';
test('gestione utenti: creazione, scope, revoca, password e ultimo amministratore',async t=>{
 const pg=new PGlite();
 try{
  for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../scripts/seed-demo.sql',import.meta.url),'utf8'));
  for(const statement of bootstrapStatements({userId:root.userId,accountId:'users-root-account',name:'Root Test',email:'root@example.test',passwordHash:await hashPassword(password)}))await pg.query(statement.text,statement.params);
  const db=drizzle(pg,{schema}),service=userService(db),auth=createAuth(db,{origin:'https://club.example',secret:'test-only-secret-for-users-module-00000000'},undefined,userId=>accountHasAccess(db,userId));
  let id,cookie,count=1;
  const request=(path,body,extra={})=>new Request('https://club.example/api/auth'+path,{method:body?'POST':'GET',headers:{Origin:'https://club.example','Content-Type':'application/json','x-portal-client-ip':'192.0.2.'+(count++),...extra},...(body?{body:JSON.stringify(body)}:{})});
  const cookies=response=>response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const find=async userId=>(await service.list(root)).items.find(u=>u.id===userId);
  await t.test('crea un collaboratore con password hashata e scope limitato',async()=>{
   id=(await service.create(root,{name:'Responsabile Test',email:'MANAGER@example.test',password,role:'category_manager',allCategories:false,categoryIds:[category]})).id;
   const row=await find(id);assert.equal(row.email,'manager@example.test');assert.equal(row.enabled,true);assert.deepEqual(row.grants,[{role:'category_manager',categoryId:category}]);
   const credentials=(await pg.query('SELECT password FROM accounts WHERE user_id=$1',[id])).rows[0];assert.notEqual(credentials.password,password);
   const login=await auth.handler(request('/sign-in/email',{email:'manager@example.test',password}));assert.equal(login.status,200);cookie=cookies(login);
   const list=await service.list(root);assert.doesNotMatch(JSON.stringify(list),/Initial-test-password|session_token|"password"/);assert.equal(list.writesReady,true);
  });
  await t.test('amministratori ordinari, editor e responsabili non possono gestire utenti',async()=>{
   for(const role of ['admin','editor','category_manager']){const actor={userId:id,grants:[{role,categoryId:role==='admin'?null:category}]};await assert.rejects(service.list(actor),e=>e.status===403);await assert.rejects(service.create(actor,{}),e=>e.status===403);}
  });
  await t.test('scope vuoti, inesistenti e dati estranei rifiutati senza inserimenti parziali',async()=>{
   const before=(await service.list(root)).items.length;
   await assert.rejects(service.create(root,{name:'Invalido',email:'bad@example.test',password,role:'category_manager',allCategories:true,categoryIds:[]}));
   await assert.rejects(service.create(root,{name:'Invalido',email:'bad@example.test',password,role:'editor',allCategories:false,categoryIds:['20000000-0000-4000-8000-000000000099']}),e=>e.status===400);
   await assert.rejects(service.create(root,{name:'Invalido',email:'bad@example.test',password,role:'editor',allCategories:true,categoryIds:[],emailVerified:true}));
   assert.equal((await service.list(root)).items.length,before);
   await assert.rejects(service.create(root,{name:'Duplicato',email:'manager@example.test',password,role:'editor',allCategories:true,categoryIds:[]}));assert.equal((await service.list(root)).items.length,before);
  });
  await t.test('cambio categoria revoca sessioni e rifiuta una versione obsoleta',async()=>{
   const row=await find(id),input={id,version:row.version,name:row.name,enabled:true,role:'category_manager',allCategories:false,categoryIds:[other]};
   await service.update(root,input);await assert.rejects(service.update(root,input),e=>e.status===409);
   assert.deepEqual((await find(id)).grants,[{role:'category_manager',categoryId:other}]);
   assert.equal(await(await auth.handler(request('/get-session',null,{Cookie:cookie}))).json(),null);
  });
  await t.test('disattivazione blocca anche nuovi login e riattivazione esplicita funziona',async()=>{
   let row=await find(id);await service.update(root,{id,version:row.version,name:row.name,enabled:false});assert.equal((await find(id)).enabled,false);assert.equal(await accountHasAccess(db,id),false);
   const denied=await auth.handler(request('/sign-in/email',{email:'manager@example.test',password}));assert.equal(denied.status,403);assert.equal((await pg.query('SELECT * FROM sessions WHERE user_id=$1',[id])).rows.length,0);
   row=await find(id);await service.update(root,{id,version:row.version,name:row.name,enabled:true,role:'editor',allCategories:false,categoryIds:[category]});
   assert.equal((await auth.handler(request('/sign-in/email',{email:'manager@example.test',password}))).status,200);
  });
  await t.test('reset password di un collaboratore conserva ruolo e invalida credenziali precedenti',async()=>{
   const row=await find(id),next='Replacement-test-password-456';await service.password(root,{id,version:row.version,password:next});
   assert.equal((await pg.query('SELECT * FROM sessions WHERE user_id=$1',[id])).rows.length,0);
   assert.deepEqual((await find(id)).grants,row.grants);assert.equal((await auth.handler(request('/sign-in/email',{email:'manager@example.test',password}))).status,401);
   const login=await auth.handler(request('/sign-in/email',{email:'manager@example.test',password:next}));assert.equal(login.status,200);cookie=cookies(login);
  });
  await t.test('cambio password personale verifica la corrente e rinnova la sessione',async()=>{
   const current='Replacement-test-password-456',next='Self-changed-test-password-789';
   const wrong=await auth.handler(request('/change-password',{currentPassword:'wrong',newPassword:next,revokeOtherSessions:true},{Cookie:cookie}));assert.equal(wrong.status,400);
   const changed=await auth.handler(request('/change-password',{currentPassword:current,newPassword:next,revokeOtherSessions:true},{Cookie:cookie}));assert.equal(changed.status,200);
   const newCookie=cookies(changed);assert.ok(newCookie);
   assert.equal(await(await auth.handler(request('/get-session',null,{Cookie:cookie}))).json(),null);
   assert.equal((await(await auth.handler(request('/get-session',null,{Cookie:newCookie}))).json()).user.id,id);
   assert.equal((await auth.handler(request('/sign-in/email',{email:'manager@example.test',password:current}))).status,401);
   assert.equal((await auth.handler(request('/sign-in/email',{email:'manager@example.test',password:next}))).status,200);
  });
  await t.test('proprio account e proprio reset vietati nella gestione utenti',async()=>{
   const row=await find(root.userId);await assert.rejects(service.update(root,{id:row.id,version:row.version,name:row.name,enabled:false}),e=>e.status===403);await assert.rejects(service.password(root,{id:row.id,version:row.version,password:'Test-password-never-applied'}),e=>e.status===403);
  });
  await t.test('migrazione di protezione mancante o disabilitata blocca le scritture',async()=>{
   await pg.exec('ALTER TABLE user_permissions DISABLE TRIGGER preserve_last_super_admin');assert.equal((await service.list(root)).writesReady,false);
   await assert.rejects(service.create(root,{name:'Non creato',email:'not-created@example.test',password,role:'admin',allCategories:true,categoryIds:[]}),e=>e.status===503);
   await pg.exec('ALTER TABLE user_permissions ENABLE TRIGGER preserve_last_super_admin');
  });
  await t.test('trigger protegge ultimo super amministratore anche da cancellazioni SQL',async()=>{
   await assert.rejects(pg.query('DELETE FROM user_permissions WHERE user_id=$1',[root.userId]),e=>e.code==='P0001');
   const second=(await service.create(root,{name:'Secondo Super',email:'second-super@example.test',password,role:'super_admin',allCategories:true,categoryIds:[]})).id;
   await assert.rejects(pg.exec("DELETE FROM user_permissions WHERE role_id IN (SELECT id FROM roles WHERE name='super_admin')"),e=>e.code==='P0001');
   assert.equal((await pg.query("SELECT * FROM user_permissions p JOIN roles r ON r.id=p.role_id WHERE r.name='super_admin'")).rows.length,2);
   await pg.query('DELETE FROM user_permissions WHERE user_id=$1',[second]);
   await assert.rejects(pg.query('DELETE FROM user_permissions WHERE user_id=$1',[root.userId]),e=>e.code==='P0001');
  });
  await t.test('permessi revocati nel database prevalgono su grant vecchi del chiamante',async()=>{
   await assert.rejects(service.list({userId:id,grants:root.grants}),e=>e.status===403);
   const audit=await pg.query("SELECT action FROM audit_logs WHERE action LIKE 'user.%'");assert.ok(audit.rows.some(r=>r.action==='user.disable'));assert.ok(audit.rows.some(r=>r.action==='user.password_reset'));
  });
 }finally{await pg.close();}
});
