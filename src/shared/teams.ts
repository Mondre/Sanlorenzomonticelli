import {z} from 'zod';
import {dateValue} from './content.ts';
const fields={name:z.string().trim().min(2).max(100),description:z.string().trim().max(4000).nullable(),trainingSchedule:z.string().trim().max(2000).nullable()};
export const teamCreate=z.object({...fields,categoryId:z.uuid(),seasonId:z.uuid()}).strict();
export const teamUpdate=z.object({...fields,id:z.uuid(),version:z.iso.datetime()}).strict();
export const staffCreate=z.object({teamId:z.uuid(),name:z.string().trim().min(2).max(100),role:z.string().trim().min(2).max(100),publish:z.boolean()}).strict();
export const staffDelete=z.object({id:z.uuid()}).strict();
export const teamRow=z.object({id:z.uuid(),name:z.string(),categoryId:z.uuid(),category:z.string(),slug:z.string(),seasonId:z.uuid(),season:z.string(),description:z.string().nullable(),trainingSchedule:z.string().nullable(),version:dateValue});
export type Team=z.infer<typeof teamRow>;
export const staffRow=z.object({id:z.uuid(),teamId:z.uuid(),name:z.string(),role:z.string(),publish:z.boolean()});
export type Staff=z.infer<typeof staffRow>;
export interface TeamOptions{categories:{id:string;name:string}[];seasons:{id:string;name:string}[]}
