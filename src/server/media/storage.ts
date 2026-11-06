import {getStore} from '@netlify/blobs';
export interface ImageStore{put(key:string,data:Uint8Array):Promise<void>;get(key:string):Promise<ArrayBuffer|null>;remove(key:string):Promise<void>}
export function imageStore():ImageStore{
 const store=getStore({name:'club-media',consistency:'strong'});
 return {async put(key,data){await store.set(key,new Uint8Array(data).buffer);},async get(key){return store.get(key,{type:'arrayBuffer'});},async remove(key){await store.delete(key);}};
}
