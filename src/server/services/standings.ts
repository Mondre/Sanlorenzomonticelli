export interface Result { homeTeamId:string; awayTeamId:string; status:string; homeScore:number|null; awayScore:number|null }
export interface Adjustment { teamId:string; points:number }
export interface Standing { teamId:string; played:number; won:number; drawn:number; lost:number; goalsFor:number; goalsAgainst:number; goalDifference:number; points:number; adjustments:number }
export function calculateStandings(teamIds: string[], matches: Result[], adjustments: Adjustment[] = [], scoring = {win:3,draw:1,loss:0}): Standing[] {
 if (new Set(teamIds).size !== teamIds.length) throw new Error('Duplicate team');
 const rows = new Map(teamIds.map(teamId=>[teamId,{teamId,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0,adjustments:0}]));
 for (const match of matches) {
  if (match.status !== 'finished') continue;
  const h=rows.get(match.homeTeamId),a=rows.get(match.awayTeamId);
  if (!h || !a || h===a) throw new Error('Invalid competition participant');
  const hs=match.homeScore,as=match.awayScore;
  if (hs===null || as===null || !Number.isInteger(hs) || !Number.isInteger(as) || hs<0 || as<0) throw new Error('Invalid final score');
  h.played++; a.played++;h.goalsFor+=hs;h.goalsAgainst+=as;a.goalsFor+=as;a.goalsAgainst+=hs;
  if(hs===as){h.drawn++;a.drawn++;h.points+=scoring.draw;a.points+=scoring.draw;}
  else {const winner=hs>as?h:a,loser=hs>as?a:h;winner.won++;loser.lost++;winner.points+=scoring.win;loser.points+=scoring.loss;}
 }
 for(const adjustment of adjustments){const row=rows.get(adjustment.teamId);if(!row || !Number.isInteger(adjustment.points))throw new Error('Invalid adjustment');row.points+=adjustment.points;row.adjustments+=adjustment.points;}
 for(const row of rows.values()) row.goalDifference=row.goalsFor-row.goalsAgainst;
 return [...rows.values()].sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||a.teamId.localeCompare(b.teamId));
}
