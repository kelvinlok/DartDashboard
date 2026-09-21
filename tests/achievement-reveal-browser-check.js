async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('oche.301.v1')));
  const base=await saved();
  const visit=(total,extra={})=>({total,darts:3,bust:false,double:false,...extra});
  const seed=async (visits=[],pending=['S20','S20'])=>{
    const d=JSON.parse(JSON.stringify(base)),m=d.matches[0];
    d.players[0].name='Shadow';m.players=[{...d.players[0]}];
    m.visits=visits;m.pending=pending;m.pendingPositions=pending.map(()=>null);m.awaitingNext=false;
    await page.evaluate(d=>localStorage.setItem('oche.301.v1',JSON.stringify(d)),d);
    await page.reload();
  };
  const hit=code=>page.locator('.board-segment[data-inner="false"][data-code="'+code+'"]').click();
  const notice=page.locator('#achievement-notice');
  const pauseArtwork=()=>notice.evaluate(el=>{
    for(const animation of el.getAnimations({subtree:true})){animation.pause();animation.currentTime=690;}
  });
  const assertNoRevealScrollbar=async()=>{
    const frames=await notice.evaluate(el=>{
      const animations=el.getAnimations({subtree:true});
      animations.forEach(animation=>animation.pause());
      return [0,80,150,250,420,690,950,1250,2000].map(time=>{
        animations.forEach(animation=>animation.currentTime=time);
        const style=getComputedStyle(el);
        return {time,vertical:['auto','scroll'].includes(style.overflowY)&&el.scrollHeight>el.clientHeight,horizontal:['auto','scroll'].includes(style.overflowX)&&el.scrollWidth>el.clientWidth};
      });
    });
    assert(frames.every(frame=>!frame.vertical&&!frame.horizontal),'No scrollbar at any reveal frame: '+JSON.stringify(frames));
  };
  await seed(); await hit('S20');
  assert(await notice.evaluate(el=>el.classList.contains('revealing')),'New level starts a dramatic reveal');
  assert(await notice.evaluate(el=>getComputedStyle(el).animationName)==='achievement-slam','Banner entrance animation');
  assert(await page.locator('.achievement-featured .achievement-notice-art>svg').evaluate(el=>getComputedStyle(el).animationName)==='achievement-medal-slam','Medal slams into place');
  assert(await page.locator('.achievement-impact-ray').count()===12,'Burst rays are present');
  assert((await notice.textContent()).includes('Maximum · Bronze'),'Achievement, player, and level are shown');
  await assertNoRevealScrollbar();
  await pauseArtwork();
  await page.screenshot({path:'.playwright-cli/achievement-reveal-desktop.png'});
  await page.waitForFunction(()=>!document.querySelector('#achievement-notice').classList.contains('revealing'));
  assert(await notice.isVisible(),'Reveal settles into a compact notice');
  assert((await saved()).matches[0].awaitingNext,'Handover waits until after the full reveal');
  assert((await page.locator('[data-next-countdown]').textContent()).includes('3 seconds'),'Countdown starts fresh after the reveal');
  await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('oche.301.v1')).matches[0].awaitingNext);
  assert(await notice.isHidden(),'Automatic handover cleans up the notice');

  await seed(); await hit('S20');
  await page.keyboard.press('Control+z');
  assert(await notice.isHidden(),'Undo cancels the reveal immediately');
  assert(await page.locator('.achievement-impact-ring').count()===0,'Undo removes decorative effects');
  await hit('S20');
  assert(await notice.evaluate(el=>el.classList.contains('revealing')),'Re-earning restarts the reveal');
  await page.locator('#achievement-notice [data-action="dismiss-achievement"]').click();
  assert(await notice.isHidden(),'Dismiss cancels the reveal');
  await page.locator('.board-turn-callout [data-action="next-player"]').click();
  assert(!(await saved()).matches[0].awaitingNext,'Manual handover stays available');

  await seed([visit(60,{hits:['S20','S20','S20']})],['T20','S20']); await hit('S20');
  assert((await page.locator('.achievement-notice-heading').textContent()).includes('level up'),'Existing track announces an upgrade');
  assert((await notice.textContent()).includes('Maximum · Silver'),'Upgrade uses the new tier');
  await page.locator('#achievement-notice [data-action="achievements"]').click();
  assert(await notice.isHidden(),'View cancels the animation');
  assert(await page.locator('#achievement-name').textContent()==='Maximum','View opens the featured achievement');

  for(const width of [390,320]){
    await page.setViewportSize({width,height:850});
    await seed([
      visit(120,{hits:['T16','T7','T17']}),
      visit(88,{hits:['T16','T7','S19']})
    ],['T17','S20']);
    await hit('D11');
    assert((await page.locator('.achievement-featured strong').textContent()).includes('Ice Cold · Gold'),'Strongest simultaneous unlock leads');
    assert((await notice.textContent()).includes('First Blood · Bronze')&&(await notice.textContent()).includes('Steady Hand · Bronze'),'Other simultaneous unlocks remain visible');
    await assertNoRevealScrollbar();
    await pauseArtwork();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow at '+width);
    assert(await notice.evaluate(el=>el.scrollWidth<=el.clientWidth),'No notice overflow at '+width);
    const box=await notice.boundingBox();
    assert(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=850,'Reveal fits viewport at '+width);
    if(width===390)await page.screenshot({path:'.playwright-cli/achievement-reveal-mobile.png'});
  }

  await page.setViewportSize({width:1280,height:1000});
  const group=JSON.parse(JSON.stringify(base)),template=group.matches[0];
  group.players=Array.from({length:3},(_,i)=>({id:'group-'+i,name:'Player '+(i+1)}));
  template.players=group.players;template.finishMode='placements';
  group.matches=Array.from({length:4},(_,i)=>({...template,id:'previous-'+i,visits:[180,180,0,121,121].map(total=>visit(total)),pending:[],awaitingNext:false}));
  const active={...template,id:'active',visits:[180,180,0,121].map(total=>visit(total)),pending:['T20','S11'],pendingPositions:[null,null],awaitingNext:false};
  group.matches.push(active);group.currentId=active.id;
  await page.evaluate(d=>localStorage.setItem('oche.301.v1',JSON.stringify(d)),group);await page.reload();await hit('BULL');
  assert(await page.locator('.achievement-notice-row').count()===3,'Every player earning attendance gets a notification');
  for(const p of group.players)assert((await notice.textContent()).includes(p.name),'Notification names '+p.name);

  await page.emulateMedia({reducedMotion:'reduce'});
  await seed(); await hit('S20');
  assert(await notice.isVisible()&&!await notice.evaluate(el=>el.classList.contains('revealing')),'Reduced motion uses the compact notification');
  assert(await notice.evaluate(el=>getComputedStyle(el).animationName)==='none','Reduced motion removes the entrance');
  assert(await page.locator('.achievement-impact-ring').first().isHidden(),'Reduced motion hides the burst');
  await page.reload();
  assert(await notice.isHidden(),'Reloading historical unlocks does not replay the reveal');
  assert(errors.length===0,'No browser errors: '+errors.join(', '));
  return 'Dramatic entrance, timed handover, cancellation, repeat unlocks, multiple rewards/players, responsive layout, and reduced motion passed.';
}
