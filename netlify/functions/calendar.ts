import process from 'node:process';
import {database} from '../../src/server/db/client';
import {calendarResponse} from '../../src/server/calendar/handler';
export const config={path:'/api/calendar.ics'};
export default async function handler(request:Request){return calendarResponse(request,database,process.env.SITE_URL??process.env.BETTER_AUTH_URL);}
