import {Buffer} from 'node:buffer';
import type {Match} from '../../shared/content.ts';
import {statusLabels} from '../../shared/content.ts';
import {canExportMatch} from '../../shared/calendar.ts';
const fallbackOrigin='https://sanlorenzomonticelli.netlify.app';
export function calendarOrigin(value:string|undefined){
 if(!value)return fallbackOrigin;
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return url.origin;}catch{}
 return fallbackOrigin;
}
function text(value:string){return value.replace(/\r\n|\r/g,'\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function stamp(value:string){return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
// RFC 5545: fold at 75 octets, including the continuation space, without splitting UTF-8.
export function foldLine(line:string){
 let current='',bytes=0;const result:string[]=[];
 for(const char of line){const size=Buffer.byteLength(char,'utf8');if(bytes+size>75){result.push(current);current=' ';bytes=1;}current+=char;bytes+=size;}
 result.push(current);return result.join('\r\n');
}
export function serializeCalendar(matches:Match[],origin=fallbackOrigin){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//San Lorenzo Monticelli//Calendario partite//IT','CALSCALE:GREGORIAN','X-WR-CALNAME:San Lorenzo Monticelli - Partite'];
 for(const match of matches){
  if(!canExportMatch(match))continue;
  const url=calendarOrigin(origin)+'/partite/'+encodeURIComponent(match.id);
  const description=[`${match.category} · ${match.competition} · ${match.season}`,match.round?`${match.round}ª giornata`:null,`Stato: ${statusLabels[match.status]}`,match.status==='finished'?`Risultato: ${match.homeScore}–${match.awayScore}`:null,'È indicato soltanto l’orario di inizio; la durata non è disponibile.','Questa è una copia del calendario: verifica date, orari e variazioni sulla scheda della partita.',url].filter(Boolean).join('\n');
  lines.push('BEGIN:VEVENT',`UID:match-${match.id}@sanlorenzomonticelli.netlify.app`,`DTSTAMP:${stamp(match.version)}`,`LAST-MODIFIED:${stamp(match.version)}`,`DTSTART:${stamp(match.kickoff!)}`,`SUMMARY:${text((match.status==='cancelled'?'Annullata · ':'')+match.homeTeam+' – '+match.awayTeam)}`,`DESCRIPTION:${text(description)}`,`STATUS:${match.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,'TRANSP:TRANSPARENT',`URL:${url}`);
  const location=[match.venue,match.address,match.city].filter(Boolean).join(', ');if(location)lines.push(`LOCATION:${text(location)}`);
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
}
