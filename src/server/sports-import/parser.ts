import {load} from 'cheerio';
import {sportSource,sportsSnapshot,type SportsSnapshot} from '../../shared/sports-import.ts';
function invalid():never{throw new Error('SOURCE_FORMAT_CHANGED');}
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
function number(s:string){if(!/^-?\d+$/.test(clean(s)))invalid();return Number(clean(s));}
function team(href:string|undefined,name:string){
 if(!href)invalid();const url=new URL(href,'https://www.romagnasport.com');
 if(url.origin!=='https://www.romagnasport.com'||url.pathname!=='/tuttocalcio/squadra.php')invalid();
 const id=url.searchParams.get('id_squadra');if(!id||!/^\d{1,10}$/.test(id))invalid();return {id,name:clean(name)};
}
function date(value:string){const m=value.match(/^Data (\d{2})\/(\d{2})\/(\d{4})$/);if(!m)invalid();const iso=`${m[3]}-${m[2]}-${m[1]}`;const d=new Date(iso+'T12:00:00Z');if(Number.isNaN(+d)||d.toISOString().slice(0,10)!==iso||iso<'2026-07-01'||iso>'2027-06-30')invalid();return iso;}
export function parseSports(calendarHTML:string,standingsHTML:string,fetchedAt=new Date().toISOString()):SportsSnapshot{
 const $=load(standingsHTML),standings:SportsSnapshot['standings']=[];
 const title=clean($('#title_classifica').text());if(!title.includes('CLASSIFICA'))invalid();
 // Verify the source season from the selected season option, never the site navigation.
 const seasonOptions=$('select option[selected]').map((_,e)=>clean($(e).text())).get();
 if(!seasonOptions.some(s=>s.replace(/\s/g,'')===sportSource.season))invalid();
 $('#title_classifica').next('table').find('tr.tab-pref').each((_,el)=>{
  const row=$(el),link=row.find('.nome-squadra a');
  const nums=row.children('td').slice(1,9).map((_,e)=>number($(e).text())).get();if(nums.length!==8)invalid();
  const [points,played,won,drawn,lost,goalsFor,goalsAgainst,difference]=nums as [number,number,number,number,number,number,number,number];
  if(played!==won+drawn+lost||goalsFor-goalsAgainst!==difference)invalid();
  standings.push({team:team(link.attr('href'),link.text()),position:number(row.find('.pos-squadra').text()),points,played,won,drawn,lost,goalsFor,goalsAgainst});
 });
 if(standings.length!==16||new Set(standings.map(s=>s.team.id)).size!==16||!standings.some(s=>s.team.id===sportSource.teamId)||standings.some((s,i)=>s.position!==i+1||s.played>30))invalid();
 const teams=new Map(standings.map(s=>[s.team.id,s.team]));
 const c=load(calendarHTML),matches:SportsSnapshot['matches']=[];let round=0,day='';const allIds=new Set<string>(),pairs=new Set<string>(),roundTeams=new Map<number,Set<string>>();
 if(!/CALENDARIO\s+1a Categoria\s+Girone A/.test(clean(c('#content h1').text())))invalid();
 c('.calendario .info-calendario').each((_,el)=>{
  const row=c(el),links=row.find('a');
  if(!links.length){const cols=row.children();const m=clean(cols.first().text()).match(/^(\d+)a giornata$/);if(!m)invalid();round=Number(m[1]);day=date(clean(cols.last().text()));if(roundTeams.has(round))invalid();roundTeams.set(round,new Set());return;}
  if(links.length!==2||!round||!day)invalid();
  const home=team(links.eq(0).attr('href'),links.eq(0).text()),away=team(links.eq(1).attr('href'),links.eq(1).text());
  if(home.id===away.id||!teams.has(home.id)||!teams.has(away.id))invalid();
  const seen=roundTeams.get(round)!;if(seen.has(home.id)||seen.has(away.id))invalid();seen.add(home.id);seen.add(away.id);
  const id=`${sportSource.year}-${sportSource.groupId}-${round}-${home.id}-${away.id}`,pair=home.id+'-'+away.id;
  if(allIds.has(id)||pairs.has(pair))invalid();allIds.add(id);pairs.add(pair);
  const score=clean(row.children().last().text()),numbers=score.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  const states:Record<string,SportsSnapshot['matches'][number]['status']>={'N.G.':'not_available','Rinviata':'postponed','Rinv.':'postponed','Sospesa':'suspended','Annullata':'cancelled'};
  if(!numbers&&!states[score])invalid();
  if(home.id===sportSource.teamId||away.id===sportSource.teamId)matches.push({id,round,date:day,home:teams.get(home.id)!,away:teams.get(away.id)!,homeScore:numbers?Number(numbers[1]):null,awayScore:numbers?Number(numbers[2]):null,status:numbers?'result':states[score]!});
 });
 if(roundTeams.size!==30||allIds.size!==240||[...roundTeams.values()].some(s=>s.size!==16))invalid();
 return sportsSnapshot.parse({season:sportSource.season,fetchedAt,matches,standings});
}
