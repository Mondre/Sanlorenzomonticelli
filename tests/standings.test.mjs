import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateStandings} from '../src/server/services/standings.ts';
const match=(homeScore,awayScore,status='finished')=>({homeTeamId:'a',awayTeamId:'b',homeScore,awayScore,status});
test('risultati terminati, pareggi, gare rinviate e penalità',()=>{
 const table=calculateStandings(['a','b','c'],[match(2,0),match(1,1),match(null,null,'postponed')],[{teamId:'a',points:-2}]);
 assert.deepEqual(table.find(r=>r.teamId==='a'),{teamId:'a',played:2,won:1,drawn:1,lost:0,goalsFor:3,goalsAgainst:1,goalDifference:2,points:2,adjustments:-2});
 assert.equal(table.find(r=>r.teamId==='b').points,1);assert.equal(table.find(r=>r.teamId==='c').played,0);
});
test('rifiuta risultati finali mancanti o negativi e partecipanti estranei',()=>{
 assert.throws(()=>calculateStandings(['a','b'],[match(null,null)]));
 assert.throws(()=>calculateStandings(['a','b'],[match(-1,0)]));
 assert.throws(()=>calculateStandings(['a'],[match(2,0)]));
 assert.throws(()=>calculateStandings(['a','b'],[],[{teamId:'x',points:-1}]));
});
test('punteggio configurabile e ordinamento deterministico',()=>{
 const table=calculateStandings(['a','b'],[match(0,2)],[],{win:2,draw:1,loss:0});
 assert.equal(table[0].teamId,'b');assert.equal(table[0].points,2);
});
