import process from 'node:process';
import {z} from 'zod';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {teamService} from '../../src/server/teams/service';
import {mutationOrigin,readInput,contentFailure,pageNumber} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/teams'};
export default async function handler(request:Request){
 if(!['GET','POST','PUT','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST, PUT, DELETE'}});
 try{if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);const {session,grants}=await authorize(request,'dashboard.read'),actor={userId:session.user.id,grants},service=teamService(database());if(request.method==='GET')return json(await service.list(actor,pageNumber(request)));
  const input=z.object({kind:z.enum(['team','staff']),data:z.unknown()}).strict().parse(await readInput(request));
  if(request.method==='POST')return json(await(input.kind==='team'?service.create(actor,input.data):service.addStaff(actor,input.data)),201);
  if(request.method==='PUT'&&input.kind==='team')return json(await service.update(actor,input.data));
  if(request.method==='DELETE'&&input.kind==='staff')return json(await service.removeStaff(actor,input.data));
  return json({error:{message:'Operazione non supportata.'}},405);
 }catch(error){return contentFailure(error);}
}
