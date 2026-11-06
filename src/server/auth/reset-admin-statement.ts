interface ResetAdminInput{email:string;passwordHash:string;accountId:string}
export function resetAdminStatement(input:ResetAdminInput){return {
 text:`WITH target AS (
 SELECT u.id FROM users u WHERE u.email=$1 AND EXISTS (
 SELECT 1 FROM user_permissions p JOIN roles r ON r.id=p.role_id
 WHERE p.user_id=u.id AND r.name='super_admin' AND p.category_id IS NULL)
 ), changed AS (
 INSERT INTO accounts(id,user_id,account_id,provider_id,password)
 SELECT $2,id,id,'credential',$3 FROM target
 ON CONFLICT(provider_id,account_id) DO UPDATE SET password=excluded.password,updated_at=clock_timestamp()
 WHERE accounts.user_id=excluded.user_id RETURNING user_id
 ), revoked AS (DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM changed)),
 logged AS (INSERT INTO audit_logs(action,entity_type,entity_id)
 SELECT 'admin.password_reset','users',user_id FROM changed)
 SELECT user_id FROM changed`,
 params:[input.email,input.accountId,input.passwordHash],
};}
