import process from 'node:process';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {contentService} from '../../src/server/content/service';
import {mutationOrigin,readInput,contentFailure,pageNumber} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/news'};
export default async function handler(request:Request){
 if(!['GET','POST','PUT','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST, PUT, DELETE'}});
 try{
  if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);
  const {session,grants}=await authorize(request,'dashboard.read');
  const service=contentService(database()),actor={userId:session.user.id,grants};
  if(request.method==='GET'){const [page,options]=await Promise.all([service.listAdminNews(grants,pageNumber(request)),service.options(grants)]);return json({...page,options});}
  const input=await readInput(request);
  if(request.method==='POST')return json(await service.createNews(actor,input),201);
  if(request.method==='PUT')return json(await service.updateNews(actor,input));
  return json(await service.deleteNews(actor,input));
 }catch(error){return contentFailure(error);}
}
