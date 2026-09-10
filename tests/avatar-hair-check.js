async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.reload();
  await page.locator('[data-tab="players"]').first().click();
  await page.locator('[data-action="edit-player"]').first().click();
  const choose = (part, value) => page.locator('#avatar-' + part).selectOption(String(value));
  await choose('hair', 0);
  const colors = ['#232735', '#4b332d', '#8d4b32', '#e4b85e', '#d8dfe5', '#d978a1'];
  // Verify real rendered fills for every color and every style that has hair.
  for (const style of [0, 1, 2, 3, 5]) {
    await choose('hair', style);
    assert(await page.locator('#avatar-hairColor').isEnabled(), 'Hair color must be enabled');
    for (let color = 0; color < colors.length; color++) {
      await choose('hairColor', color);
      const paths = page.locator('#avatar-preview g[fill="' + colors[color] + '"] > path');
      assert(await paths.count() === 1, 'The selected style must render its hair');
      const fill = await paths.evaluate(el => getComputedStyle(el).fill);
      const hex = colors[color];
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      assert(fill === `rgb(${rgb.join(', ')})`, 'Hair must visibly use the selected color');
      if (style === 3) assert(await page.locator('#avatar-preview .avatar-character > path[fill="' + hex + '"]').count() === 1, 'Long hair must recolor its back as well');
    }
  }
  await choose('hairColor', 1);
  await choose('hair', 4);
  assert(await page.locator('#avatar-hairColor').isDisabled(), 'Bald must disable hair color');
  assert(await page.locator('#avatar-hairColor-help').isVisible(), 'Bald must explain the disabled control');
  assert(await page.locator('#avatar-preview g[fill="#4b332d"] > path').count() === 0, 'Bald must have no hair');
  await choose('accessory', 4);
  assert(await page.locator('#avatar-accessory-help').isVisible(), 'Headband must explain its color');
  await choose('accessory', 0);
  assert(await page.locator('#avatar-accessory-help').isHidden(), 'Other accessories must hide the headband hint');
  await page.locator('#player-form button[type="submit"]').click();
  await page.reload();
  await page.locator('[data-tab="players"]').first().click();
  await page.locator('[data-action="edit-player"]').first().click();
  assert(await page.locator('#avatar-hairColor').isDisabled(), 'Saved Bald must start with hair color disabled');
  await choose('hair', 0);
  assert(await page.locator('#avatar-hairColor').inputValue() === '1', 'Previous hair color must survive Bald and reload');
  assert(await page.locator('#avatar-hairColor-help').isHidden(), 'Hair must hide the Bald hint');
  for (let i = 0; i < 12; i++) {
    await page.locator('[data-action="shuffle-avatar"]').click();
    assert(await page.locator('#avatar-hairColor').isDisabled() === (await page.locator('#avatar-hair').inputValue() === '4'), 'Shuffle must synchronize hair color availability');
  }
  return 'All 30 hair style/color combinations, Bald, headband hints, save/reload, and shuffle passed.';
}
