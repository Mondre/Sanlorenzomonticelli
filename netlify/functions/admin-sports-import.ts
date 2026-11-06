import process from 'node:process';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {sportsImportService} from '../../src/server/sports-import/service';
import {mutationOrigin,readInput,contentFailure} from '../../src/server/content/request';
import {json} from '../../src/server/http';
import {z} from 'zod';
export const config={path:'/api/admin/sports-import'};
export default async function handler(request:Request){
 if(!['GET','PUT','POST'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, PUT, POST'}});
 try{
  if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);
  const {session,grants}=await authorize(request,'settings.write'),actor={userId:session.user.id,grants},service=sportsImportService(database());
  if(request.method==='GET')return json(await service.state());
  const body=await readInput(request);
  if(request.method==='PUT')return json(await service.configure(actor,body));
  z.object({action:z.literal('refresh')}).strict().parse(body);
  return json(await service.refresh(actor));
 }catch(error){return contentFailure(error);}
}
