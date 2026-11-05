import { count, eq, and, or, lte } from 'drizzle-orm';
import { authorize,AccessDenied } from '../../src/server/auth/authorize';
import { database } from '../../src/server/db/client';
import { news,registrationRequests } from '../../src/server/db/schema';
import { json,unavailable } from '../../src/server/http';
export const config={path:'/api/admin/dashboard'};
export default async function handler(request:Request){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 try{
  const {session,grants}=await authorize(request,'dashboard.read');
  // Global aggregates are restricted to global administrators. Scoped users get no cross-category counts.
  const global=grants.some(g=>g.categoryId===null && ['super_admin','admin'].includes(g.role));
  let metrics:null|{published:number;drafts:number;requests:number}=null;
  if(global){
   const db=database();
   const [[published],[drafts],[requests]]=await Promise.all([
    db.select({total:count()}).from(news).where(and(or(eq(news.status,'published'),eq(news.status,'scheduled')),lte(news.publishAt,new Date()))),
    db.select({total:count()}).from(news).where(eq(news.status,'draft')),
    db.select({total:count()}).from(registrationRequests).where(eq(registrationRequests.status,'new')),
   ]);
   metrics={published:published?.total??0,drafts:drafts?.total??0,requests:requests?.total??0};
  }
  return json({user:{name:session.user.name},roles:[...new Set(grants.map(g=>g.role))],metrics});
 }catch(error){
  if(error instanceof AccessDenied)return json({error:{code:error.status===401?'UNAUTHENTICATED':'FORBIDDEN',message:'Accesso riservato.'}},error.status);
  return unavailable();
 }
}
