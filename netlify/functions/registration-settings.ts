import process from 'node:process';
import {database} from '../../src/server/db/client';
import {requestService} from '../../src/server/requests/service';
import {contentFailure} from '../../src/server/content/request';
import {json} from '../../src/server/http';
export const config={path:'/api/registration-settings'};
export default async function handler(request:Request,context:{ip:string}){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 try{return json(await requestService(database()).form(process.env.BETTER_AUTH_SECRET??'',context.ip));}catch(error){return contentFailure(error);}
}
