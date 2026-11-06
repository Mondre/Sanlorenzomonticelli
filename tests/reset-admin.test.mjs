import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {hashPassword} from 'better-auth/crypto';
import {createAuth} from '../src/server/auth/create-auth.ts';
import {bootstrapStatements} from '../src/server/auth/bootstrap-statements.ts';
import {resetAdminStatement} from '../src/server/auth/reset-admin-statement.ts';
import * as schema from '../src/server/db/schema.ts';
test('reset amministratore: password, revoca sessioni e conservazione dati/permessi',async t=>{
 const pg=new PGlite();
 try{
  for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const oldPassword='Old-test-password-only-123',newPassword='New-test-password-only-456',email='admin@example.test';
  for(const statement of bootstrapStatements({userId:'reset-admin',accountId:'reset-account',name:'Admin Test',email,passwordHash:await hashPassword(oldPassword)}))await pg.query(statement.text,statement.params);
  await pg.query("INSERT INTO site_settings(key,value) VALUES ('preserve-test','{\"value\":\"untouched\"}')");
  const auth=createAuth(drizzle(pg,{schema}),{origin:'https://club.example',secret:'test-only-secret-for-reset-password-000000'});
  const request=(path,body,headers={})=>new Request('https://club.example/api/auth'+path,{method:body?'POST':'GET',headers:{Origin:'https://club.example','Content-Type':'application/json','x-portal-client-ip':'192.0.2.110',...headers},...(body?{body:JSON.stringify(body)}:{})});
  const first=await auth.handler(request('/sign-in/email',{email,password:oldPassword}));assert.equal(first.status,200);
  const cookie=first.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  await t.test('reset atomico del super admin senza creare duplicati',async()=>{
   const statement=resetAdminStatement({email,passwordHash:await hashPassword(newPassword),accountId:'unused-new-account-id'});
   const result=await pg.query(statement.text,statement.params);assert.equal(result.rows.length,1);
   assert.equal((await pg.query('SELECT * FROM users')).rows.length,1);assert.equal((await pg.query('SELECT * FROM accounts')).rows.length,1);
   assert.equal((await pg.query('SELECT * FROM user_permissions')).rows.length,1);assert.equal((await pg.query("SELECT * FROM site_settings WHERE key='preserve-test'")).rows.length,1);
   assert.equal((await pg.query('SELECT * FROM sessions')).rows.length,0);assert.equal((await pg.query("SELECT * FROM audit_logs WHERE action='admin.password_reset'")).rows.length,1);
  });
  await t.test('vecchia password e vecchia sessione rifiutate, nuova password valida',async()=>{
   assert.equal((await auth.handler(request('/sign-in/email',{email,password:oldPassword}))).status,401);
   const expired=await auth.handler(request('/get-session',null,{Cookie:cookie}));assert.equal(await expired.json(),null);
   assert.equal((await auth.handler(request('/sign-in/email',{email,password:newPassword}))).status,200);
  });
  await t.test('email sconosciuta non crea utenti né modifica sessioni',async()=>{
   const before=(await pg.query('SELECT * FROM sessions')).rows.length;
   const statement=resetAdminStatement({email:'missing@example.test',passwordHash:'test-only-placeholder',accountId:'missing-account'});
   assert.equal((await pg.query(statement.text,statement.params)).rows.length,0);assert.equal((await pg.query('SELECT * FROM users')).rows.length,1);assert.equal((await pg.query('SELECT * FROM sessions')).rows.length,before);
  });
  await t.test('non può promuovere un utente senza ruolo super amministrativo',async()=>{
   await pg.query("INSERT INTO users(id,name,email) VALUES ('ordinary-user','User Test','ordinary@example.test')");
   const statement=resetAdminStatement({email:'ordinary@example.test',passwordHash:'test-only-placeholder',accountId:'ordinary-account'});
   assert.equal((await pg.query(statement.text,statement.params)).rows.length,0);assert.equal((await pg.query("SELECT * FROM accounts WHERE user_id='ordinary-user'")).rows.length,0);
   assert.equal((await pg.query("SELECT * FROM user_permissions WHERE user_id='ordinary-user'")).rows.length,0);
  });
 }finally{await pg.close();}
});
