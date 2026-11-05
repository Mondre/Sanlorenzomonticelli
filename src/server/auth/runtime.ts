import process from 'node:process';
import { database } from '../db/client';
import { createAuth } from './create-auth';
import { validateAuthConfiguration } from './config';
export function authentication() {
 return createAuth(database(),validateAuthConfiguration({origin:process.env.BETTER_AUTH_URL,secret:process.env.BETTER_AUTH_SECRET}));
}
