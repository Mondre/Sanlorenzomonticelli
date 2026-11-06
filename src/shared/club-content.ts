import {z} from 'zod';
export function publicHttpsUrl(value:string|null|undefined){if(!value)return null;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||url.hostname.includes(':')||url.hostname.replace(/\.$/,'')==='localhost'||url.hostname.replace(/\.$/,'').endsWith('.localhost')||url.hostname.replace(/\.$/,'').endsWith('.local')||url.hostname.replace(/\.$/,'').endsWith('.internal')||/^\d+(?:\.\d+){3}$/.test(url.hostname))return null;return url.toString();}catch{return null;}}
const website=z.string().max(500).nullable().refine(v=>v===null||publicHttpsUrl(v)!==null,'Inserisci un URL pubblico HTTPS senza credenziali.');
const version=z.string().regex(/^\d{1,20}$/);
const sponsorFields={name:z.string().trim().min(2).max(150),description:z.string().trim().max(3000).nullable(),website,tier:z.string().trim().min(2).max(80),logoId:z.uuid().nullable(),sortOrder:z.number().int().min(0).max(1000),active:z.boolean()};
export const sponsorCreate=z.object(sponsorFields).strict();
export const sponsorUpdate=z.object({...sponsorFields,id:z.uuid(),version}).strict();
export const clubDelete=z.object({id:z.uuid(),version}).strict();
export const sponsorRow=z.object({id:z.uuid(),name:z.string(),description:z.string().nullable(),website:z.string().nullable(),tier:z.string(),logoId:z.uuid().nullable(),logoUrl:z.string().nullable(),logoAlt:z.string().nullable(),sortOrder:z.number(),active:z.boolean(),version});
export type Sponsor=z.infer<typeof sponsorRow>;
export type PublicSponsor=Omit<Sponsor,'logoId'|'active'|'version'|'sortOrder'>;
const venueFields={name:z.string().trim().min(2).max(100),address:z.string().trim().min(3).max(200),city:z.string().trim().min(2).max(100),directions:z.string().trim().max(3000).nullable(),parking:z.string().trim().max(2000).nullable()};
export const venueCreate=z.object(venueFields).strict();
export const venueUpdate=z.object({...venueFields,id:z.uuid(),version}).strict();
export const venueRow=z.object({id:z.uuid(),name:z.string(),address:z.string(),city:z.string(),directions:z.string().nullable(),parking:z.string().nullable(),matchesCount:z.number(),version});
export type Venue=z.infer<typeof venueRow>;
export type PublicVenue=Omit<Venue,'matchesCount'|'version'>;
export interface LogoOption{id:string;alt:string}
export function mapsLink(venue:{name?:string|null;address:string|null;city?:string|null}){return venue.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([venue.name,venue.address,venue.city].filter(Boolean).join(', ')):null;}
