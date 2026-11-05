import {z} from 'zod';
import {ContentError} from './errors.ts';
import {AccessDenied} from '../auth/authorize-request.ts';
import {json,unavailable} from '../http.ts';
export function mutationOrigin(request:Request,origin:string|undefined){
 if(!origin)throw new ContentError(503,'Servizio non disponibile.');
 if(request.headers.get('origin')!==new URL(origin).origin)throw new ContentError(403,'Origine della richiesta non autorizzata.');
 if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw new ContentError(415,'Formato della richiesta non supportato.');
}
export async function readInput(request:Request){
 if(!request.body)throw new ContentError(400,'Richiesta vuota.');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new ContentError(413,'Il contenuto è troppo lungo.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const joined=new Uint8Array(size);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined)) as unknown;}catch{throw new ContentError(400,'Dati non validi.');}
}
export function contentFailure(error:unknown){
 if(error instanceof AccessDenied)return json({error:{message:error.status===401?'Accedi per continuare.':'Non hai i permessi per questa operazione.'}},error.status);
 if(error instanceof ContentError)return json({error:{message:error.message}},error.status);
 if(error instanceof z.ZodError)return json({error:{message:'Controlla i campi inseriti.',fields:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))}},400);
 const cause=error instanceof Error && error.cause && typeof error.cause==='object'?error.cause:error;
 const code=cause && typeof cause==='object' && 'code' in cause?cause.code:null;
 if(code==='23503'||code==='23514')return json({error:{message:'Verifica squadre, competizione e dati inseriti.'}},400);
 if(code==='23505')return json({error:{message:'Questo contenuto esiste già.'}},409);
 return unavailable();
}
export function pageNumber(request:Request){return z.coerce.number().int().min(1).max(10000).parse(new URL(request.url).searchParams.get('page')??1);}
