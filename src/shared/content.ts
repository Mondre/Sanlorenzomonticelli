import { z } from 'zod';
export const statuses=['scheduled','live','finished','postponed','cancelled','suspended'] as const;
export const statusLabels:Record<typeof statuses[number],string>={scheduled:'Programmata',live:'In corso',finished:'Terminata',postponed:'Rinviata',cancelled:'Annullata',suspended:'Sospesa'};
const articleFields={title:z.string().trim().min(5).max(160),excerpt:z.string().trim().min(10).max(320),body:z.string().trim().min(20).max(20000),status:z.enum(['draft','published','scheduled']),publishAt:z.iso.datetime().nullable().default(null),featured:z.boolean().default(false)};
export const newsCreate=z.object({...articleFields,categoryId:z.uuid()}).strict();
export const newsUpdate=z.object({...articleFields,id:z.uuid(),version:z.iso.datetime()}).strict();
export const deleteInput=z.object({id:z.uuid(),version:z.iso.datetime()}).strict();
const matchFields={kickoff:z.iso.datetime().nullable(),round:z.number().int().min(1).max(200).nullable(),venueId:z.uuid().nullable(),status:z.enum(statuses),homeScore:z.number().int().min(0).max(99).nullable(),awayScore:z.number().int().min(0).max(99).nullable(),report:z.string().trim().max(10000).nullable()};
function validScores(value:{status:string;homeScore:number|null;awayScore:number|null},ctx:z.RefinementCtx){
 if((value.homeScore===null)!==(value.awayScore===null))ctx.addIssue({code:'custom',message:'Inserire entrambi i punteggi.',path:['homeScore']});
 if(value.status==='finished' && value.homeScore===null)ctx.addIssue({code:'custom',message:'Una partita terminata deve avere un risultato.',path:['homeScore']});
}
export const matchCreate=z.object({...matchFields,competitionId:z.uuid(),homeTeamId:z.uuid(),awayTeamId:z.uuid()}).strict().superRefine((v,c)=>{validScores(v,c);if(v.homeTeamId===v.awayTeamId)c.addIssue({code:'custom',message:'Le squadre devono essere diverse.',path:['awayTeamId']});});
export const matchUpdate=z.object({...matchFields,id:z.uuid(),version:z.iso.datetime()}).strict().superRefine(validScores);
export const dateValue=z.coerce.date().transform(d=>d.toISOString());
export const articleRow=z.object({id:z.uuid(),slug:z.string(),title:z.string(),excerpt:z.string(),body:z.string(),status:z.enum(['draft','published','scheduled']),publishAt:dateValue.nullable(),featured:z.boolean(),version:dateValue,categoryIds:z.array(z.uuid()),categoryName:z.string().nullable()});
export type Article=z.infer<typeof articleRow>;
export const matchRow=z.object({id:z.uuid(),competitionId:z.uuid(),competition:z.string(),season:z.string(),categoryId:z.uuid(),category:z.string(),homeTeamId:z.uuid(),awayTeamId:z.uuid(),homeTeam:z.string(),awayTeam:z.string(),kickoff:dateValue.nullable(),round:z.number().nullable(),venueId:z.uuid().nullable(),venue:z.string().nullable(),address:z.string().nullable(),city:z.string().nullable(),status:z.enum(statuses),homeScore:z.number().nullable(),awayScore:z.number().nullable(),report:z.string().nullable(),version:dateValue});
export type Match=z.infer<typeof matchRow>;
export interface Options{categories:{id:string;name:string;news:boolean;matches:boolean}[];competitions:{id:string;name:string;categoryId:string;season:string}[];participants:{competitionId:string;teamId:string;name:string}[];venues:{id:string;name:string}[]}
export interface Page<T>{items:T[];page:number;hasMore:boolean}
export function formatDate(value:string|null){return value?new Intl.DateTimeFormat('it-IT',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(value)):'Data da definire';}
