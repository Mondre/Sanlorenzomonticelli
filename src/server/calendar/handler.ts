import {z} from 'zod';
import {contentService,type Executor} from '../content/service.ts';
import {ContentError} from '../content/errors.ts';
import {contentFailure} from '../content/request.ts';
import {canExportMatch} from '../../shared/calendar.ts';
import {calendarOrigin,serializeCalendar} from './ical.ts';
const filters=z.object({id:z.uuid().optional(),category:z.uuid().optional(),season:z.uuid().optional(),mode:z.enum(['all','upcoming','results']).default('upcoming')}).strict().refine(v=>!v.id||(!v.category&&!v.season),'Seleziona una partita oppure i filtri del calendario.');
export async function calendarResponse(request:Request,getDatabase:()=>Executor,siteURL?:string){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 try{
  const input=filters.parse(Object.fromEntries(new URL(request.url).searchParams)),service=contentService(getDatabase());
  const items=input.id?[await service.match(input.id)].filter((m):m is NonNullable<typeof m>=>m!==null):await service.calendarMatches({categoryId:input.category,seasonId:input.season,mode:input.mode});
  if(!items.length)throw new ContentError(404,'Non ci sono partite disponibili per questo calendario.');
  if(!items.every(canExportMatch))throw new ContentError(409,'La data della partita è assente o ancora da confermare. Attendi l’aggiornamento della scheda prima di salvarla nel calendario.');
  return new Response(serializeCalendar(items,calendarOrigin(siteURL)),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="san-lorenzo-${input.id?'partita-'+input.id:'partite'}.ics"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return contentFailure(error);}
}
