import process from 'node:process';
import {z} from 'zod';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {clubContentService} from '../../src/server/club-content/service';
import {mutationOrigin,readInput,contentFailure,pageNumber} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/admin/club-content'};
export default async function handler(request:Request){
 if(!['GET','POST','PUT','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST, PUT, DELETE'}});
 try{const kind=z.enum(['sponsors','venues']).parse(new URL(request.url).searchParams.get('kind'));if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);const {session,grants}=await authorize(request,kind==='sponsors'?'sponsors.write':'venues.write'),actor={userId:session.user.id,grants},service=clubContentService(database());
  if(request.method==='GET')return json(await(kind==='sponsors'?service.sponsors(actor,pageNumber(request)):service.venues(actor,pageNumber(request))));
  const input=await readInput(request);
  if(request.method==='POST')return json(await(kind==='sponsors'?service.createSponsor(actor,input):service.createVenue(actor,input)),201);
  if(request.method==='PUT')return json(await(kind==='sponsors'?service.updateSponsor(actor,input):service.updateVenue(actor,input)));
  return json(await(kind==='sponsors'?service.deleteSponsor(actor,input):service.deleteVenue(actor,input)));
 }catch(error){return contentFailure(error);}
}
