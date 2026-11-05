import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { users, sessions, accounts, verifications, authRateLimits } from '../db/schema.ts';
import type { AuthConfiguration } from './config.ts';
export function createAuth(db: Parameters<typeof drizzleAdapter>[0], config: AuthConfiguration) {
 return betterAuth({
  appName:'San Lorenzo Monticelli', baseURL:config.origin,basePath:'/api/auth',secret:config.secret,
  trustedOrigins:[config.origin],
  database:drizzleAdapter(db,{provider:'pg',transaction:false,schema:{user:users,session:sessions,account:accounts,verification:verifications,rateLimit:authRateLimits}}),
  emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:14,maxPasswordLength:128},
  session:{expiresIn:60*60*8,updateAge:60*60,cookieCache:{enabled:false}},
  rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:5}}},
  advanced:{useSecureCookies:config.origin.startsWith('https:'),defaultCookieAttributes:{httpOnly:true,sameSite:'lax'},ipAddress:{ipAddressHeaders:['x-portal-client-ip']}},
  logger:{disabled:true},
 });
}
