# OCHE — 301 arcade darts

Open **index.html** directly in a modern browser. The entire app is in one file: HTML, CSS, JavaScript, interactive SVG dartboard, animations, and synthesized sound. No installation, server, build, or internet connection is required.

## Playing

- Choose **New match** for 1–8 players, straight-out or double-out, and a leg-win target. Existing players and saved games remain available.
- New match and rematch setup randomize the selected players’ throwing order. Use **Shuffle order** to draw again or drag a player’s dotted grip to reorder with mouse or touch. Keyboard users can focus the grip and press Up or Down. The displayed order is saved with the match; the opening player still rotates each leg.
- **Tap or click where each dart landed.** Singles score the displayed number, the outer narrow ring doubles it, and the inner narrow ring triples it. Outer bull scores 25; bullseye scores 50.
- Each dart immediately updates the score and is saved, even in an unfinished visit. Three hit slots show the current visit.
- Board clicks and taps place the dart tip at the exact hit location. Positions scale with the board and are retained through reloads, undo, and backups. Keyboard entries, precision buttons, and older records use the segment center because they have no recorded pointer location.
- After three darts, a bust, or a leg win, the board pauses. The **Next player** popup counts down three seconds, then advances automatically; click the button to advance immediately. The countdown starts after the score animation and pauses while a dialog is open or the browser tab is hidden. Extra board taps cannot score for someone else during the pause.
- Use **Miss · 0** for a miss. **End visit early** saves only the darts already thrown.
- **Undo dart** reverses one dart, including after a bust, leg win, match win, or handover. Old records entered as visit totals undo as a complete visit.
- On small screens, **Precision entry** provides larger number buttons with Single, Double, and Triple selectors, plus bull buttons. Miss and undo controls also appear immediately below the board.
- Double-out checkouts are recognized from the actual final segment. An overscore, a remaining 1 in double-out, or reaching zero without the required double busts the entire visit.
- **Players** manages profiles and statistics. **History** shows individual darts, completed matches, and matches ended early. Open a game and choose **Delete game** to remove only that game after confirmation. Player statistics update automatically and profiles are kept. Deleting the current game prepares a fresh game with the same players and rules.

With **3–8 players**, the first checkout earns first place and the leg win, while the others keep playing for their places. Checked-out players are skipped and their large scoreboard number shows their place (1st, 2nd, etc.) instead of zero. Players still throwing keep their remaining score. The leg ends when only one player has not checked out; that player takes the final place with their remaining score recorded. Final standings appear in the result panel and match history. Undo also reverses a placement and can reopen a completed leg or match.

For multi-leg matches, play completes the remaining places before starting the next leg or declaring the match winner. The first player to reach the chosen leg-win target wins the match after that leg's places are decided. Solo and two-player games finish the leg at the winning checkout. The opening player rotates each leg. Three-dart averages use actual darts thrown; bust visits contribute zero points. Pending visits provisionally contribute to the live average until the visit finishes.

Player profiles include **Noob**: the number of completed games finished in last place, using the final leg’s standings. Two-player losses count; solo, unfinished, and older multiplayer games without recorded final placements do not. Undoing a finish or deleting a game updates the count automatically.

## Player avatars

Every player receives a distinct illustrated avatar automatically, including players from older saves. In **Players**, choose the edit button to customize skin tone, background, face shape, expression, hair style and color, accessories, clothing, and clothing color. The preview updates immediately; **Shuffle avatar** generates another combination. Choose **Save changes** to keep it, or close the dialog to discard edits. New players can customize their avatar while being added.

During a game, lineup expressions react after every dart: calm for a level game, happy for a lead, excited for a clear lead or checkout, and focused or disappointed when behind. Busts get a disappointed reaction, and the match winner celebrates. Standings compare legs won before remaining points and account for multiplayer checkout places. Undo restores the corresponding mood. The expression chosen in the editor stays saved for profiles.

Avatars work offline, appear in the lineup and player profiles, and are included in saved data and exported backups.

## Dart unlocks

Open **Players → Dart armory** to preview every design and equip an earned dart. By default, **Auto-upgrade** uses the best unlocked design. Equipment is saved per player and included in backups; the board shows the throwing player's design at the recorded dart location.

