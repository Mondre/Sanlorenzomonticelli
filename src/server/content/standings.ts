import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {rows,type Executor} from './service.ts';
import {calculateStandings} from '../services/standings.ts';
export async function competitionList(db:Executor){return rows(db,sql`SELECT c.id,c.name,s.name AS season FROM competitions c JOIN seasons s ON s.id=c.season_id JOIN categories cat ON cat.id=c.category_id WHERE c.standings_enabled=true AND cat.active=true ORDER BY s.starts_on DESC,c.name`,z.object({id:z.uuid(),name:z.string(),season:z.string()}));}
export async function standingsFor(db:Executor,id:string){
 z.uuid().parse(id);
 const [competition]=await rows(db,sql`SELECT c.name,s.name AS season,c.win_points AS win,c.draw_points AS draw,c.loss_points AS loss FROM competitions c JOIN seasons s ON s.id=c.season_id WHERE c.id=${id}::uuid AND c.standings_enabled=true`,z.object({name:z.string(),season:z.string(),win:z.number(),draw:z.number(),loss:z.number()}));
 if(!competition)return null;
 const [teams,results,adjustments]=await Promise.all([
  rows(db,sql`SELECT t.id,t.name FROM competition_teams ct JOIN teams t ON t.id=ct.team_id WHERE ct.competition_id=${id}::uuid`,z.object({id:z.uuid(),name:z.string()})),
  rows(db,sql`SELECT home_team_id AS "homeTeamId",away_team_id AS "awayTeamId",status,home_score AS "homeScore",away_score AS "awayScore" FROM matches WHERE competition_id=${id}::uuid`,z.object({homeTeamId:z.uuid(),awayTeamId:z.uuid(),status:z.string(),homeScore:z.number().nullable(),awayScore:z.number().nullable()})),
  rows(db,sql`SELECT team_id AS "teamId",points FROM standings_adjustments WHERE competition_id=${id}::uuid`,z.object({teamId:z.uuid(),points:z.number()})),
 ]);
 const names=new Map(teams.map(t=>[t.id,t.name]));
 return {competition:{id,name:competition.name,season:competition.season},items:calculateStandings(teams.map(t=>t.id),results,adjustments,competition).map(row=>({...row,name:names.get(row.teamId)??''})),note:'Ordinamento indicativo: punti, differenza reti, gol fatti. Per gli spareggi valgono i regolamenti ufficiali.'};
}
