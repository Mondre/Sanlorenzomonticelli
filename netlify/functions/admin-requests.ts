import process from 'node:process';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {requestService} from '../../src/server/requests/service';
import {mutationOrigin,readInput,contentFailure,pageNumber} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/requests'};
export default async function handler(request:Request){
 if(!['GET','PUT','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, PUT, DELETE'}});
 try{if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);const {session,grants}=await authorize(request,request.method==='GET'?'requests.read':'requests.write'),actor={userId:session.user.id,grants},service=requestService(database());if(request.method==='GET')return json(await service.list(actor,pageNumber(request)));const input=await readInput(request);return json(await(request.method==='PUT'?service.update(actor,input):service.remove(actor,input)));}catch(error){return contentFailure(error);}
}
