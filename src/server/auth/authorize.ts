import { eq } from 'drizzle-orm';
import { authentication } from './runtime';
import { database } from '../db/client';
import { roles,userPermissions } from '../db/schema';
import { authorizeRequest } from './authorize-request';
import type { Action } from './permissions';
export { AccessDenied } from './authorize-request';
export async function authorize(request:Request,action:Action,categoryId?:string){
 return authorizeRequest(request,action,categoryId,{
  getSession:headers=>authentication().api.getSession({headers}),
  getGrants:userId=>database().select({role:roles.name,categoryId:userPermissions.categoryId}).from(userPermissions).innerJoin(roles,eq(roles.id,userPermissions.roleId)).where(eq(userPermissions.userId,userId)),
 });
}
