import { isIP } from 'node:net';
import {randomUUID} from 'node:crypto';
import { authentication } from '../../src/server/auth/runtime';
import {safeAuthFailure,type AuthFailureCode} from '../../src/server/auth/diagnostics';
import { json } from '../../src/server/http';
export const config={path:'/api/auth/*'};
export default async function handler(request:Request,context?:{ip?:string}){
 if(!['GET','POST'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
 const reference=randomUUID();
 const report=(code:AuthFailureCode,stage:string)=>console.error(JSON.stringify({event:'auth_failure',reference,stage,code}));
 const unavailable=()=>json({error:{code:'SERVICE_UNAVAILABLE',message:'Servizio temporaneamente non disponibile.',reference}},503);
 if(!context?.ip || !isIP(context.ip)){report('CLIENT_IP_UNAVAILABLE','context');return unavailable();}
 let stage='configuration';
 try{
  const headers=new Headers(request.headers);headers.set('x-portal-client-ip',context.ip);
  const trustedRequest=new Request(request,{headers});
  const auth=authentication(code=>report(code,'library'));stage='handler';
  const response=await auth.handler(trustedRequest);
  if(response.status>=500){report('AUTH_INTERNAL_ERROR','response');return unavailable();}
  return response;
 }catch(error){report(safeAuthFailure(error),stage);return unavailable();}
}
