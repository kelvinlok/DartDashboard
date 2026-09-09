async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const base = await page.evaluate(() => JSON.parse(localStorage.getItem('oche.301.v1')));
  async function setup(count = 2, visits = [], pending = []) {
    const d = JSON.parse(JSON.stringify(base)), m = d.matches.find(m => m.id === d.currentId);
    d.players = Array.from({length: count}, (_, i) => ({id: `roast-${i}`, name: `Player ${i + 1}`}));
    m.players = d.players; m.visits = visits; m.pending = pending; m.pendingPositions = pending.map(() => null);
    m.finishMode = count > 2 ? 'placements' : 'first'; m.awaitingNext = visits.length > 0;
    await page.evaluate(d => localStorage.setItem('oche.301.v1', JSON.stringify(d)), d);
    await page.reload();
  }
  const visit = (total, extra = {}) => ({total, darts: 3, bust: false, double: false, ...extra});
  await page.setViewportSize({width:1280,height:900});
  await setup();
  const active = await page.locator('.arcade-player.active').boundingBox();
  const standby = await page.locator('.arcade-player:not(.active)').boundingBox();
  assert(active.height > standby.height * 1.5, 'Thrower card must be substantially taller');
  for (let i=0;i<2;i++) await page.locator('.console-actions [data-code="MISS"]').click();
  assert(await page.locator('.standby-roast').count() === 0, 'No roast before visit completes');
  await page.locator('.console-actions [data-code="MISS"]').click();
  assert(await page.locator('.standby-roast').count() === 1, 'Standby must roast a completed zero visit');
  assert(await page.locator('.arcade-player.active .standby-roast').count() === 0, 'Thrower cannot roast themselves');
  await page.locator('.console-actions [data-action="undo"]').click();
  assert(await page.locator('.standby-roast').count() === 0, 'Undo clears roast');
  await setup(2, [visit(26)]);
  assert(await page.locator('.standby-roast').count() === 1, '26 qualifies');
  await page.locator('.board-turn-callout [data-action="next-player"]').click();
  assert(await page.locator('.standby-roast').count() === 0, 'Handover clears roast');
  await setup(2, [visit(27)]);
  assert(await page.locator('.standby-roast').count() === 0, '27 does not qualify');
  await setup(2, [visit(180),visit(0),visit(180,{bust:true})]);
  assert(await page.locator('.standby-roast').count() === 1, 'Bust qualifies');
  await setup(2, [visit(180),visit(0),visit(100),visit(0),visit(21)]);
  assert(await page.locator('.standby-roast').count() === 0, 'Low checkout must never be roasted');
  await setup(1, [visit(0)]);
  assert(await page.locator('.standby-roast').count() === 0, 'Solo has no speakers');
  await page.emulateMedia({reducedMotion:'reduce'});
  await setup(8, [visit(0)]);
  assert(await page.locator('.standby-roast').count() === 2, 'Limit full lineup to two speakers');
  assert(await page.locator('.standby-roast').first().evaluate(el=>getComputedStyle(el).animationName) === 'none', 'Honor reduced motion');
  for(const width of [1280,800,375]) {
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `No horizontal overflow at ${width}`);
    if(width===1280){
      const bubble=await page.locator('.standby-roast').first().boundingBox(),board=await page.locator('.board-stage').boundingBox();
      assert(bubble.x+bubble.width>board.x, 'Desktop bubbles must extend over the board');
      assert(await page.locator('.standby-roast').first().evaluate(el=>getComputedStyle(el).pointerEvents)==='none', 'Bubbles must allow clicks through');
    }
  }
  console.log('Active card and standby roast checks passed.');
}
