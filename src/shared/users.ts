import {z} from 'zod';
import {dateValue} from './content.ts';
export const userRoles=['super_admin','admin','category_manager','editor'] as const;
export const roleLabels={super_admin:'Super amministratore',admin:'Amministratore',category_manager:'Responsabile categoria',editor:'Redattore'} as const;
const profile={name:z.string().trim().min(2).max(100)};
const scope={role:z.enum(userRoles),allCategories:z.boolean(),categoryIds:z.array(z.uuid()).max(50)};
function checkScope(value:{role:string;allCategories:boolean;categoryIds:string[]},ctx:z.RefinementCtx){
 if(new Set(value.categoryIds).size!==value.categoryIds.length)ctx.addIssue({code:'custom',message:'Categorie duplicate.',path:['categoryIds']});
 if(['admin','super_admin'].includes(value.role)&&(!value.allCategories||value.categoryIds.length))ctx.addIssue({code:'custom',message:'Il ruolo amministrativo ha ambito globale.',path:['role']});
 if(value.role==='category_manager'&&(value.allCategories||!value.categoryIds.length))ctx.addIssue({code:'custom',message:'Assegna almeno una categoria al responsabile.',path:['categoryIds']});
 if(value.role==='editor'&&(!value.allCategories&&!value.categoryIds.length||value.allCategories&&value.categoryIds.length>0))ctx.addIssue({code:'custom',message:'Scegli le categorie oppure tutte le notizie.',path:['categoryIds']});
}
export const userCreate=z.object({...profile,...scope,email:z.email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(14).max(128)}).strict().superRefine(checkScope);
const enabledUser=z.object({...profile,...scope,id:z.string().min(1).max(128),version:z.iso.datetime(),enabled:z.literal(true)}).strict().superRefine(checkScope);
const disabledUser=z.object({...profile,id:z.string().min(1).max(128),version:z.iso.datetime(),enabled:z.literal(false)}).strict();
export const userUpdate=z.union([enabledUser,disabledUser]);
export const userPassword=z.object({id:z.string().min(1).max(128),version:z.iso.datetime(),password:z.string().min(14).max(128)}).strict();
export const userRow=z.object({id:z.string(),name:z.string(),email:z.string(),version:dateValue,grants:z.array(z.object({role:z.string(),categoryId:z.uuid().nullable()}))});
export type ManagedUser=z.infer<typeof userRow>&{enabled:boolean};
export interface UserData{items:ManagedUser[];page:number;hasMore:boolean;actorId:string;categories:{id:string;name:string;active:boolean}[];writesReady:boolean}
