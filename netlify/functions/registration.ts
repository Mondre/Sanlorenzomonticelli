import process from 'node:process';
import {database} from '../../src/server/db/client';
import {requestService} from '../../src/server/requests/service';
import {mutationOrigin,readInput,contentFailure} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/requests'};
export default async function handler(request:Request,context:{ip:string}){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 try{mutationOrigin(request,process.env.BETTER_AUTH_URL);await requestService(database()).submit(await readInput(request),process.env.BETTER_AUTH_SECRET??'',context.ip);return json({message:'Richiesta ricevuta. La segreteria ti risponderà ai recapiti indicati.'},202);}catch(error){const response=contentFailure(error);if(response.status===429)response.headers.set('Retry-After','900');return response;}
}
