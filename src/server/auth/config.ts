import { z } from 'zod';
export interface AuthConfiguration { origin:string; secret:string }
export function validateAuthConfiguration(input:{origin?:string;secret?:string}): AuthConfiguration {
 const secret=z.string().min(32).parse(input.secret);
 const origin=new URL(z.url().parse(input.origin));
 if(origin.pathname!=='/' || origin.search || origin.hash || origin.username || origin.password)throw new Error('Invalid authentication origin');
 if(origin.protocol!=='https:' && !(origin.protocol==='http:' && ['localhost','127.0.0.1'].includes(origin.hostname)))throw new Error('HTTPS required');
 return {origin:origin.origin,secret};
}
