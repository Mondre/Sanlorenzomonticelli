import {z} from 'zod';
export const categoryFields={name:z.string().trim().min(2).max(80),sortOrder:z.number().int().min(0).max(1000),active:z.boolean(),isYouth:z.boolean()};
export const categoryCreate=z.object(categoryFields).strict();
export const categoryUpdate=z.object({...categoryFields,id:z.uuid()}).strict();
export const competitionCreate=z.object({name:z.string().trim().min(3).max(120),categoryId:z.uuid(),seasonId:z.uuid().nullable(),seasonName:z.string().trim().max(40),startsOn:z.iso.date().nullable(),endsOn:z.iso.date().nullable(),clubName:z.string().trim().min(2).max(100),opponents:z.array(z.string().trim().min(2).max(100)).min(1).max(30),standingsEnabled:z.boolean()}).strict().superRefine((v,c)=>{
 if(!v.seasonId&&(!v.seasonName||!v.startsOn||!v.endsOn||v.endsOn<v.startsOn))c.addIssue({code:'custom',message:'Inserisci nome e date valide della stagione.',path:['seasonName']});
 const names=[v.clubName,...v.opponents].map(s=>s.toLocaleLowerCase('it-IT'));if(new Set(names).size!==names.length)c.addIssue({code:'custom',message:'Le squadre devono avere nomi distinti.',path:['opponents']});
});
export const seasonCreate=z.object({name:z.string().trim().min(2).max(40),startsOn:z.iso.date(),endsOn:z.iso.date()}).strict().refine(v=>v.endsOn>=v.startsOn,{message:'La fine della stagione deve essere successiva o uguale all’inizio.',path:['endsOn']});
export const venueCreate=z.object({name:z.string().trim().min(2).max(100),address:z.string().trim().min(3).max(200),city:z.string().trim().min(2).max(100)}).strict();
export interface SetupCatalog{categories:{id:string;name:string;sortOrder:number;active:boolean;isYouth:boolean}[];seasons:{id:string;name:string}[];competitions:{id:string;name:string;season:string}[];venues:{id:string;name:string;city:string}[]}
