import {z} from 'zod';
import {ContentError} from './errors.ts';
export const listFilters=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),search:z.string().trim().max(100).default(''),categoryId:z.uuid().optional(),mode:z.enum(['all','upcoming','results']).default('all')});
export function filtersFrom(url:URL){return listFilters.parse({page:url.searchParams.get('page')??1,search:url.searchParams.get('search')??'',categoryId:url.searchParams.get('category')||undefined,mode:url.searchParams.get('mode')??'all'});}
export function pageFailure(error:unknown){if(error instanceof z.ZodError)return {status:400,message:'I filtri selezionati non sono validi.'};if(error instanceof ContentError)return {status:error.status,message:error.message};return {status:503,message:'I contenuti non sono disponibili in questo momento. Riprova più tardi.'};}
export function pageLink(url:URL,page:number){const copy=new URL(url);copy.searchParams.set('page',String(page));return copy.pathname+copy.search;}
