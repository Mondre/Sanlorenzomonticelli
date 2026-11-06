import {randomUUID} from 'node:crypto';
import process from 'node:process';
import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {imageStore} from '../../src/server/media/storage';
import {mutationOrigin,readInput,contentFailure} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/health'};
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 try{
  mutationOrigin(request,process.env.BETTER_AUTH_URL);await authorize(request,'settings.write');z.object({action:z.literal('check')}).strict().parse(await readInput(request));
  let db='DATABASE_UNAVAILABLE',storage='STORAGE_UNAVAILABLE';
  try{await database().execute(sql`SELECT 1`);db='OK';}catch{}
  const key='health/'+randomUUID();
  try{const store=imageStore();try{await store.put(key,new Uint8Array([83,76,77]));const file=await store.get(key);storage=file&&new Uint8Array(file).join(',')==='83,76,77'?'OK':'STORAGE_READ_FAILED';}finally{await store.remove(key);}}catch{storage='STORAGE_UNAVAILABLE';}
  return json({checkedAt:new Date().toISOString(),database:db,storage,ok:db==='OK'&&storage==='OK'});
 }catch(error){return contentFailure(error);}
}
