import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {can,type Grant} from '../auth/permissions.ts';
import {categoryCreate,categoryUpdate,competitionCreate,venueCreate} from '../../shared/setup.ts';
import {rows,type Executor} from './service.ts';
import {ContentError} from './errors.ts';
interface Actor{userId:string;grants:Grant[]}
const idRow=z.object({id:z.uuid()});
const slug=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)+'-'+randomUUID().slice(0,8);
function permitted(actor:Actor){if(!can(actor.grants,'categories.write'))throw new ContentError(403,'Solo gli amministratori possono configurare la società.');}
export function setupService(db:Executor){return {
 async catalog(actor:Actor){permitted(actor);const [categories,seasons,competitions,venues]=await Promise.all([
  rows(db,sql`SELECT id,name,sort_order AS "sortOrder",active,is_youth AS "isYouth" FROM categories ORDER BY sort_order,name`,z.object({id:z.uuid(),name:z.string(),sortOrder:z.number(),active:z.boolean(),isYouth:z.boolean()})),
  rows(db,sql`SELECT id,name FROM seasons ORDER BY starts_on DESC`,z.object({id:z.uuid(),name:z.string()})),
  rows(db,sql`SELECT c.id,c.name,s.name AS season FROM competitions c JOIN seasons s ON s.id=c.season_id ORDER BY s.starts_on DESC,c.name`,z.object({id:z.uuid(),name:z.string(),season:z.string()})),
  rows(db,sql`SELECT id,name,city FROM venues ORDER BY name`,z.object({id:z.uuid(),name:z.string(),city:z.string()})),
 ]);return {categories,seasons,competitions,venues};},
 async createCategory(actor:Actor,input:unknown){permitted(actor);const data=categoryCreate.parse(input),id=randomUUID();const [row]=await rows(db,sql`WITH created AS (INSERT INTO categories(id,name,slug,sort_order,active,is_youth) VALUES (${id}::uuid,${data.name},${slug(data.name)},${data.sortOrder},${data.active},${data.isYouth}) RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'category.create','categories',id::text FROM created) SELECT id FROM created`,idRow);return row;},
 async updateCategory(actor:Actor,input:unknown){permitted(actor);const data=categoryUpdate.parse(input);const [row]=await rows(db,sql`WITH updated AS (UPDATE categories SET name=${data.name},sort_order=${data.sortOrder},active=${data.active},is_youth=${data.isYouth} WHERE id=${data.id}::uuid RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'category.update','categories',id::text FROM updated) SELECT id FROM updated`,idRow);if(!row)throw new ContentError(404,'Categoria non trovata.');return row;},
 async createVenue(actor:Actor,input:unknown){permitted(actor);const data=venueCreate.parse(input),id=randomUUID();const [row]=await rows(db,sql`WITH created AS (INSERT INTO venues(id,name,address,city) VALUES (${id}::uuid,${data.name},${data.address},${data.city}) RETURNING id), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'venue.create','venues',id::text FROM created) SELECT id FROM created`,idRow);return row;},
 async createCompetition(actor:Actor,input:unknown){
  permitted(actor);const data=competitionCreate.parse(input),id=randomUUID();
  const [category]=await rows(db,sql`SELECT id FROM categories WHERE id=${data.categoryId}::uuid AND active=true`,idRow);if(!category)throw new ContentError(400,'Scegli una categoria attiva.');
  const existing=data.seasonId?await rows(db,sql`SELECT id,name,is_club AS "isClub" FROM teams WHERE season_id=${data.seasonId}::uuid AND category_id=${data.categoryId}::uuid`,z.object({id:z.uuid(),name:z.string(),isClub:z.boolean()})):[];
  const inputs=[{name:data.clubName,isClub:true},...data.opponents.map(name=>({name,isClub:false}))].map(team=>{
   const found=existing.filter(t=>t.name.toLocaleLowerCase('it-IT')===team.name.toLocaleLowerCase('it-IT'));
   if(found.length>1||found[0]&&found[0].isClub!==team.isClub)throw new ContentError(400,'Verifica i nomi delle squadre già presenti nella stagione.');
   return {...team,id:found[0]?.id??randomUUID()};
  });
  const season=data.seasonId?sql`SELECT id FROM seasons WHERE id=${data.seasonId}::uuid`:sql`INSERT INTO seasons(id,name,starts_on,ends_on) VALUES (${randomUUID()}::uuid,${data.seasonName},${data.startsOn}::date,${data.endsOn}::date) RETURNING id`;
  const teamValues=sql.join(inputs.map(t=>sql`(${t.id}::uuid,${t.name},${t.isClub}::boolean)`),sql`, `);
  const [row]=await rows(db,sql`WITH chosen_season AS (${season}), created AS (INSERT INTO competitions(id,name,category_id,season_id,standings_enabled) SELECT ${id}::uuid,${data.name},${data.categoryId}::uuid,id,${data.standingsEnabled} FROM chosen_season RETURNING id), team_input(id,name,is_club) AS (VALUES ${teamValues}), new_teams AS (INSERT INTO teams(id,name,category_id,season_id,is_club) SELECT t.id,t.name,${data.categoryId}::uuid,s.id,t.is_club FROM team_input t CROSS JOIN chosen_season s WHERE NOT EXISTS(SELECT 1 FROM teams existing WHERE existing.id=t.id) RETURNING id), participants AS (INSERT INTO competition_teams(competition_id,team_id,season_id) SELECT c.id,t.id,s.id FROM created c CROSS JOIN team_input t CROSS JOIN chosen_season s CROSS JOIN (SELECT count(*) FROM new_teams) dependency), logged AS (INSERT INTO audit_logs(actor_id,action,entity_type,entity_id) SELECT ${actor.userId},'competition.create','competitions',id::text FROM created) SELECT id FROM created`,idRow);
  if(!row)throw new ContentError(400,'Stagione non disponibile.');return row;
 },
};}
