interface BootstrapInput {userId:string;accountId:string;name:string;email:string;passwordHash:string}
export function bootstrapStatements(input:BootstrapInput):{text:string;params:string[]}[]{
 return [
  {text:'SELECT pg_advisory_xact_lock(28192013)',params:[]},
  {text:"DO $$ BEGIN IF EXISTS (SELECT 1 FROM user_permissions p JOIN roles r ON r.id=p.role_id WHERE r.name='super_admin' AND p.category_id IS NULL) THEN RAISE EXCEPTION 'Initial administrator already exists'; END IF; END $$",params:[]},
  {text:"INSERT INTO roles(name) VALUES ('super_admin'),('admin'),('category_manager'),('editor') ON CONFLICT(name) DO NOTHING",params:[]},
  {text:'INSERT INTO users(id,name,email,email_verified) VALUES ($1,$2,$3,false)',params:[input.userId,input.name,input.email]},
  {text:"INSERT INTO accounts(id,user_id,account_id,provider_id,password) VALUES ($1,$2,$2,'credential',$3)",params:[input.accountId,input.userId,input.passwordHash]},
  {text:"INSERT INTO user_permissions(user_id,role_id) SELECT $1,id FROM roles WHERE name='super_admin'",params:[input.userId]},
  {text:"INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) VALUES ($1,'admin.bootstrap','users',$1)",params:[input.userId]},
 ];
}
