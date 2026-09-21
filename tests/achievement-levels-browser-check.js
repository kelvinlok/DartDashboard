async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width:1440,height:1100});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('oche.301.v1')));
  const hit = code => page.locator('.board-segment[data-inner="false"][data-code="'+code+'"]').click();
  const next = () => page.locator('.board-turn-callout [data-action="next-player"]').click();
  const close = () => page.locator('#dialog [data-action="close-dialog"]').click();
  const choose = id => page.locator('[data-action="preview-achievement"][data-reward="'+id+'"]').click();
  const open = async () => {
    await page.locator('[data-tab="players"]').first().click();
    await page.locator('.profile [data-action="achievements"]').first().click();
  };
  const fixture = await saved();
  fixture.players[0].name='Shadow';
  const match = fixture.matches[0];
  match.players=[{...fixture.players[0]}];
  await page.evaluate(d=>localStorage.setItem('oche.301.v1',JSON.stringify(d)),fixture);
  await page.reload();

  await hit('S20'); await hit('S20');
  assert(await page.locator('#achievement-notice').isHidden(),'Pending darts cannot unlock a level');
  await hit('S20');
  assert((await page.locator('#achievement-notice').textContent()).includes('Maximum · Bronze'),'First scoring level notifies');
  await page.locator('#achievement-notice [data-action="achievements"]').click();
  assert(await page.locator('.achievement-levels .earned').count()===1,'Bronze only is earned');
  assert((await page.locator('.achievement-next').textContent()).includes('Silver · 60 / 100'),'Progress targets the next level');
  assert(await page.locator('#reward-pose option[value="mic-drop"]').isDisabled(),'Bronze does not unlock Master pose');
  await page.locator('[data-action="equip-achievement"]').click();
  assert(await page.locator('.achievement-sample .reward-frame-medal [data-medal-level="1"]').count()===1,'Bronze frame badge');
  assert((await page.locator('.achievement-sample .reward-title').textContent()).includes('Bronze'),'Bronze title');
  await close();
  await next();
  await hit('T20'); await hit('S20'); await hit('S20');
  assert((await page.locator('#achievement-notice').textContent()).includes('Maximum · Silver'),'An upgrade to an existing track notifies');
  assert(await page.locator('.arcade-player .reward-frame-medal [data-medal-level="2"]').count()===1,'Equipped frame upgrades automatically');
  await page.locator('.console-actions [data-action="undo"]').click();
  assert(await page.locator('#achievement-notice').isHidden(),'Undo clears upgrade notification');
  assert(await page.locator('.arcade-player .reward-frame-medal [data-medal-level="1"]').count()===1,'Undo restores the lower badge');
  assert(await page.locator('.arcade-player .name-maximum').count()===1,'Lower-level appearance remains eligible');
  await hit('S20');
  await page.locator('#achievement-notice [data-action="achievements"]').click();
  assert(await page.locator('.achievement-levels .earned').count()===2,'Re-earning Silver restores two levels');
  assert(await page.locator('.achievement-levels button').count()===2,'Each earned level links to its match');
  assert((await page.locator('.achievement-next').textContent()).includes('Gold · 100 / 140'),'Next target advances to Gold');
  await page.reload();
  assert(await page.locator('#achievement-notice').isHidden(),'Reload does not replay tier notifications');
  await open(); await choose('maximum');
  assert(await page.locator('.achievement-levels .earned').count()===2,'Historical visits restore levels');

  // Shadow's visible 120 and 88 visits leave a 93-point Gold checkout.
  const shadow = await saved(), game = shadow.matches[0];
  game.visits=[
    {total:120,darts:3,bust:false,double:false,hits:['T16','T7','T17']},
    {total:88,darts:3,bust:false,double:false,hits:['T16','T7','S19']}
  ];
  game.pending=[]; game.pendingPositions=[]; game.awaitingNext=false;
  await page.evaluate(d=>localStorage.setItem('oche.301.v1',JSON.stringify(d)),shadow);
  await page.reload();
  await hit('T17'); await hit('S20'); await hit('D11');
  assert((await page.locator('#achievement-notice').textContent()).includes('Ice Cold · Gold'),'A 93 checkout unlocks Gold in one visit');
  await open(); await choose('ice');
  assert(await page.locator('.achievement-levels .earned').count()===3,'Lower Ice Cold levels are included');
  assert((await page.locator('.achievement-next').textContent()).includes('Master · 93 / 100'),'100 checkout remains the Master goal');
  assert(await page.locator('#reward-pose option[value="bow"]').isDisabled(),'Gold keeps the Master bow locked');
  await page.locator('[data-action="equip-achievement"]').click();
  assert((await page.locator('.achievement-sample .reward-title').textContent()).includes('Ice cold · Gold'),'Equipped title shows Gold');
  assert(await page.locator('.achievement-sample .reward-frame-medal [data-medal-level="3"]').count()===1,'Gold frame badge');
  await page.locator('#dialog').evaluate(el=>el.scrollTop=0);
  await page.locator('#dialog').screenshot({path:'.playwright-cli/achievement-levels-desktop.png'});
  for (const width of [768,390,320]) {
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow at '+width);
    assert(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'No dialog overflow at '+width);
    assert(await page.locator('.achievement-levels').evaluate(el=>el.scrollWidth<=el.clientWidth),'Four levels fit at '+width);
  }
  await page.locator('#dialog').evaluate(el=>el.scrollTop=0);
  await page.locator('#dialog').screenshot({path:'.playwright-cli/achievement-levels-mobile.png'});
  await page.locator('.achievement-levels button').first().click();
  assert(await page.locator('#dialog-title').textContent()==='Match record','Tier evidence opens the earning match');
  assert((await page.locator('#dialog').textContent()).includes('Shadow won the match'),'Evidence belongs to Shadow');
  assert(errors.length===0,'No browser errors: '+errors.join(', '));
  return 'Bronze/Silver live upgrades, undo, reload, equipment, tier evidence, 93-point Gold checkout, pose gates, and mobile layout passed.';
}
