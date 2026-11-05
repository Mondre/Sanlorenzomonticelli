import { can,validGrants,type Action,type Grant } from './permissions.ts';
export class AccessDenied extends Error {
 readonly status:401|403;
 constructor(status:401|403){super('Access denied');this.status=status;}
}
interface Session {user:{id:string;name:string}}
interface Dependencies {getSession:(headers:Headers)=>Promise<Session|null>;getGrants:(userId:string)=>Promise<Grant[]>}
export async function authorizeRequest(request:Request,action:Action,categoryId:string|undefined,dependencies:Dependencies){
 const session=await dependencies.getSession(request.headers);
 if(!session)throw new AccessDenied(401);
 const grants=validGrants(await dependencies.getGrants(session.user.id));
 if(!can(grants,action,categoryId))throw new AccessDenied(403);
 return {session,grants};
}
