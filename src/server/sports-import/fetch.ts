import {sportSource} from '../../shared/sports-import.ts';
import {parseSports} from './parser.ts';
import {SourceError} from './diagnostics.ts';
export async function fetchPage(url:string,fetcher:typeof fetch=fetch){
 const stage=url===sportSource.calendarUrl?'calendar':'standings';
 let response:Response;
 try{response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html','User-Agent':'SanLorenzoMonticelli-SportsSync/1.0'}});}catch(error){throw new SourceError(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'SOURCE_TIMEOUT':'SOURCE_NETWORK_ERROR',stage);}
 if(response.status!==200||response.headers.get('x-amzn-waf-action')){await response.body?.cancel();throw new SourceError(response.headers.get('x-amzn-waf-action')?'SOURCE_CHALLENGE':'SOURCE_HTTP_ERROR',stage,response.status);}
 if(!response.headers.get('content-type')?.toLowerCase().includes('text/html')){await response.body?.cancel();throw new SourceError('SOURCE_CONTENT_TYPE',stage);}
 const reader=response.body?.getReader();if(!reader)throw new SourceError('SOURCE_NETWORK_ERROR',stage);
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000)throw new SourceError('SOURCE_TOO_LARGE',stage);chunks.push(value);}}
 catch(error){if(error instanceof SourceError)throw error;throw new SourceError(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'SOURCE_TIMEOUT':'SOURCE_NETWORK_ERROR',stage);}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
 const type=response.headers.get('content-type')??'';
 let html:string;
 try{html=new TextDecoder(/charset\s*=\s*["']?(iso-8859-1|windows-1252)/i.test(type)?'windows-1252':'utf-8',{fatal:true}).decode(data);}catch{throw new SourceError('SOURCE_ENCODING_ERROR',stage);}
 if(/challenge-platform|cf-chl-|verify you are human/i.test(html))throw new SourceError('SOURCE_CHALLENGE',stage);
 return html;
}
export async function fetchSports(fetcher:typeof fetch=fetch){
 // Two fixed URLs only. Parallel requests keep the operation within the function budget.
 const [calendar,standings]=await Promise.all([fetchPage(sportSource.calendarUrl,fetcher),fetchPage(sportSource.standingsUrl,fetcher)]);
 try{return parseSports(calendar,standings);}catch{throw new SourceError('SOURCE_FORMAT_CHANGED','parse');}
}
