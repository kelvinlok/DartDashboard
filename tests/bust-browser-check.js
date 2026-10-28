async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('oche.301.v1')));
  const fixture = await saved(), player = fixture.players[0], match = fixture.matches[0];
  fixture.players = [player];
  player.rewards = {name:'bull',frame:'doubles',pins:['bull','doubles']};
  match.players = [{...player}];
  match.visits = [
    {total:6,darts:3,bust:false,double:true,hits:['D1','D1','D1']},
    {total:2,darts:1,bust:false,double:true,hits:['D1']},
    {total:180,darts:3,bust:false,double:false},
    {total:12,darts:1,bust:false,double:false,hits:['S12']}
  ];
  await page.evaluate(d => localStorage.setItem('oche.301.v1', JSON.stringify(d)), fixture);
  await page.reload();
  const hit = code => page.locator(`.board-segment[data-inner="false"][data-code="${code}"]`).click();
  const average = () => page.locator('.arcade-player .roster-meta strong').first().textContent();
  const close = () => page.locator('#dialog [data-action="close-dialog"]').first().click();
  const undo = () => page.locator('.console-actions [data-action="undo"]').click();
  const progress = async (bull, doubles) => {
    const lineupAverage = await average();
    await page.locator('[data-tab="players"]').first().click();
    assert(await page.locator('.profile-stats>div').nth(3).locator('strong').textContent() === lineupAverage, 'Profile and lineup averages agree');
    await page.locator('.profile [data-action="achievements"]').first().click();
    for (const [id, value, target] of [['bull',bull,1], ['doubles',doubles,5]]) {
      await page.locator(`[data-action="preview-achievement"][data-reward="${id}"]`).click();
      if (value < target) {
        assert((await page.locator('.achievement-next').textContent()).includes(`${value} / ${target}`), `${id} progress excludes the bust visit`);
        assert(await page.locator('[data-action="equip-achievement"]').isDisabled(), `${id} remains locked`);
      } else {
        assert(await page.locator('.achievement-levels .earned').count() === 1, `${id} earns Bronze from a valid visit`);
      }
    }
    await close();
    await page.locator('[data-tab="match"]').first().click();
  };
  assert(await average() === '75.0', 'Baseline average uses eight valid darts');
  await hit('BULL'); await hit('D20');
  assert(await average() === '87.0', 'Pending darts contribute provisionally');
  await hit('T20');
  assert(await average() === '75.0', 'Busting removes all three darts from the average');
  assert((await saved()).matches[0].visits.at(-1).bust, 'Bust stays in the saved history');
  assert(await page.locator('.visit-table .bust-text').count() === 1, 'Bust stays visible in history');
  assert(await page.locator('#achievement-notice').isHidden(), 'Bust cannot trigger an unlock notification');
  await page.reload();
  assert(await average() === '75.0', 'Reload preserves the corrected average');
  assert(await page.locator('.arcade-player .name-bull,.arcade-player .frame-doubles').count() === 0, 'Previously selected locked rewards stay inactive');
  await progress(0, 4);
  await undo();
  assert(await average() === '87.0', 'Undo restores the earlier darts as a pending visit');
  assert(await page.locator('#achievement-notice').isHidden(), 'Pending darts still do not unlock');
  await page.locator('[data-action="end-visit"]').click();
  assert(!(await saved()).matches[0].visits.at(-1).bust, 'Ending the corrected visit records valid darts');
  assert(await page.locator('#achievement-notice').isVisible(), 'Valid visit unlocks the earned rewards');
  await progress(1, 5);
  await undo();
  assert(await average() === '83.3', 'Undoing the valid visit restores only its first pending dart');
  await progress(0, 4);
  assert(errors.length === 0, 'No browser errors: ' + errors.join(', '));
  return 'Bust exclusion, historical recalculation, profile averages, unlocks, and undo passed.';
}
