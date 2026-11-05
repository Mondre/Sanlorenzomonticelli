import {database} from '../../src/server/db/client';
import {requestService} from '../../src/server/requests/service';
import {unavailable} from '../../src/server/http';
// Netlify scheduled function: no public path; provider owns the daily invocation.
export const config={schedule:'0 3 * * *'};
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 try{await requestService(database()).purge();return new Response(null,{status:204});}catch{return unavailable();}
}