| Completed match wins | Design | Effect |
| --- | --- | --- |
| 0 | Classic | Steel and lime flights |
| 1 | Copperhead | Engraved copper and angular flights |
| 2 | Frostbite | Crystal wings and drifting ice |
| 4 | Volt | Crackling lightning |
| 8 | Inferno | Animated flame and embers |
| 16 | Tempest | Electric arcs and a storm orbit |
| 32 | Eclipse | Dark core, violet lightning, luminous orbit |
| 50 | Supernova | Solar wings, flame trail, orbit and expanding corona |

The ladder doubles and caps at 50 wins. Existing completed wins count immediately, including solo matches; legs, losses, and unfinished games do not count. New milestones display an unlock notification. Undoing a victory or deleting a winning game recalculates eligibility; a selected design that becomes locked falls back to the best available design. Reduced-motion mode keeps the designs visible without animation.

## Achievements and player rewards

Open **Players → Achievements** to see progress, preview locked rewards, and equip earned ones. Each set includes a name style, lineup background, avatar frame, player title, and checkout stamp. Use **Equip appearance & stamp** for a coordinated set, or mix individual rewards in **Your equipment**. The throwing indicator and remaining score retain their normal colors.

The preview opens on **Your equipment** and updates as you change individual slots, including clearing them. **Selected reward** previews the highlighted achievement's full set without changing equipment; editing a slot switches back to your equipped combination. The checkout stamp is shown below the lineup, and an open pose preview follows equipment changes.

| Achievement | Unlock condition | Style | Additional pose |
| --- | --- | --- | --- |
| First Blood | Win one completed match | Classic gold | Trophy salute |
| Maximum | Score 180 in a completed visit | Electric violet | Mic drop |
| Bull Club | Hit 25 bullseyes in completed visits | Target mint | — |
| Ice Cold | Check out 100+ in one visit | Frosted blue | Take a bow |
| Comeback King | Win a leg after trailing by 100+ points within that leg | Phoenix ember | — |
| Club Regular | Complete 50 matches, win or lose | Club silver | — |

Existing saved games count immediately. Dart achievements use completed visits, including visits in unfinished or abandoned matches. Actual bullseyes in bust visits count; outer bulls and legacy totals without individual dart records do not count toward Bull Club. Legacy 180 visits and recorded 100+ checkouts can qualify. Comeback gaps are measured after completed visits, reset each leg, and only the first checkout wins the leg. Match milestones require a completed, non-abandoned match with all multiplayer places decided. Solo matches count except for Comeback King.

**Medal shelf:** profiles display up to three pinned achievements. Until you choose your own pins, the first three earned sets are shown. Open a medal to see its earning date and a link to the original match. New visits record their completion time; older achievements show the match date. An explicitly empty shelf stays empty.

**Checkout stamps:** equip a stamp before a checkout to attach your seal to that winning visit. Changing equipment later does not change existing stamps. Old visits without a recorded stamp remain unstamped.

**Victory poses:** Auto matches an earned pose to the occasion: mic drop for a 180, bow for a 100+ checkout, and trophy salute for a match win. Choose a specific unlocked pose to use it for celebrations, or keep the classic dance. All poses retain the player's avatar and clothing. Reduced motion uses a still pose. There are no achievement-specific sounds.

Equipment and pins save immediately and are included in exports. Unlocks are derived from match records, so undo or deleting a game can revoke eligibility. Ineligible cosmetics and medals are hidden, and poses fall back to the classic dance; saved preferences become active again if the reward is re-earned. Stamps are shown only while their achievement is eligible. Reloading or importing a backup recalculates progress without replaying unlock notifications.

The original [achievement samples](achievements-preview.html) remain available in the footer as a separate, read-only design preview using sample players.

## Arcade feedback and accessibility

The throwing player has an enlarged lineup card. After a completed three-dart visit of 26 points or fewer, or a bust, up to two standby players react with playful roast bubbles. On desktop, oversized comic bubbles burst into the board area; mobile layouts keep the phrases within wider player cards. Bubbles allow clicks through them. Checkouts and solo games are excluded. Bubbles clear on handover or undo; reduced-motion mode removes their entrance animation.

