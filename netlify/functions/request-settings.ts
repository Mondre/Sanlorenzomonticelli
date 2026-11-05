import process from 'node:process';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {requestService} from '../../src/server/requests/service';
import {mutationOrigin,readInput,contentFailure} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/request-settings'};
export default async function handler(request:Request){
 if(!['GET','PUT'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, PUT'}});
 try{if(request.method==='PUT')mutationOrigin(request,process.env.BETTER_AUTH_URL);const {session,grants}=await authorize(request,request.method==='GET'?'requests.read':'requests.write'),actor={userId:session.user.id,grants},service=requestService(database());return json(request.method==='GET'?{policy:await service.settings(actor)}:{policy:await service.saveSettings(actor,await readInput(request))});}catch(error){return contentFailure(error);}
}
