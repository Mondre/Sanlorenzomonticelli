import process from 'node:process';
import {accountHasAccess} from '../users/access';
import {configurationIssue,AuthSetupError,type AuthFailureCode} from './diagnostics';
import { database } from '../db/client';
import { createAuth } from './create-auth';
import { validateAuthConfiguration } from './config';
export function authentication(report?:(code:AuthFailureCode)=>void) {
 const issue=configurationIssue(process.env);
 if(issue)throw new AuthSetupError(issue);
 const db=database();
 return createAuth(db,validateAuthConfiguration({origin:process.env.BETTER_AUTH_URL,secret:process.env.BETTER_AUTH_SECRET}),report,userId=>accountHasAccess(db,userId));
}
