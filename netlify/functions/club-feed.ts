import {clubContentService} from '../../src/server/club-content/service';
import {contentService} from '../../src/server/content/service';
import {database} from '../../src/server/db/client';
import {json} from '../../src/server/http';
import {contentFailure} from '../../src/server/content/request';
export const config={path:'/api/club-feed'};
export default async function handler(request:Request){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 try{const db=database(),service=contentService(db);const [news,upcoming,results,sponsors]=await Promise.all([service.listPublicNews(),service.listPublicMatches({mode:'upcoming'}),service.listPublicMatches({mode:'results'}),clubContentService(db).publicSponsors()]);return json({news:news.items.slice(0,3),upcoming:upcoming.items.slice(0,3),latest:results.items[0]??null,sponsors:sponsors.slice(0,6)});}catch(error){return contentFailure(error);}
}
