import {z} from 'zod';
import {publicHttpsUrl} from './club-content.ts';
export const mediaInput=z.object({alt:z.string().trim().min(3).max(200),consent:z.literal(true)}).strict();
export const mediaUpdate=z.object({id:z.uuid(),version:z.string().regex(/^\d{1,20}$/),alt:z.string().trim().min(3).max(200),consent:z.boolean()}).strict();
export const mediaItem=z.object({id:z.uuid(),alt:z.string(),url:z.string(),consent:z.boolean(),size:z.number(),version:z.string(),used:z.number()});
export type MediaItem=z.infer<typeof mediaItem>;
export function localMediaUrl(id:string){return '/media/'+id+'.webp';}
export function safeImageUrl(value:string|null|undefined){
 if(!value)return null;
 if(/^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(value))return value;
 const valid=publicHttpsUrl(value);if(valid){const url=new URL(valid);if(!url.search&&!url.hash)return valid;}
 return null;
}
