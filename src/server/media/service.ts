import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {rows,type Executor} from '../content/service.ts';
import {can,type Grant} from '../auth/permissions.ts';
import {ContentError} from '../content/errors.ts';
import {mediaInput,mediaUpdate,mediaItem,localMediaUrl} from '../../shared/media.ts';
import type {ImageStore} from './storage.ts';
interface Actor{userId:string;grants:Grant[]}
function admin(actor:Actor){if(!can(actor.grants,'media.write'))throw new ContentError(403,'La libreria immagini è riservata agli amministratori.');}
const keyRow=z.object({id:z.uuid(),key:z.string()});
export function mediaService(db:Executor,store:ImageStore){
 return {
  async list(actor:Actor,page=1){admin(actor);if(!Number.isInteger(page)||page<1||page>10000)throw new ContentError(400,'Pagina non valida.');const items=await rows(db,sql`SELECT m.id,m.alt,m.url,m.publication_consent AS consent,m.size_bytes AS size,m.xmin::text AS version,((SELECT count(*) FROM news WHERE cover_id=m.id)+(SELECT count(*) FROM sponsors WHERE logo_id=m.id))::integer AS used FROM media m ORDER BY m.created_at DESC,m.id LIMIT 26 OFFSET ${(page-1)*25}`,mediaItem);return {items:items.slice(0,25),page,hasMore:items.length>25};},
  async create(actor:Actor,input:unknown,data:Uint8Array){
   admin(actor);const meta=mediaInput.parse(input),id=randomUUID(),key='images/'+id+'.webp';
   await store.put(key,data);
   try{
    const inserted=await rows(db,sql`WITH quota AS (INSERT INTO site_settings(key,value) SELECT 'media.quota',jsonb_build_object('used',(SELECT count(*)::integer FROM media)+1) WHERE (SELECT count(*) FROM media)<500 ON CONFLICT(key) DO UPDATE SET value=jsonb_build_object('used',(site_settings.value->>'used')::integer+1),updated_at=now() WHERE (site_settings.value->>'used')::integer<500 RETURNING key), created AS (INSERT INTO media(id,storage_key,url,alt,mime_type,size_bytes,publication_consent) SELECT ${id}::uuid,${key},${localMediaUrl(id)},${meta.alt},'image/webp',${data.length},true FROM quota RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'media.create','media',id::text FROM created) SELECT id FROM created`,z.object({id:z.uuid()}));
    if(!inserted.length)throw new ContentError(409,'La libreria è piena (500 immagini) o è in corso un altro caricamento. Rimuovi immagini inutilizzate oppure riprova.');
    return {id};
   }catch(error){try{await store.remove(key);}catch{console.error(JSON.stringify({event:'media_cleanup_needed',id}));}throw error;}
  },
  async update(actor:Actor,input:unknown){admin(actor);const data=mediaUpdate.parse(input);const changed=await rows(db,sql`WITH changed AS (UPDATE media SET alt=${data.alt},publication_consent=${data.consent} WHERE id=${data.id}::uuid AND xmin::text=${data.version} RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'media.update','media',id::text FROM changed) SELECT id FROM changed`,z.object({id:z.uuid()}));if(!changed.length)throw new ContentError(409,'L’immagine è cambiata: ricarica la libreria prima di salvare.');return changed[0];},
  async remove(actor:Actor,input:unknown){admin(actor);const data=z.object({id:z.uuid(),version:z.string().regex(/^\d{1,20}$/)}).strict().parse(input);const [removed]=await rows(db,sql`WITH removed AS (DELETE FROM media WHERE id=${data.id}::uuid AND xmin::text=${data.version} AND NOT EXISTS(SELECT 1 FROM news WHERE cover_id=media.id) AND NOT EXISTS(SELECT 1 FROM sponsors WHERE logo_id=media.id) RETURNING id,storage_key AS key), released AS (UPDATE site_settings SET value=jsonb_build_object('used',greatest(0,(value->>'used')::integer-1)),updated_at=now() WHERE key='media.quota' AND EXISTS(SELECT 1 FROM removed)), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'media.delete','media',id::text FROM removed) SELECT * FROM removed`,keyRow);if(!removed)throw new ContentError(409,'L’immagine è in uso oppure è cambiata. Scollegala dai contenuti e ricarica la libreria prima di eliminarla.');try{if(/^images\/[0-9a-f-]+\.webp$/.test(removed.key))await store.remove(removed.key);}catch{console.error(JSON.stringify({event:'media_cleanup_needed',id:removed.id}));}return {id:removed.id};},
  async file(id:string,actor?:Actor){z.uuid().parse(id);if(actor)admin(actor);const [row]=await rows(db,sql`SELECT m.id,m.storage_key AS key FROM media m WHERE m.id=${id}::uuid AND m.mime_type='image/webp' AND m.storage_key=${'images/'+id+'.webp'} AND ${actor?sql`true`:sql`m.publication_consent=true AND (EXISTS(SELECT 1 FROM news n WHERE n.cover_id=m.id AND n.status IN ('published','scheduled') AND n.publish_at<=now()) OR EXISTS(SELECT 1 FROM sponsors s WHERE s.logo_id=m.id AND s.active=true))`}`,keyRow);return row?store.get(row.key):null;},
 };
}
