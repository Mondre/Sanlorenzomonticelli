import {database} from '../../src/server/db/client';
import {sportsImportService} from '../../src/server/sports-import/service';
import {ContentError} from '../../src/server/content/errors';
import {unavailable} from '../../src/server/http';
// Netlify scheduled function, no public route. Two requests at most per scheduled run.
export const config={schedule:'15 6,12,18,23 * * *'};
export default async function handler(request:Request){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 try{
  const service=sportsImportService(database()),state=await service.state();
  if(state.enabled&&new Date()<=new Date('2027-07-01T00:00:00Z'))await service.refresh(null);
  return new Response(null,{status:204});
 }catch(error){if(error instanceof ContentError&&error.status===429)return new Response(null,{status:204});return unavailable();}
}
