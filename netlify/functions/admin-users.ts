import process from 'node:process';
import {z} from 'zod';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {userService} from '../../src/server/users/service';
import {mutationOrigin,readInput,contentFailure,pageNumber} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/users'};
export default async function handler(request:Request){
 if(!['GET','POST','PUT'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST, PUT'}});
 try{if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);const {session,grants}=await authorize(request,'users.manage'),actor={userId:session.user.id,grants},service=userService(database());if(request.method==='GET')return json(await service.list(actor,pageNumber(request)));
  if(request.method==='POST')return json(await service.create(actor,await readInput(request)),201);
  const input=z.object({kind:z.enum(['profile','password']),data:z.unknown()}).strict().parse(await readInput(request));return json(await(input.kind==='profile'?service.update(actor,input.data):service.password(actor,input.data)));
 }catch(error){return contentFailure(error);}
}
