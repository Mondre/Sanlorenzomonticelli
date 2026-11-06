import {sportSource} from '../../shared/sports-import.ts';
import {parseSports} from './parser.ts';
export async function fetchPage(url:string,fetcher:typeof fetch=fetch){
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html','User-Agent':'SanLorenzoMonticelli-SportsSync/1.0'}});
 if(response.status!==200||!response.headers.get('content-type')?.includes('text/html')||response.headers.get('x-amzn-waf-action')){await response.body?.cancel();throw new Error('SOURCE_UNAVAILABLE');}
 const reader=response.body?.getReader();if(!reader)throw new Error('SOURCE_UNAVAILABLE');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000)throw new Error('SOURCE_TOO_LARGE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 const type=response.headers.get('content-type')??'';
 return new TextDecoder(/charset\s*=\s*["']?(iso-8859-1|windows-1252)/i.test(type)?'windows-1252':'utf-8',{fatal:true}).decode(data);
}
export async function fetchSports(fetcher:typeof fetch=fetch){
 // Two fixed URLs only. Never follow URLs supplied by an administrator or by source markup.
 const calendar=await fetchPage(sportSource.calendarUrl,fetcher);
 const standings=await fetchPage(sportSource.standingsUrl,fetcher);
 return parseSports(calendar,standings);
}
