import {contentService} from '../../src/server/content/service';
import {database} from '../../src/server/db/client';
import {json} from '../../src/server/http';
import {contentFailure} from '../../src/server/content/request';
export const config={path:'/api/club-feed'};
export default async function handler(request:Request){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 try{const service=contentService(database());const [news,upcoming,results]=await Promise.all([service.listPublicNews(),service.listPublicMatches({mode:'upcoming'}),service.listPublicMatches({mode:'results'})]);return json({news:news.items.slice(0,3),upcoming:upcoming.items.slice(0,3),latest:results.items[0]??null});}catch(error){return contentFailure(error);}
}
