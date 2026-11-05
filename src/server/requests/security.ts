import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {ContentError} from '../content/errors.ts';
function digest(secret:string,value:string){if(secret.length<32)throw new ContentError(503,'Servizio temporaneamente non disponibile.');return createHmac('sha256',secret).update(value).digest('hex');}
export function ipDigest(secret:string,ip:string){
 if(!isIP(ip))throw new ContentError(503,'Servizio temporaneamente non disponibile.');
 const canonical=isIP(ip)===6?new URL('http://['+ip+']/').hostname.toLowerCase():ip;
 return digest(secret,'request-ip-v1:'+canonical);
}
export function submissionDigest(secret:string,id:string){return digest(secret,'request-submission-v1:'+id);}
export function issueChallenge(secret:string,ipHash:string,version:string,now=Date.now()){
 const value=String(now)+'.'+randomBytes(12).toString('hex');return value+'.'+digest(secret,'request-challenge-v1:'+ipHash+':'+version+':'+value);
}
export function verifyChallenge(secret:string,ipHash:string,version:string,token:string,now=Date.now()){
 const match=/^(\d{13})\.([a-f0-9]{24})\.([a-f0-9]{64})$/.exec(token);
 if(!match)throw new ContentError(400,'Il modulo è scaduto. Ricaricalo e riprova.');
 const value=match[1]+'.'+match[2],expected=digest(secret,'request-challenge-v1:'+ipHash+':'+version+':'+value);
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(match[3]!, 'hex')))throw new ContentError(400,'Il modulo è scaduto. Ricaricalo e riprova.');
 const age=now-Number(match[1]);if(age<3000)throw new ContentError(400,'Attendi qualche secondo prima di inviare.');if(age>30*60*1000)throw new ContentError(400,'Il modulo è scaduto. Ricaricalo e riprova.');
}
