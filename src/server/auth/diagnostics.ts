import {validateAuthConfiguration} from './config.ts';
export type AuthFailureCode='DATABASE_URL_MISSING'|'DATABASE_URL_INVALID'|'AUTH_SECRET_MISSING'|'AUTH_SECRET_TOO_SHORT'|'AUTH_URL_MISSING'|'AUTH_URL_INVALID'|'DATABASE_AUTH_FAILED'|'DATABASE_NOT_FOUND'|'DATABASE_SCHEMA_MISSING'|'DATABASE_SCHEMA_OUTDATED'|'DATABASE_CONNECTION_LIMIT'|'DATABASE_NOT_READY'|'DATABASE_NETWORK_ERROR'|'CLIENT_IP_UNAVAILABLE'|'AUTH_INTERNAL_ERROR';
export class AuthSetupError extends Error{readonly code:AuthFailureCode;constructor(code:AuthFailureCode){super('Authentication setup unavailable');this.code=code;}}
export function configurationIssue(env:{DATABASE_URL?:string;BETTER_AUTH_URL?:string;BETTER_AUTH_SECRET?:string}):AuthFailureCode|null{
 if(!env.DATABASE_URL)return 'DATABASE_URL_MISSING';
 try{const u=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname)return 'DATABASE_URL_INVALID';}catch{return 'DATABASE_URL_INVALID';}
 if(!env.BETTER_AUTH_SECRET)return 'AUTH_SECRET_MISSING';
 if(env.BETTER_AUTH_SECRET.length<32)return 'AUTH_SECRET_TOO_SHORT';
 if(!env.BETTER_AUTH_URL)return 'AUTH_URL_MISSING';
 try{validateAuthConfiguration({origin:env.BETTER_AUTH_URL,secret:env.BETTER_AUTH_SECRET});}catch{return 'AUTH_URL_INVALID';}
 return null;
}
export function safeAuthFailure(error:unknown):AuthFailureCode{
 const sqlCodes:Record<string,AuthFailureCode>={'28P01':'DATABASE_AUTH_FAILED','3D000':'DATABASE_NOT_FOUND','42P01':'DATABASE_SCHEMA_MISSING','42703':'DATABASE_SCHEMA_OUTDATED','53300':'DATABASE_CONNECTION_LIMIT','57P03':'DATABASE_NOT_READY','ECONNRESET':'DATABASE_NETWORK_ERROR','ECONNREFUSED':'DATABASE_NETWORK_ERROR','ETIMEDOUT':'DATABASE_NETWORK_ERROR','ENOTFOUND':'DATABASE_NETWORK_ERROR','UND_ERR_CONNECT_TIMEOUT':'DATABASE_NETWORK_ERROR'};
 const pending:unknown[]=[error];let remaining=12;
 while(pending.length&&remaining--){const item=pending.shift();if(item instanceof AuthSetupError)return item.code;
  if(Array.isArray(item)){pending.push(...item.slice(0,5));continue;}
  if(item&&typeof item==='object'){
   if('code' in item&&typeof item.code==='string'&&sqlCodes[item.code])return sqlCodes[item.code]!;
   if('cause' in item)pending.push(item.cause);
   if('message' in item&&typeof item.message==='string')pending.push(item.message);
  }
  // Inspect messages only to select a fixed code. Never return or log the message.
  if(typeof item==='string'){
   if(/password authentication failed/i.test(item))return 'DATABASE_AUTH_FAILED';
   if(/relation .{0,200} does not exist/i.test(item))return 'DATABASE_SCHEMA_MISSING';
   if(/column .{0,200} does not exist/i.test(item))return 'DATABASE_SCHEMA_OUTDATED';
   if(/fetch failed|connection timeout|connect timed out/i.test(item))return 'DATABASE_NETWORK_ERROR';
  }
 }
 return 'AUTH_INTERNAL_ERROR';
}
