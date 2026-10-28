const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const extract = (start, end) => html.slice(html.indexOf(start), html.indexOf(end));
const context = vm.createContext({ data: { players: [], matches: [] } });
vm.runInContext([
  extract('  const singles=', '  const hitValues='),
  extract('  // Achievement model:', '  // Achievement views.'),
  extract('  function derive(match)', '  function validData'),
  extract('  function hitFromCode', '  function validBoardPosition'),
  extract('  function hitSequence', '  const dartDesigns='),
  extract('  function playerStats(id)', '  function renderPlayers'),
].join('\n'), context);
const visit = (total, extra = {}) => ({ total, darts: 3, bust: false, double: false, ...extra });
let serial = 0;
const match = (totals, extra = {}) => ({
  id: 'bust-' + serial++, startedAt: '2026-10-28T00:00:00Z',
  players: [{ id: 'p', name: 'Player' }],
  visits: totals.map(v => typeof v === 'number' ? visit(v) : v),
  out: 'straight', bestOf: 1, abandoned: false, pending: [], ...extra,
});
const plain = value => JSON.parse(JSON.stringify(value));
const stats = game => plain(context.derive(game).stats[0]);
const progress = game => context.buildAchievements([game]).get('p');
const profile = games => {
  context.data.matches = games;
  return context.playerStats('p');
};

const onlyBusts = match([visit(180, { bust: true }), visit(50, { darts: 1, hits: ['BULL'], bust: true })]);
assert.deepEqual(stats(onlyBusts), { points: 0, darts: 0, best: 0, visits: 0 });
assert.equal(profile([onlyBusts]).average, '—', 'Only busts leaves the average empty');
assert.equal(profile([onlyBusts]).best, 0, 'A bust cannot set best visit');
assert.equal(context.derive(onlyBusts).rows.length, 2, 'Busts remain in the visit log');
assert.equal(context.derive(onlyBusts).scores[0], 301, 'Busts restore the starting score');
assert.equal(context.derive(onlyBusts).round, 3, 'Busts still advance rounds');

for (const [name, total, out] of [['overscore', 21, 'straight'], ['leave one', 19, 'double'], ['invalid finish', 20, 'double']]) {
  const game = match([180, 101, visit(total, { darts: 1 })], { out });
  assert.equal(context.derive(game).rows.at(-1).bust, true, name + ' is derived as a bust without its saved flag');
  assert.deepEqual(stats(game), { points: 281, darts: 6, best: 180, visits: 2 }, name + ' does not enter statistics');
  assert.equal(profile([game]).average, '140.5', name + ' does not dilute the average');
}

const wholeVisit = match([180, visit(150, { hits: ['BULL', 'D20', 'T20'], double: false })]);
assert.deepEqual(stats(wholeVisit), { points: 180, darts: 3, best: 180, visits: 1 }, 'All darts in a bust visit are excluded');
assert.equal(progress(wholeVisit).progress.bull, 0, 'Earlier bullseye in a later-busted visit is excluded');
assert.equal(progress(wholeVisit).progress.doubles, 0, 'Earlier double in a later-busted visit is excluded');
assert.equal(progress(wholeVisit).progress.maximum, 180, 'The valid preceding visit still counts');

const misses = match([60, visit(0, { hits: ['MISS', 'MISS', 'MISS'] })]);
assert.deepEqual(stats(misses), { points: 60, darts: 6, best: 60, visits: 2 }, 'A zero-score non-bust visit still counts');
assert.equal(profile([misses]).average, '30.0');
assert.deepEqual(stats(match([60, visit(100, { bust: true })])), { points: 60, darts: 3, best: 60, visits: 1 }, 'Legacy total-only records follow the same rule');

const multiplayer = match([60, visit(150, { bust: true }), 30], { players: [{ id: 'p' }, { id: 'other' }] });
assert.deepEqual(plain(context.derive(multiplayer).rows.map(row => row.player)), [0, 1, 0], 'Busts retain the throwing order');
assert.equal(context.derive(multiplayer).turn, 1);
assert.deepEqual(plain(context.derive(multiplayer).stats[1]), { points: 0, darts: 0, best: 0, visits: 0 });

const live = match([180, 101], { pending: ['S5'] });
assert.equal(profile([live]).average, '122.6', 'A valid pending dart provisionally counts');
live.pending.push('S20');
assert.equal(profile([live]).average, '140.5', 'A bust removes the whole provisional visit from the average');
assert.equal(context.liveGame(live).scores[0], 20, 'Bust preview restores the remaining score');
live.visits.push(visit(25, { darts: 2, hits: [...live.pending], bust: true }));
live.pending = [];
assert.equal(profile([live]).average, '140.5', 'Saving a bust keeps the same excluded average');
live.visits.pop(); live.pending = ['S5'];
assert.equal(profile([live]).average, '122.6', 'Undoing the bust restores the valid pending dart');
live.pending = [];
assert.equal(profile([live, match([visit(50, { darts: 1 })]), onlyBusts]).average, '141.9', 'Profile aggregates only eligible darts across games');

for (const [id, code, total, bustTotal, bustHits] of [
  ['bull', 'BULL', 50, 150, ['BULL', 'BULL', 'BULL']],
  ['doubles', 'D1', 2, 6, ['D1', 'D1', 'D1']],
]) {
  const game = match(Array.from({ length: 4 }, () => visit(total, { darts: 1, hits: [code], double: true })));
  game.visits.push(visit(bustTotal, { hits: bustHits, double: true, bust: true }));
  assert.equal(progress(game).progress[id], 4, id + ' bust cannot cross the next threshold');
  assert.equal(progress(game).earned[id]?.level || 0, id === 'bull' ? 1 : 0);
  game.visits.push(visit(total, { darts: 1, hits: [code], double: true, recordedAt: '2026-10-28T00:01:00Z' }));
  assert.equal(progress(game).progress[id], 5, id + ' next valid hit reaches the target');
  assert.equal(progress(game).earned[id].visit, 5, id + ' evidence skips the bust visit');
  assert.equal(progress(game).earned[id].at, '2026-10-28T00:01:00Z');
  assert.deepEqual(plain(progress(JSON.parse(JSON.stringify(game)))), plain(progress(game)), 'Reloaded history recalculates the same progress');
  game.visits.pop();
  assert.equal(progress(game).progress[id], 4, 'Undo revokes progress from the qualifying visit');
  assert.equal(progress(game).earned[id]?.level || 0, id === 'bull' ? 1 : 0, 'Undo revokes the new level');
}

console.log('Bust exclusion passed: derived and saved busts, full visits, averages, pending/undo, legacy data, history, misses, bull/double tiers, and evidence.');
