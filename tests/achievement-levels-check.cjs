const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({ data: { players: [], matches: [] } });
vm.runInContext(html.slice(html.indexOf('  // Achievement model:'), html.indexOf('  // Achievement views.')) + '\n' + html.slice(html.indexOf('  function derive(match)'), html.indexOf('  function validData')), context);
const visit = (total, extra = {}) => ({ total, darts: 3, bust: false, double: false, ...extra });
let serial = 0;
const match = (totals, extra = {}) => ({ id: 'levels-' + serial++, startedAt: '2026-09-21T10:00:00Z', players: [{ id: 'p', name: 'Shadow' }], visits: totals.map(v => typeof v === 'number' ? visit(v) : v), out: 'straight', bestOf: 1, abandoned: false, ...extra });
const state = games => context.buildAchievements(games).get('p');
const level = (games, id) => state(games).earned[id]?.level || 0;
const repeated = count => Array.from({ length: count }, () => match([180, 121]));

for (const [score, expected] of [[59,0],[60,1],[99,1],[100,2],[139,2],[140,3],[179,3],[180,4]]) {
  assert.equal(level([match([score])], 'maximum'), expected, `Maximum at ${score}`);
  assert.equal(level([match([visit(score, { bust: true })])], 'maximum'), 0, 'Busts cannot earn scoring levels');
}
assert.equal(level([match([60,60])], 'maximum'), 1, 'Best visit, not cumulative points');
assert.equal(level([match([], { pending: ['T20','T20'] })], 'maximum'), 0);
for (const [score, expected] of [[39,0],[40,1],[59,1],[60,2],[79,2],[80,3],[99,3],[100,4]]) {
  assert.equal(level([match([180,121-score,score])], 'ice'), expected, `Ice Cold at ${score}`);
}
assert.equal(level([match([120,88,93])], 'ice'), 3, 'Shadow-style 93 checkout earns Gold');
assert.equal(level([match([120,88,93])], 'maximum'), 2, '120 scoring visit earns Silver');
assert.equal(level([match([180,81,40], { out: 'double' })], 'ice'), 0, 'Invalid double-out is a bust');
assert.equal(level([match([180,81,visit(40,{darts:1,hits:['D20'],double:true})], { out: 'double' })], 'ice'), 1);
const players = [{id:'winner',name:'Winner'}, {id:'p',name:'Shadow'}, {id:'last',name:'Last'}];
assert.equal(level([match([180,180,0,121,81,0,40], { players, finishMode:'placements' })], 'ice'), 1, 'Later checkout places qualify');

for (const [count, expected] of [[0,0],[1,1],[2,1],[3,2],[9,2],[10,3],[24,3],[25,4]]) {
  assert.equal(level([...repeated(count),match([])], 'gold'), expected, `Wins at ${count}`);
}
for (const [count, expected] of [[4,0],[5,1],[9,1],[10,2],[24,2],[25,3],[49,3],[50,4]]) {
  assert.equal(level(repeated(count), 'regular'), expected, `Attendance at ${count}`);
}
assert.equal(state([match([180,121], { abandoned:true })]).progress.regular, 0);
assert.equal(state([match([180,121,180,121], {bestOf:3})]).progress.regular, 1, 'Count matches, not legs');

for (const [count, expected] of [[0,0],[1,1],[4,1],[5,2],[9,2],[10,3],[24,3],[25,4]]) {
  const games = Array.from({length:count},()=>match([visit(50,{darts:1,hits:['BULL'],double:true})]));
  assert.equal(level([...games,match([])],'bull'),expected, `Bullseyes at ${count}`);
}
for (const [count, expected] of [[4,0],[5,1],[14,1],[15,2],[29,2],[30,3],[49,3],[50,4]]) {
  const game = match(Array.from({length:count},()=>visit(2,{darts:1,hits:['D1'],double:true})));
  assert.equal(level([game],'doubles'),expected, `Doubles at ${count}`);
}
assert.equal(state([match([visit(50,{darts:1,hits:['BULL'],double:true}),visit(25,{darts:1,hits:['25']})])]).progress.doubles,0);
assert.equal(state([match([visit(40,{double:true}),50])]).progress.doubles,0, 'Legacy totals cannot imply doubles');
assert.equal(level([match([50])], 'bull'),0, 'Legacy totals cannot imply bullseyes');
assert.equal(level([match([visit(25,{darts:1,hits:['25']})])], 'bull'),0, 'Outer bull does not qualify');
assert.equal(state([match([180,119,visit(4,{darts:1,hits:['D2'],double:true,bust:true})])]).progress.doubles,1, 'Actual doubles in bust visits count');

