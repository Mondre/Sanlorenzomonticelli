import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {can,type Grant} from '../auth/permissions.ts';
import {rows,type Executor} from '../content/service.ts';
import {ContentError} from '../content/errors.ts';
import {privacyPolicy,policyInput,requestInput,requestRow,requestUpdate,requestDelete} from '../../shared/requests.ts';
import {ipDigest,issueChallenge,verifyChallenge,submissionDigest} from './security.ts';
interface Actor{userId:string;grants:Grant[]}
function permitted(actor:Actor,action:'requests.read'|'requests.write'){if(!can(actor.grants,action))throw new ContentError(403,'Solo la segreteria autorizzata può gestire le richieste.');}
const idRow=z.object({id:z.uuid()});
const selectRequests=sql`SELECT r.id,r.contact_name AS "contactName",r.email,r.phone,r.category_id AS "categoryId",c.name AS "categoryName",r.message,r.type,r.privacy_version AS "privacyVersion",r.consented_at AS "consentedAt",r.created_at AS "createdAt",r.updated_at AS version,r.status FROM registration_requests r LEFT JOIN categories c ON c.id=r.category_id`;
export function requestService(db:Executor){
 async function settings(){const [row]=await rows(db,sql`SELECT value FROM site_settings WHERE key='registration_privacy'`,z.object({value:privacyPolicy}));return row?.value??null;}
 return {
  async publicPolicy(){const policy=await settings();return policy?.enabled?policy:null;},
  async settings(actor:Actor){permitted(actor,'requests.read');return settings();},
  async saveSettings(actor:Actor,input:unknown){
   permitted(actor,'requests.write');const data=policyInput.parse(input),version=randomUUID();const {expectedVersion,...fields}=data;const value={...fields,version};
   const [saved]=await rows(db,sql`WITH saved AS (INSERT INTO site_settings(key,value,updated_at) SELECT 'registration_privacy',${JSON.stringify(value)}::jsonb,clock_timestamp() WHERE ${expectedVersion===null?sql`NOT EXISTS(SELECT 1 FROM site_settings WHERE key='registration_privacy')`:sql`EXISTS(SELECT 1 FROM site_settings WHERE key='registration_privacy' AND value->>'version'=${expectedVersion})`} ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE site_settings.value->>'version'=${expectedVersion} RETURNING value), archived AS (INSERT INTO request_privacy_versions(id,controller_name,controller_address,contact_email,body,retention_days) SELECT ${version}::uuid,${data.controllerName},${data.controllerAddress},${data.contactEmail},${data.body},${data.retentionDays} FROM saved WHERE ${data.enabled}), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'request_policy.update','site_settings','registration_privacy' FROM saved) SELECT (value->>'version')::uuid AS id FROM saved`,idRow);
   if(!saved)throw new ContentError(409,'L’informativa è cambiata. Ricarica prima di salvare.');return value;
  },
  async form(secret:string,ip:string){const policy=await settings();if(!policy?.enabled)throw new ContentError(503,'Le richieste online non sono ancora disponibili.');const hash=ipDigest(secret,ip);const categories=await rows(db,sql`SELECT id,name FROM categories WHERE active=true ORDER BY sort_order,name`,z.object({id:z.uuid(),name:z.string()}));return {privacy:policy,categories,challenge:issueChallenge(secret,hash,policy.version)};},
  async submit(input:unknown,secret:string,ip:string,now=Date.now()){
   const data=requestInput.parse(input);if(data.website)throw new ContentError(400,'Impossibile inviare la richiesta. Controlla i campi.');const hash=ipDigest(secret,ip);verifyChallenge(secret,hash,data.privacyVersion,data.challenge,now);
   const key=submissionDigest(secret,data.requestId),id=randomUUID();
   let result;
   try{[result]=await rows(db,sql`WITH existing AS (SELECT id FROM registration_requests WHERE submission_key=${key}), policy AS (SELECT value FROM site_settings WHERE key='registration_privacy' AND value->>'enabled'='true' AND value->>'version'=${data.privacyVersion}), category AS (SELECT id FROM categories WHERE id=${data.categoryId}::uuid AND active=true), permit AS (INSERT INTO request_rate_limits(key,count,window_started) SELECT ${hash},1,clock_timestamp() FROM policy CROSS JOIN category WHERE NOT EXISTS(SELECT 1 FROM existing) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_rate_limits.window_started<=now()-interval '15 minutes' THEN 1 ELSE request_rate_limits.count+1 END,window_started=CASE WHEN request_rate_limits.window_started<=now()-interval '15 minutes' THEN clock_timestamp() ELSE request_rate_limits.window_started END WHERE request_rate_limits.window_started<=now()-interval '15 minutes' OR request_rate_limits.count<3 RETURNING key), created AS (INSERT INTO registration_requests(id,contact_name,email,phone,category_id,message,type,privacy_version,privacy_record_id,submission_key,consented_at) SELECT ${id}::uuid,${data.contactName},${data.email},${data.phone||null},${data.categoryId}::uuid,${data.message},${data.type},${data.privacyVersion},${data.privacyVersion}::uuid,${key},clock_timestamp() FROM permit RETURNING id), logged AS (INSERT INTO audit_logs(action,entity_type,entity_id) SELECT 'request.create','registration_requests',id::text FROM created) SELECT (SELECT id FROM existing UNION ALL SELECT id FROM created LIMIT 1) AS id,EXISTS(SELECT 1 FROM policy) AS "policyValid",EXISTS(SELECT 1 FROM category) AS "categoryValid"`,z.object({id:z.uuid().nullable(),policyValid:z.boolean(),categoryValid:z.boolean()}));
   }catch(error){
    const cause=error instanceof Error&&error.cause&&typeof error.cause==='object'?error.cause:error;
    if(cause&&typeof cause==='object'&&'code' in cause&&cause.code==='23505'){
     const [existing]=await rows(db,sql`SELECT id FROM registration_requests WHERE submission_key=${key}`,idRow);if(existing)return;
    }
    throw error;
   }
   if(result?.id)return;
   if(!result?.policyValid)throw new ContentError(409,'L’informativa è cambiata. Ricarica il modulo e rileggila.');
   if(!result.categoryValid)throw new ContentError(400,'La categoria non è più disponibile.');
   throw new ContentError(429,'Troppi invii ravvicinati. Riprova tra 15 minuti.');
  },
  async list(actor:Actor,page=1){permitted(actor,'requests.read');if(!Number.isInteger(page)||page<1||page>10000)throw new ContentError(400,'Pagina non valida.');const items=await rows(db,sql`${selectRequests} ORDER BY r.created_at DESC,r.id LIMIT 26 OFFSET ${(page-1)*25}`,requestRow);return {items:items.slice(0,25),page,hasMore:items.length>25};},
  async update(actor:Actor,input:unknown){permitted(actor,'requests.write');const data=requestUpdate.parse(input);const [saved]=await rows(db,sql`WITH changed AS (UPDATE registration_requests SET status=${data.status},updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond') WHERE id=${data.id}::uuid AND date_trunc('milliseconds',updated_at)=${data.version}::timestamptz RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'request.update','registration_requests',id::text FROM changed) SELECT id FROM changed`,idRow);if(!saved)throw new ContentError(409,'La richiesta è cambiata. Ricarica i dati.');return saved;},
  async remove(actor:Actor,input:unknown){permitted(actor,'requests.write');const data=requestDelete.parse(input);const [saved]=await rows(db,sql`WITH changed AS (DELETE FROM registration_requests WHERE id=${data.id}::uuid AND date_trunc('milliseconds',updated_at)=${data.version}::timestamptz RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'request.delete','registration_requests',id::text FROM changed) SELECT id FROM changed`,idRow);if(!saved)throw new ContentError(409,'La richiesta è cambiata o è già stata eliminata.');return saved;},
  async purge(){
   const policy=await settings();if(!policy)return {requests:0,limits:0};
   const [result]=await rows(db,sql`WITH expired AS (DELETE FROM registration_requests WHERE created_at<now()-make_interval(days=>LEAST(COALESCE((SELECT retention_days FROM request_privacy_versions p WHERE p.id=registration_requests.privacy_record_id),30),${policy.retentionDays}::integer)) RETURNING id), limits AS (DELETE FROM request_rate_limits WHERE window_started<now()-interval '24 hours' RETURNING key), logged AS (INSERT INTO audit_logs(action,entity_type,entity_id) SELECT 'request.expire','registration_requests',id::text FROM expired) SELECT (SELECT count(*)::integer FROM expired) AS requests,(SELECT count(*)::integer FROM limits) AS limits`,z.object({requests:z.number(),limits:z.number()}));return result;
  },
 };
}
