import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {rows,type Executor} from '../content/service.ts';
import {validGrants} from '../auth/permissions.ts';
export async function accountHasAccess(db:Executor,userId:string){
 const grants=await rows(db,sql`SELECT r.name AS role,p.category_id AS "categoryId" FROM user_permissions p JOIN roles r ON r.id=p.role_id WHERE p.user_id=${userId}`,z.object({role:z.string(),categoryId:z.uuid().nullable()}));
 return validGrants(grants).length>0;
}
