import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {rows,type Executor} from '../content/service.ts';
import {ContentError} from '../content/errors.ts';
import {can,type Grant} from '../auth/permissions.ts';
import {sportsSnapshot,type ImportState} from '../../shared/sports-import.ts';
import {fetchSports} from './fetch.ts';
import {importDiagnostic} from './diagnostics.ts';
const configKey='sports.romagnasport.config',snapshotKey='sports.romagnasport.2026',attemptKey='sports.romagnasport.attempt';
const stored=z.object({key:z.string(),value:z.unknown(),retryAt:z.string().nullable()});
const attemptSchema=z.object({token:z.string(),lastAttemptAt:z.iso.datetime(),lastError:z.string().nullable(),lastErrorCode:z.string().optional(),lastErrorReference:z.string().optional()});
interface Actor{userId:string;grants:Grant[]}
function admin(actor:Actor){if(!can(actor.grants,'settings.write'))throw new ContentError(403,'Questa funzione è riservata agli amministratori.');}
export function sportsImportService(db:Executor,fetcher=fetchSports){
 async function state():Promise<ImportState>{
  const data=await rows(db,sql`SELECT key,value,CASE WHEN key=${attemptKey} THEN to_char((updated_at+interval '15 minutes') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ELSE NULL END AS "retryAt" FROM site_settings WHERE key IN (${configKey},${snapshotKey},${attemptKey})`,stored);
  const config=data.find(r=>r.key===configKey),snapshot=data.find(r=>r.key===snapshotKey),attempt=data.find(r=>r.key===attemptKey);
  const meta=attempt?attemptSchema.parse(attempt.value):null;
  return {enabled:config?z.object({enabled:z.boolean()}).parse(config.value).enabled:false,snapshot:snapshot?sportsSnapshot.parse(snapshot.value):null,lastAttemptAt:meta?.lastAttemptAt??null,lastError:meta?.lastError??null,retryAt:attempt?.retryAt??null,lastErrorCode:meta?.lastErrorCode??null,lastErrorReference:meta?.lastErrorReference??null};
 }
 return {
  state,
  async publicSnapshot(){const data=await state();return data.enabled?data.snapshot:null;},
  async configure(actor:Actor,input:unknown){
   admin(actor);const {enabled}=z.object({enabled:z.boolean()}).strict().parse(input);
   await db.execute(sql`WITH configured AS (INSERT INTO site_settings(key,value) VALUES (${configKey},${JSON.stringify({enabled})}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now() RETURNING key) INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) SELECT ${actor.userId},'sports_import.configure','site_settings',key,${JSON.stringify({enabled})}::jsonb FROM configured`);
   return state();
  },
  async refresh(actor:Actor|null){
   if(actor)admin(actor);
   const current=await state();if(!current.enabled)throw new ContentError(409,'Attiva la fonte prima di aggiornare i dati.');
   const token=randomUUID(),lastAttemptAt=new Date().toISOString();
   const claimed=await rows(db,sql`INSERT INTO site_settings(key,value) VALUES (${attemptKey},${JSON.stringify({token,lastAttemptAt,lastError:null})}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now() WHERE site_settings.updated_at<now()-interval '15 minutes' RETURNING key`,z.object({key:z.string()}));
   if(!claimed.length){const blocked=await state();throw new ContentError(429,`${blocked.lastError??'Un aggiornamento è già in corso o è stato tentato di recente.'} ${blocked.lastErrorCode?'Codice: '+blocked.lastErrorCode+'. ':''}Il prossimo tentativo è disponibile alle ${blocked.retryAt?new Date(blocked.retryAt).toLocaleTimeString('it-IT',{timeZone:'Europe/Rome'}):'ore indicate nel pannello'} (ora italiana).`);}
   let phase:'source'|'save'='source';
   try{
    const snapshot=sportsSnapshot.parse(await fetcher());
    phase='save';
    await db.execute(sql`WITH saved AS (INSERT INTO site_settings(key,value) SELECT ${snapshotKey},${JSON.stringify(snapshot)}::jsonb WHERE EXISTS(SELECT 1 FROM site_settings WHERE key=${attemptKey} AND value->>'token'=${token}) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now() RETURNING key) INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) SELECT ${actor?.userId??null},'sports_import.refresh','site_settings',key,${JSON.stringify({season:snapshot.season,matches:snapshot.matches.length,teams:snapshot.standings.length})}::jsonb FROM saved`);
    return state();
   }catch(error){
    const diagnostic=importDiagnostic(error,phase,token);
    // Deliberately exclude error messages, SQL, response bodies and credentials.
    console.error(JSON.stringify({event:'sports_import_failure',code:diagnostic.code,stage:diagnostic.stage,httpStatus:diagnostic.httpStatus,reference:diagnostic.reference}));
    const message=diagnostic.message+' L’ultimo aggiornamento valido, se presente, è conservato.';
    try{await db.execute(sql`UPDATE site_settings SET value=value||${JSON.stringify({lastError:message,lastErrorCode:diagnostic.code,lastErrorReference:diagnostic.reference})}::jsonb WHERE key=${attemptKey} AND value->>'token'=${token}`);}catch{console.error(JSON.stringify({event:'sports_import_diagnostic_save_failed',reference:token}));}
    throw new ContentError(503,`${message} Codice: ${diagnostic.code}. Riferimento: ${token}.`);
   }
  },
 };
}
