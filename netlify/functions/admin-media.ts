import process from 'node:process';
import {authorize} from '../../src/server/auth/authorize';
import {database} from '../../src/server/db/client';
import {mediaService} from '../../src/server/media/service';
import {imageStore} from '../../src/server/media/storage';
import {prepareImage,maxUpload} from '../../src/server/media/image';
import {contentFailure,readInput,mutationOrigin,pageNumber} from '../../src/server/content/request';
import {ContentError} from '../../src/server/content/errors';
import {json} from '../../src/server/http';
import {z} from 'zod';
export const config={path:'/api/admin/media'};
async function upload(request:Request){
 const type=request.headers.get('content-type')??'';if(!type.startsWith('multipart/form-data;'))throw new ContentError(415,'Formato di caricamento non valido.');
 const reader=request.body?.getReader();if(!reader)throw new ContentError(400,'Seleziona un’immagine.');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxUpload+16384)throw new ContentError(413,'Scegli un’immagine fino a 3 MB.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
 let form:FormData;try{form=await new Response(data,{headers:{'Content-Type':type}}).formData();}catch{throw new ContentError(400,'Caricamento non valido.');}
 if([...form.keys()].some(k=>!['file','alt','consent'].includes(k))||['file','alt','consent'].some(k=>form.getAll(k).length!==1))throw new ContentError(400,'Campi del caricamento non validi.');
 const file=form.get('file');if(!(file instanceof File))throw new ContentError(400,'Seleziona un’immagine.');
 return {meta:{alt:form.get('alt'),consent:form.get('consent')==='true'},bytes:new Uint8Array(await file.arrayBuffer())};
}
export default async function handler(request:Request){
 if(!['GET','POST','PUT','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, POST, PUT, DELETE'}});
 try{
  if(request.method==='POST'){if(!process.env.BETTER_AUTH_URL)throw new ContentError(503,'Servizio non disponibile.');if(request.headers.get('origin')!==new URL(process.env.BETTER_AUTH_URL).origin)throw new ContentError(403,'Origine non autorizzata.');}
  else if(request.method!=='GET')mutationOrigin(request,process.env.BETTER_AUTH_URL);
  const {session,grants}=await authorize(request,'media.write'),actor={userId:session.user.id,grants},service=mediaService(database(),imageStore()),url=new URL(request.url);
  if(request.method==='GET'){if(url.searchParams.has('id')){const id=z.uuid().parse(url.searchParams.get('id')),file=await service.file(id,actor);return file?new Response(file,{headers:{'Content-Type':'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="${id}.webp"`}}):new Response(null,{status:404});}return json(await service.list(actor,pageNumber(request)));}
  if(request.method==='POST'){const {meta,bytes}=await upload(request);return json(await service.create(actor,meta,await prepareImage(bytes)),201);}
  if(request.method==='PUT')return json(await service.update(actor,await readInput(request)));
  return json(await service.remove(actor,await readInput(request)));
 }catch(error){return contentFailure(error);}
}
