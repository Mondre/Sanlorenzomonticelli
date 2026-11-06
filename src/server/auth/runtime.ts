import process from 'node:process';
import {configurationIssue,AuthSetupError,type AuthFailureCode} from './diagnostics';
import { database } from '../db/client';
import { createAuth } from './create-auth';
import { validateAuthConfiguration } from './config';
export function authentication(report?:(code:AuthFailureCode)=>void) {
 const issue=configurationIssue(process.env);
 if(issue)throw new AuthSetupError(issue);
 return createAuth(database(),validateAuthConfiguration({origin:process.env.BETTER_AUTH_URL,secret:process.env.BETTER_AUTH_SECRET}),report);
}
