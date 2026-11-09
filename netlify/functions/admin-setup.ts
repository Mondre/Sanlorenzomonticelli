import process from 'node:process';
import {z} from 'zod';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {setupService} from '../../src/server/content/setup-service';
import {mutationOrigin,readInput,contentFailure} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/setup'};
export default async function handler(request:Request){
 if(!['GET','POST','PUT'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST, PUT'}});
 try{
  if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);
  const {session,grants}=await authorize(request,'categories.write'),actor={userId:session.user.id,grants},service=setupService(database());
  if(request.method==='GET')return json(await service.catalog(actor));
  const input=z.object({kind:z.enum(['category','competition','venue','season']),data:z.unknown()}).strict().parse(await readInput(request));
  if(request.method==='PUT'){if(input.kind!=='category')return json({error:{message:'Operazione non supportata.'}},405);return json(await service.updateCategory(actor,input.data));}
  return json(await (input.kind==='category'?service.createCategory(actor,input.data):input.kind==='competition'?service.createCompetition(actor,input.data):input.kind==='season'?service.createSeason(actor,input.data):service.createVenue(actor,input.data)),201);
 }catch(error){return contentFailure(error);}
}
