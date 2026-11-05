import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { database } from '../../src/server/db/client';
import { competitions, competitionTeams, matches, standingsAdjustments } from '../../src/server/db/schema';
import { calculateStandings } from '../../src/server/services/standings';
import { json, unavailable } from '../../src/server/http';
export default async function handler(request: Request) {
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 const id=z.uuid().safeParse(new URL(request.url).searchParams.get('competition'));
 if(!id.success)return json({error:{code:'INVALID_COMPETITION',message:'Competizione non valida.'}},400);
 try{
  const db=database();
  const [competition]=await db.select().from(competitions).where(eq(competitions.id,id.data));
  if(!competition || !competition.standingsEnabled)return json({error:{code:'NOT_FOUND',message:'Classifica non disponibile.'}},404);
  const [participants,results,adjustments]=await Promise.all([
   db.select({teamId:competitionTeams.teamId}).from(competitionTeams).where(eq(competitionTeams.competitionId,id.data)),
   db.select().from(matches).where(eq(matches.competitionId,id.data)),
   db.select().from(standingsAdjustments).where(eq(standingsAdjustments.competitionId,id.data)),
  ]);
  return json({data:calculateStandings(participants.map(t=>t.teamId),results,adjustments,{win:competition.winPoints,draw:competition.drawPoints,loss:competition.lossPoints}),tieBreak:'points,goalDifference,goalsFor,teamId',note:'Ordinamento indicativo: verificare i criteri ufficiali della competizione.'});
 }catch{return unavailable();}
}