const clean = () => visit(30,{hits:['S10','S10','S10']});
for (const [count, expected] of [[2,0],[3,1],[4,2],[5,3],[6,4]]) {
  const game = match(Array.from({length:count},clean));
  assert.equal(level([game],'steady'),expected, `Clean streak at ${count}`);
}
const streak = match([clean(),0,clean(),0,clean()],{players:[{id:'p',name:'Shadow'},{id:'other',name:'Other'}]});
assert.equal(level([streak],'steady'),1,'Other players do not interrupt your run');
assert.equal(state([streak]).earned.steady.visit,4);
streak.visits.pop();
assert.equal(level([streak],'steady'),0, 'Undo revokes the streak');
assert.equal(state([streak]).progress.steady,2);
for (const interruption of [visit(20,{hits:['S10','MISS','S10']}),visit(10,{darts:1,hits:['S10']}),visit(30,{hits:['S10','S10','S10'],bust:true}),visit(30)]) {
  const result = state([match([clean(),clean(),interruption,clean(),clean()])]);
  assert.equal(result.earned.steady,undefined, 'Miss, short visit, bust, or missing dart records breaks the run');
  assert.equal(result.progress.steady,2, 'Separate runs do not add together');
}
assert.equal(level([match([clean(),clean()]),match([clean()])],'steady'),0,'Runs cannot span matches');
assert.equal(level([match([180,clean(),visit(91,{hits:['T17','S20','S20']}),clean()],{bestOf:3})],'steady'),0,'Runs reset between legs');
assert.equal(level([match([clean(),clean()],{pending:['S10','S10']})],'steady'),0);
assert.equal(level([match([clean(),clean(),clean()],{abandoned:true})],'steady'),1);

for (const [gap, expected] of [[24,0],[25,1],[49,1],[50,2],[74,2],[75,3],[99,3],[100,4]]) {
  const game = match([0,gap,180,0,121],{players:[{id:'p',name:'Shadow'},{id:'other',name:'Other'}]});
  assert.equal(level([game],'comeback'),expected, `Comeback at ${gap}`);
}

const first = match([visit(60,{recordedAt:'2026-09-21T10:01:00Z'})]);
const second = match([visit(140,{recordedAt:'2026-09-21T10:02:00Z'})]);
const upgraded = state([second,first]).earned.maximum;
assert.equal(upgraded.level,3);
assert.equal(upgraded.levels[0].matchId,first.id,'Bronze keeps its original evidence after upgrade');
assert.equal(upgraded.levels[1].matchId,second.id,'A visit can earn multiple levels');
assert.equal(upgraded.levels[2].matchId,second.id);
assert.equal(level([first],'maximum'),1,'Deleting the upgrade restores the lower level');

context.data={players:[{id:'p',rewards:{name:'maximum',frame:'maximum',pose:'mic-drop',pins:['maximum']}}],matches:[first]};
vm.runInContext('achievementCache=null',context);
assert.equal(context.equippedReward({id:'p'},'name').id,'maximum','Bronze unlocks cosmetics');
assert.equal(context.selectedVictoryPose({id:'p'},'maximum',180),'dance','Bronze cannot equip the Master pose');
context.data.players[0].rewards.pose='bow';
context.data.matches=[match([120,88,93])];
vm.runInContext('achievementCache=null',context);
assert.equal(context.selectedVictoryPose({id:'p'},'win',93),'dance','Gold Ice Cold cannot equip Master bow');
context.data.matches=[match([180,121])];
vm.runInContext('achievementCache=null',context);
assert.equal(context.selectedVictoryPose({id:'p'},'win',121),'bow');
assert.equal(context.validRewards({name:'steady',frame:'doubles',pins:['steady','doubles']}),true);
console.log('All eight tracks: tier boundaries, best scores, streaks, historical evidence, undo, and pose eligibility passed.');
