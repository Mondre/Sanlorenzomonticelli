export function canExportMatch(match:{kickoff:string|null;status:string}){return Boolean(match.kickoff)&&['scheduled','live','finished','cancelled'].includes(match.status);}
export function calendarLink(filters:{id?:string;categoryId?:string;seasonId?:string;mode?:string}={}){
 const query=new URLSearchParams();
 if(filters.id)query.set('id',filters.id);
 else{if(filters.categoryId)query.set('category',filters.categoryId);if(filters.seasonId)query.set('season',filters.seasonId);query.set('mode',filters.mode??'upcoming');}
 return '/api/calendar.ics?'+query.toString();
}
