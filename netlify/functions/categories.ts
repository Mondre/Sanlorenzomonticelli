import { asc, eq } from 'drizzle-orm';
import { database } from '../../src/server/db/client';
import { categories } from '../../src/server/db/schema';
import { json, unavailable } from '../../src/server/http';
export default async function handler(request: Request) {
 if (request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET'}});
 try {
  const data = await database().select({id:categories.id,name:categories.name,slug:categories.slug,description:categories.description}).from(categories).where(eq(categories.active,true)).orderBy(asc(categories.sortOrder),asc(categories.name));
  return json({data});
 } catch { return unavailable(); }
}
