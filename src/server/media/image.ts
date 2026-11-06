import sharp from 'sharp';
import {ContentError} from '../content/errors.ts';
export const maxUpload=3*1024*1024;
export async function prepareImage(data:Uint8Array){
 if(!data.length||data.length>maxUpload)throw new ContentError(413,'Scegli un’immagine fino a 3 MB.');
 try{
  const input=sharp(data,{limitInputPixels:24_000_000,animated:false,failOn:'warning'}),meta=await input.metadata();
  if(!['jpeg','png','webp','avif','heif'].includes(meta.format??'')||(meta.pages??1)>1||!meta.width||!meta.height||meta.width*meta.height>24_000_000)throw new Error();
  const output=await input.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();
  if(output.length>2*1024*1024)throw new ContentError(413,'L’immagine è troppo complessa. Riducila prima di caricarla.');
  return output;
 }catch(error){if(error instanceof ContentError)throw error;throw new ContentError(400,'Immagine non valida. Usa JPG, PNG, WebP o AVIF statici fino a 24 megapixel.');}
}