Doubles, triples, outer bull, bullseyes, busts, checkouts, and a 180 visit have score animations. A 180, checkout, or match win triggers a full-body avatar celebration with Rickroll-style step-touches, alternating bent-arm gestures, shoulder turns, and a vintage microphone stand. The dancer keeps the player’s customized appearance. The next-player countdown begins after the 4.4-second dance, and undo cancels it immediately. Reduced-motion settings show a brief, static victory pose instead. Dart markers and the last-hit readout retain scoring information after the effect ends. **Sound** optionally enables locally synthesized arcade tones; it starts muted and the preference is saved.

Reduced-motion settings suppress dramatic effects. The board supports keyboard input: Tab to the board, use arrow keys to select a segment, and Enter or Space to score it. Ctrl/Cmd+Z undoes the last dart. Precision entry uses standard accessible buttons.

## Saving and backups

Players, visits, pending darts, handover state, and sound preference are saved in this browser's localStorage. Keep the HTML file at the same path and use the same browser/profile to retain file-based storage. Clearing browser data removes those records; private browsing may discard them at the end of the session.

**Export data** downloads a JSON backup. **Import** validates the backup and asks before replacing current records. Backups from the original total-entry version remain supported. If storage becomes unavailable or full, scoring continues in memory with a visible warning to export before closing. Storage is local to the device; there is no cloud account or sync.

Older current multiplayer games adopt placement play. Already-played leg boundaries are retained; a current leg that stopped at its first checkout can continue for the remaining places. Archived older matches retain their original results.

## Verification

The lineup, Noob stat, and roast regression checks can be run with Node.js, Python, and Playwright CLI. Start `python -m http.server 8765 --bind 127.0.0.1` in this folder, then run the following in another terminal. The drag check uses Chromium touch emulation and the eight-player fixture created by the playing-order check, so run them in this order:

```powershell
node tests/noob-stats-check.cjs
node tests/achievements-check.cjs
playwright-cli -s=oche-regression open http://127.0.0.1:8765/index.html
playwright-cli -s=oche-regression run-code --filename=tests/playing-order-check.js
playwright-cli -s=oche-regression run-code --filename=tests/lineup-drag-check.js
playwright-cli -s=oche-regression run-code --filename=tests/standby-roast-check.js
playwright-cli -s=oche-regression run-code --filename=tests/avatar-hair-check.js
playwright-cli -s=oche-regression run-code --filename=tests/achievements-browser-check.js
playwright-cli -s=oche-regression run-code --filename=tests/achievement-preview-check.js
playwright-cli -s=oche-regression close
```

These checks replace OCHE data in their disposable browser session. Stop the local server when finished.

The browser tests run against the local HTML file with networking disabled. They cover every board scoring surface, dart-level persistence, busts, undo across legs and wins, legacy saves, eight-player turns, backups, keyboard and touch input, responsive widths, reduced motion, and animation triggers.

With Playwright CLI installed, run from this folder in a disposable browser session:

```powershell
playwright-cli -s=oche-test open "file:///C:/path/to/DD/index.html" --config=tests/playwright.config.json
playwright-cli -s=oche-test run-code --filename=tests/arcade-check.js
playwright-cli -s=oche-test run-code --filename=tests/arcade-edge-cases.js
playwright-cli -s=oche-test run-code --filename=tests/placements-check.js
playwright-cli -s=oche-test run-code --filename=tests/dart-position-check.js
playwright-cli -s=oche-test close
playwright-cli -s=oche-touch open "file:///C:/path/to/DD/index.html" --mobile --config=tests/playwright.config.json
playwright-cli -s=oche-touch run-code --filename=tests/arcade-touch.js
playwright-cli -s=oche-touch run-code --filename=tests/dart-position-check.js
playwright-cli -s=oche-touch close
```

Tests clear OCHE data in their own browser session and create `tests/exported-backup.json` and screenshots under `.playwright-cli/` as temporary artifacts. No testing tools are needed to use the app.
