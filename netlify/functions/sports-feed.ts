import {database} from '../../src/server/db/client';
import {sportsImportService} from '../../src/server/sports-import/service';
import {json} from '../../src/server/http';
import {contentFailure} from '../../src/server/content/request';
export const config={path:'/api/sports-feed'};
export default async function handler(request:Request){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 try{return json({snapshot:await sportsImportService(database()).publicSnapshot()});}catch(error){return contentFailure(error);}
}
