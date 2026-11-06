import {z} from 'zod';
export const sportSource={teamId:'13497',groupId:'282',year:2026,season:'2026/2027',competition:'Prima Categoria · Girone A',name:'Romagna Sport',teamUrl:'https://www.romagnasport.com/tuttocalcio/squadra.php?id_squadra=13497&anno=2026',calendarUrl:'https://www.romagnasport.com/calendario.php?gir=282&anno=2026&id_sport=1',standingsUrl:'https://www.romagnasport.com/tuttocalcio/classifica.php?gir=282&anno=2026'} as const;
const count=z.number().int().min(0).max(1000);
export const sportTeam=z.object({id:z.string().regex(/^\d{1,10}$/),name:z.string().trim().min(2).max(100)}).strict();
export const importedMatch=z.object({id:z.string(),round:z.number().int().min(1).max(30),date:z.iso.date(),home:sportTeam,away:sportTeam,homeScore:count.nullable(),awayScore:count.nullable(),status:z.enum(['result','not_available','postponed','cancelled','suspended'])}).strict();
export const importedStanding=z.object({team:sportTeam,position:count,points:z.number().int().min(-100).max(1000),played:count,won:count,drawn:count,lost:count,goalsFor:count,goalsAgainst:count}).strict();
export const sportsSnapshot=z.object({season:z.literal(sportSource.season),fetchedAt:z.iso.datetime(),matches:z.array(importedMatch).length(30),standings:z.array(importedStanding).length(16)}).strict();
export type SportsSnapshot=z.infer<typeof sportsSnapshot>;
export interface ImportState{enabled:boolean;lastAttemptAt:string|null;lastError:string|null;snapshot:SportsSnapshot|null}
export function isStale(value:SportsSnapshot,now=Date.now()){return now-new Date(value.fetchedAt).getTime()>24*60*60*1000;}
export function sportDate(date:string){return new Date(date+'T12:00:00Z').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Rome'});}
export function updateDate(date:string){return new Date(date).toLocaleString('it-IT',{timeZone:'Europe/Rome'});}
export const matchLabels={result:'Risultato pubblicato',not_available:'Risultato non disponibile',postponed:'Rinviata',cancelled:'Annullata',suspended:'Sospesa'};
