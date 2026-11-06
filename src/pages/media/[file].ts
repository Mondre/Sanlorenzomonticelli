import type {APIRoute} from 'astro';
import {z} from 'zod';
import {database} from '../../server/db/client';
import {imageStore} from '../../server/media/storage';
import {mediaService} from '../../server/media/service';
export const prerender=false;
export const GET:APIRoute=async({params})=>{
 const id=z.uuid().safeParse(params.file?.replace(/\.webp$/,''));
 if(!params.file?.endsWith('.webp')||!id.success)return new Response(null,{status:404});
 try{const bytes=await mediaService(database(),imageStore()).file(id.data);return bytes?new Response(bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}}):new Response(null,{status:404});}catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}
};
