async page => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const saved = () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('oche.301.v1')); return d.matches.find(m => m.id === d.currentId).players.map(p => p.id); });
  const order = () => page.locator('[data-player-id]:checked').evaluateAll(els => els.map(el => el.dataset.playerId));
  const initial = await saved();
  // Fix the random draw to make automatic shuffling reproducible.
  await page.evaluate(() => { window.originalRandom = Math.random; Math.random = () => 0; });
  await page.locator('[data-action="new-match"]').click();
  assert(JSON.stringify(await order()) === JSON.stringify([...initial.slice(1), initial[0]]), 'Setup must shuffle automatically');
  await page.evaluate(() => { Math.random = window.originalRandom; });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert(JSON.stringify(await saved()) === JSON.stringify(initial), 'Cancel must preserve the current match');
  await page.locator('[data-action="new-match"]').click();
  while ((await order()).length < 8) {
    await page.locator('#quick-player-name').fill(`Order test ${(await order()).length}`);
    await page.locator('[data-action="quick-add-player"]').click();
  }
  const before = await order();
  await page.locator('#player-choices').evaluate(el => el.scrollTop = 0);
  const grip = await page.locator('[data-reorder-id]').first().boundingBox();
  const second = await page.locator('[data-order-id]').nth(1).boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, second.y + second.height * .75, { steps: 8 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  const moved = await order();
  assert(moved[0] === before[1] && moved[1] === before[0], 'Drag must reorder players');
  assert(await page.locator('[data-reorder-id]:focus').getAttribute('data-reorder-id') === before[0], 'Move must retain focus on the moved player');
  await page.keyboard.press('ArrowUp');
  assert(JSON.stringify(await order()) === JSON.stringify(before), 'Keyboard up must restore order');
  await page.evaluate(() => { Math.random = () => 0; });
  await page.locator('#shuffle-order').click();
  await page.evaluate(() => { Math.random = window.originalRandom; });
  const shuffled = await order();
  assert(JSON.stringify(shuffled) === JSON.stringify([...before.slice(1), before[0]]), 'Shuffle must use all selected players exactly once');
  await page.locator('#new-match-form button[type="submit"]').click();
  assert(JSON.stringify(await saved()) === JSON.stringify(shuffled), 'Start must use the displayed order');
  await page.reload();
  assert(JSON.stringify(await saved()) === JSON.stringify(shuffled), 'Reload must retain the order');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('[data-action="new-match"]').click();
  assert(await page.locator('#dialog').evaluate(el => el.scrollWidth <= el.clientWidth), 'Setup must fit mobile width');
  for (const id of (await order()).slice(1)) await page.locator(`[data-player-id="${id}"]`).uncheck();
  assert(await page.locator('#shuffle-order').isDisabled(), 'Solo shuffle must be disabled');
  assert(await page.locator('[data-reorder-id]:enabled').count() === 0, 'Solo movement must be disabled');
  await page.locator(`[data-player-id="${(await order())[0]}"]`).uncheck();
  await page.locator('#new-match-form button[type="submit"]').click();
  assert(await page.locator('#setup-error').isVisible(), 'Empty lineup must not start');
  console.log('Playing order checks passed: automatic shuffle, cancel, eight players, manual and keyboard moves, shuffle, persistence, mobile, solo, empty selection.');
}
