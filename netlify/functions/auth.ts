import { isIP } from 'node:net';
import { authentication } from '../../src/server/auth/runtime';
import { unavailable } from '../../src/server/http';
export const config={path:'/api/auth/*'};
export default async function handler(request:Request,context:{ip:string}){
 if(!['GET','POST'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
 if(!context.ip || !isIP(context.ip))return unavailable();
 try{
  // Trust the Netlify context, never a caller-supplied forwarding header.
  const headers=new Headers(request.headers);headers.set('x-portal-client-ip',context.ip);
  const trustedRequest=new Request(request,{headers});
  return await authentication().handler(trustedRequest);
 }catch{return unavailable();}
}
