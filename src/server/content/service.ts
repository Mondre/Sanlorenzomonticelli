import {randomUUID} from 'node:crypto';
import {sql,type SQL} from 'drizzle-orm';
import {z} from 'zod';
import {can,type Grant,type Action} from '../auth/permissions.ts';
import {newsCreate,newsUpdate,deleteInput,matchCreate,matchUpdate,articleRow,matchRow,type Options} from '../../shared/content.ts';
import {ContentError} from './errors.ts';
export interface Executor{execute:(query:SQL)=>PromiseLike<unknown>}
interface Actor{userId:string;grants:Grant[]}
export async function rows<T>(db:Executor,statement:SQL,shape:z.ZodType<T>):Promise<T[]>{return z.object({rows:z.array(shape)}).parse(await db.execute(statement)).rows;}
const idRow=z.object({id:z.uuid()});
const pagination=(page:number)=>{if(!Number.isInteger(page)||page<1||page>10000)throw new ContentError(400,'Pagina non valida.');return (page-1)*25;};
const inIds=(ids:string[])=>sql.join(ids.map(id=>sql`${id}::uuid`),sql`, `);
export function categoryScope(grants:Grant[],action:Action,column:SQL){
 if(can(grants,action))return sql`true`;
 const ids=[...new Set(grants.filter(g=>g.categoryId && can([g],action,g.categoryId)).map(g=>g.categoryId!))];
 return ids.length?sql`${column} IN (${inIds(ids)})`:sql`false`;
}
function newsScope(grants:Grant[],action:'news.read'|'news.write'){
 if(can(grants,action))return sql`true`;
 return sql`EXISTS(SELECT 1 FROM news_categories nc WHERE nc.news_id=n.id) AND NOT EXISTS(SELECT 1 FROM news_categories nc WHERE nc.news_id=n.id AND NOT (${categoryScope(grants,action,sql`nc.category_id`)}))`;
}
const newsSelect=sql`SELECT n.id,n.slug,n.title,n.excerpt,n.body,n.status,n.publish_at AS "publishAt",n.featured,n.updated_at AS version,ARRAY(SELECT nc.category_id FROM news_categories nc WHERE nc.news_id=n.id ORDER BY nc.category_id) AS "categoryIds",(SELECT c.name FROM news_categories nc JOIN categories c ON c.id=nc.category_id WHERE nc.news_id=n.id ORDER BY c.sort_order,c.name LIMIT 1) AS "categoryName" FROM news n`;
const matchSelect=sql`SELECT m.id,m.competition_id AS "competitionId",c.name AS competition,s.name AS season,cat.id AS "categoryId",cat.name AS category,m.home_team_id AS "homeTeamId",m.away_team_id AS "awayTeamId",h.name AS "homeTeam",a.name AS "awayTeam",m.kickoff,m.round,m.venue_id AS "venueId",v.name AS venue,v.address,v.city,m.status,m.home_score AS "homeScore",m.away_score AS "awayScore",m.report,m.updated_at AS version FROM matches m JOIN competitions c ON c.id=m.competition_id JOIN seasons s ON s.id=c.season_id JOIN categories cat ON cat.id=c.category_id JOIN teams h ON h.id=m.home_team_id JOIN teams a ON a.id=m.away_team_id LEFT JOIN venues v ON v.id=m.venue_id`;
const visibleNews=sql`n.status IN ('published','scheduled') AND n.publish_at<=now()`;
function publication(input:{status:string;publishAt:string|null}){
 if(input.status==='draft')return null;
 if(input.status==='published')return input.publishAt&&new Date(input.publishAt)<=new Date()?input.publishAt:new Date().toISOString();
 if(!input.publishAt||new Date(input.publishAt)<=new Date())throw new ContentError(400,'Scegli una data futura per la pubblicazione programmata.');
 return input.publishAt;
}
export function contentService(db:Executor){
 async function checkArticle(actor:Actor,id:string){
  const [article]=await rows(db,sql`${newsSelect} WHERE n.id=${id}::uuid`,articleRow);
  if(!article)throw new ContentError(404,'Notizia non trovata.');
  const scopes=article.categoryIds.length?article.categoryIds:[undefined];
  if(!scopes.every(categoryId=>can(actor.grants,'news.write',categoryId)))throw new ContentError(403,'Non hai i permessi per questa notizia.');
  return article;
 }
 async function checkMatch(actor:Actor,id:string){
  const [match]=await rows(db,sql`${matchSelect} WHERE m.id=${id}::uuid`,matchRow);
  if(!match)throw new ContentError(404,'Partita non trovata.');
  if(!can(actor.grants,'matches.write',match.categoryId))throw new ContentError(403,'Non hai i permessi per questa partita.');
  return match;
 }
 async function changed(statement:SQL){const [row]=await rows(db,statement,idRow);if(!row)throw new ContentError(409,'Il contenuto è cambiato. Ricarica i dati prima di salvare.');return row;}
 return {
  async options(grants:Grant[]):Promise<Options>{
   const categories=await rows(db,sql`SELECT id,name FROM categories WHERE active=true ORDER BY sort_order,name`,z.object({id:z.uuid(),name:z.string()}));
   const allowed=categories.map(c=>({...c,news:can(grants,'news.write',c.id),matches:can(grants,'matches.write',c.id)})).filter(c=>c.news||c.matches);
   const competitions=await rows(db,sql`SELECT c.id,c.name,c.category_id AS "categoryId",s.name AS season FROM competitions c JOIN seasons s ON s.id=c.season_id WHERE ${categoryScope(grants,'matches.write',sql`c.category_id`)} ORDER BY s.starts_on DESC,c.name`,z.object({id:z.uuid(),name:z.string(),categoryId:z.uuid(),season:z.string()}));
   const participants=competitions.length?await rows(db,sql`SELECT ct.competition_id AS "competitionId",t.id AS "teamId",t.name FROM competition_teams ct JOIN teams t ON t.id=ct.team_id WHERE ct.competition_id IN (${inIds(competitions.map(c=>c.id))}) ORDER BY t.name`,z.object({competitionId:z.uuid(),teamId:z.uuid(),name:z.string()})):[];
   const venues=await rows(db,sql`SELECT id,name FROM venues ORDER BY name`,z.object({id:z.uuid(),name:z.string()}));
   return {categories:allowed,competitions,participants,venues};
  },
  async listAdminNews(grants:Grant[],page=1){const offset=pagination(page);const items=await rows(db,sql`${newsSelect} WHERE ${newsScope(grants,'news.read')} ORDER BY n.updated_at DESC,n.id LIMIT 26 OFFSET ${offset}`,articleRow);return {items:items.slice(0,25),page,hasMore:items.length>25};},
  async listPublicNews({page=1,search='',categoryId}:{page?:number;search?:string;categoryId?:string}={}){
   const offset=pagination(page);if(search.length>100)throw new ContentError(400,'Ricerca troppo lunga.');if(categoryId)z.uuid().parse(categoryId);
   const filters=[visibleNews];if(search)filters.push(sql`(n.title ILIKE ${'%'+search.replace(/[\%_]/g,'\$&')+'%'} OR n.excerpt ILIKE ${'%'+search.replace(/[\%_]/g,'\$&')+'%'})`);
   if(categoryId)filters.push(sql`EXISTS(SELECT 1 FROM news_categories nc WHERE nc.news_id=n.id AND nc.category_id=${categoryId}::uuid)`);
   const items=await rows(db,sql`${newsSelect} WHERE ${sql.join(filters,sql` AND `)} ORDER BY n.featured DESC,n.publish_at DESC,n.id LIMIT 26 OFFSET ${offset}`,articleRow);
   return {items:items.slice(0,25),page,hasMore:items.length>25};
  },
  async article(slug:string){if(!/^[a-z0-9-]{1,180}$/.test(slug))return null;return (await rows(db,sql`${newsSelect} WHERE n.slug=${slug} AND ${visibleNews}`,articleRow))[0]??null;},
  async createNews(actor:Actor,input:unknown){
   const data=newsCreate.parse(input);if(!can(actor.grants,'news.write',data.categoryId))throw new ContentError(403,'Categoria non autorizzata.');
   const [category]=await rows(db,sql`SELECT id FROM categories WHERE id=${data.categoryId}::uuid AND active=true`,idRow);if(!category)throw new ContentError(400,'Categoria non disponibile.');
   const id=randomUUID(),slug=data.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,140)+'-'+id.slice(0,8),date=publication(data);
   return changed(sql`WITH created AS (INSERT INTO news(id,slug,title,excerpt,body,status,publish_at,featured,author_id) VALUES (${id}::uuid,${slug},${data.title},${data.excerpt},${data.body},${data.status}::news_status,${date}::timestamptz,${data.featured},${actor.userId}) RETURNING id), categorized AS (INSERT INTO news_categories(news_id,category_id) SELECT id,${data.categoryId}::uuid FROM created), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'news.create','news',id::text FROM created) SELECT id FROM created`);
  },
  async updateNews(actor:Actor,input:unknown){const data=newsUpdate.parse(input);await checkArticle(actor,data.id);const date=publication(data);return changed(sql`WITH updated AS (UPDATE news n SET title=${data.title},excerpt=${data.excerpt},body=${data.body},status=${data.status}::news_status,publish_at=${date}::timestamptz,featured=${data.featured},updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',n.updated_at)+interval '1 millisecond') WHERE n.id=${data.id}::uuid AND date_trunc('milliseconds',n.updated_at)=${data.version}::timestamptz AND ${newsScope(actor.grants,'news.write')} RETURNING n.id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'news.update','news',id::text FROM updated) SELECT id FROM updated`);},
  async deleteNews(actor:Actor,input:unknown){const data=deleteInput.parse(input);await checkArticle(actor,data.id);return changed(sql`WITH deleted AS (DELETE FROM news n WHERE n.id=${data.id}::uuid AND date_trunc('milliseconds',n.updated_at)=${data.version}::timestamptz AND ${newsScope(actor.grants,'news.write')} RETURNING n.id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'news.delete','news',id::text FROM deleted) SELECT id FROM deleted`);},
  async listAdminMatches(grants:Grant[],page=1){const offset=pagination(page);const items=await rows(db,sql`${matchSelect} WHERE ${categoryScope(grants,'matches.read',sql`c.category_id`)} ORDER BY m.kickoff DESC NULLS LAST,m.id LIMIT 26 OFFSET ${offset}`,matchRow);return {items:items.slice(0,25),page,hasMore:items.length>25};},
  async listPublicMatches({page=1,categoryId,seasonId,mode='all'}:{page?:number;categoryId?:string;seasonId?:string;mode?:'all'|'upcoming'|'results'}={}){
   const offset=pagination(page);if(categoryId)z.uuid().parse(categoryId);if(seasonId)z.uuid().parse(seasonId);
   const filters=[sql`(h.is_club=true OR a.is_club=true)`];if(categoryId)filters.push(sql`cat.id=${categoryId}::uuid`);
   if(seasonId)filters.push(sql`c.season_id=${seasonId}::uuid`);
   if(mode==='upcoming')filters.push(sql`(m.status='live' OR (m.status='scheduled' AND m.kickoff>=now()-interval '12 hours'))`);if(mode==='results')filters.push(sql`m.status='finished'`);
   const items=await rows(db,sql`${matchSelect} WHERE ${sql.join(filters,sql` AND `)} ORDER BY m.kickoff ${mode==='upcoming'?sql`ASC`:sql`DESC`} NULLS LAST,m.id LIMIT 26 OFFSET ${offset}`,matchRow);
   return {items:items.slice(0,25),page,hasMore:items.length>25};
  },
  async match(id:string){z.uuid().parse(id);return (await rows(db,sql`${matchSelect} WHERE m.id=${id}::uuid AND (h.is_club=true OR a.is_club=true)`,matchRow))[0]??null;},
  async createMatch(actor:Actor,input:unknown){const data=matchCreate.parse(input);const [competition]=await rows(db,sql`SELECT category_id AS "categoryId" FROM competitions WHERE id=${data.competitionId}::uuid`,z.object({categoryId:z.uuid()}));if(!competition)throw new ContentError(400,'Competizione non disponibile.');if(!can(actor.grants,'matches.write',competition.categoryId))throw new ContentError(403,'Competizione non autorizzata.');const id=randomUUID();return changed(sql`WITH created AS (INSERT INTO matches(id,competition_id,home_team_id,away_team_id,kickoff,round,venue_id,status,home_score,away_score,report) VALUES (${id}::uuid,${data.competitionId}::uuid,${data.homeTeamId}::uuid,${data.awayTeamId}::uuid,${data.kickoff}::timestamptz,${data.round},${data.venueId}::uuid,${data.status}::match_status,${data.homeScore},${data.awayScore},${data.report}) RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'match.create','matches',id::text FROM created) SELECT id FROM created`);},
  async updateMatch(actor:Actor,input:unknown){const data=matchUpdate.parse(input);await checkMatch(actor,data.id);return changed(sql`WITH updated AS (UPDATE matches m SET kickoff=${data.kickoff}::timestamptz,round=${data.round},venue_id=${data.venueId}::uuid,status=${data.status}::match_status,home_score=${data.homeScore},away_score=${data.awayScore},report=${data.report},updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',m.updated_at)+interval '1 millisecond') WHERE m.id=${data.id}::uuid AND date_trunc('milliseconds',m.updated_at)=${data.version}::timestamptz RETURNING m.id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'match.update','matches',id::text FROM updated) SELECT id FROM updated`);},
  async publicCategories(){return rows(db,sql`SELECT id,name FROM categories WHERE active=true ORDER BY sort_order,name`,z.object({id:z.uuid(),name:z.string()}));},
 };
}
