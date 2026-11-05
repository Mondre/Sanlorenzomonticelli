export const roleNames = ['super_admin','admin','category_manager','editor'] as const;
export type RoleName = typeof roleNames[number];
export interface Grant {role:string;categoryId:string|null}
export type Action = 'dashboard.read'|'news.read'|'news.write'|'matches.read'|'matches.write'|'team.write'|'categories.write'|'users.manage'|'settings.write'|'requests.read'|'requests.write';
export function validGrants(grants:Grant[]):Grant[]{
 return grants.filter(g=>roleNames.includes(g.role as RoleName) &&
  (g.role==='category_manager' ? Boolean(g.categoryId) : ['super_admin','admin'].includes(g.role) ? g.categoryId===null : true));
}
export function can(grants:Grant[],action:Action,categoryId?:string):boolean{
 return validGrants(grants).some(g=>{
  if(g.role==='super_admin')return true;
  if(g.role==='admin')return action!=='users.manage';
  if(action==='dashboard.read')return true;
  if(g.role==='editor' && !['news.read','news.write'].includes(action))return false;
  if(g.role==='category_manager' && !['news.read','news.write','matches.read','matches.write','team.write'].includes(action))return false;
  return g.categoryId===null || (categoryId!==undefined && categoryId===g.categoryId);
 });
}
