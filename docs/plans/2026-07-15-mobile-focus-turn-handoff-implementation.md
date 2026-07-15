# Mobile Focus And Turn Handoff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prioritize score and dartboard on mobile, hold every completed attempt for one second, and add a comic `BUSTED!` effect.

**Architecture:** Add a pure helper that returns the newly completed history entry when an action ends a visit. Persist the resulting game immediately, but store that entry as transient renderer state for one second; renderer projections use it until the next player is revealed. Use mobile-only CSS reordering and compact sizing so existing semantic controls remain single-source and desktop stays unchanged.

**Tech Stack:** Vanilla JavaScript, CSS Grid, HTML5, Node.js built-in test runner, localStorage

---

### Task 1: Derive Completed-Turn Handoffs

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`

**Step 1: Write failing helper tests**

Import `turnHandoffFor`. Verify one and two dart actions return `null`, while the third dart returns a snapshot containing player, player index, resulting score, total, darts, and result. Add cases for a keyboard total, bust, and checkout.

**Step 2: Verify the tests fail**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because `turnHandoffFor` is not exported.

**Step 3: Implement the pure helper**

```js
function turnHandoffFor(previousGame, nextGame) {
  if (!previousGame || !nextGame) return null;
  if (nextGame.history.length <= previousGame.history.length) return null;
  return clone(nextGame.history[0]);
}
```

Export it through the existing API.

**Step 4: Verify the tests pass**

Run: `node --test tests/scoring.test.js`

Expected: all helper and scoring tests PASS.

### Task 2: Add The Busted Comic Event

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`
- Modify: `styles.css`

**Step 1: Write a failing mapping test**

Assert `comicCalloutForArea("bust") === "BUSTED!"`.

**Step 2: Verify the test fails**

Run: `node --test tests/scoring.test.js`

Expected: FAIL with actual `null`.

**Step 3: Add the event**

Map `bust` to `BUSTED!`, add red and amber comic variables for `data-effect="bust"`, and invoke the comic callout whenever dartboard or keyboard scoring returns `lastEvent === "bust"`. Bust takes visual priority over the struck bed.

**Step 4: Verify the tests pass**

Run: `node --test tests/scoring.test.js`

Expected: all tests PASS.

### Task 3: Hold Completed Attempts For One Second

**Files:**
- Modify: `app.js`

**Step 1: Add transient handoff state**

Add `turnHandoff` and a timer to the browser-only state. Extend `setGame` with an optional handoff snapshot. Save the game immediately, render the handoff, then clear it after 1000ms, rerender, and pulse the newly active player.

**Step 2: Render handoff projections**

When a handoff exists, render its player name, `scoreAfter`, total, darts, and result hint. Disable board scoring, keyboard input, and Undo for the duration. Use the handoff player index for temporary scoreboard emphasis.

**Step 3: Connect all completed visits**

Before applying a dartboard or keyboard action, retain the previous game. Derive the handoff from previous and next state, and pass it to `setGame`. Leave one- and two-dart updates immediate and unlocked.

**Step 4: Clear transient state on navigation**

Undo and New Game cancel any pending timer and comic callout. Refresh naturally loads the already-persisted resulting game without replaying the delay.

### Task 4: Refocus The Mobile Layout

**Files:**
- Modify: `styles.css`

**Step 1: Compact the mobile header**

At 680px and below, keep player name and actions in one row, reduce heading scale, and suppress nonessential match metadata.

**Step 2: Reflow the scoring surface**

Use `display: contents` for the score panel at mobile width so its existing children can participate in the match grid. Place the compact remaining readout and visit counters first, current darts next, the full-width board after them, keyboard entry below the board, and standings/history last.

**Step 3: Establish stable mobile dimensions**

Use fixed responsive grid tracks, a nearly full-width square board, compact gaps, and contained text sizes. Ensure score, player, visit total, dart count, and board are visible within the first mobile screen as far as common viewport heights permit.

### Task 5: Verify The Complete Experience

**Files:**
- Verify: `app.js`
- Verify: `styles.css`
- Verify: `index.html`
- Verify: `tests/scoring.test.js`

**Step 1: Run syntax and automated tests**

Run: `node --check app.js` and `node --test tests/scoring.test.js`.

Expected: zero syntax errors and all tests PASS.

**Step 2: Browser-test handoff timing**

Confirm the third dart, keyboard total, bust, and checkout each hold the completed player and result for about one second, lock input, and then reveal the next player. Confirm the game result exists in localStorage during the hold.

**Step 3: Browser-test mobile composition**

At 390 by 844, confirm the compact player header, remaining score, visit attempt, and full dartboard appear before standings/history without overlap. Confirm desktop layout remains unchanged.

**Step 4: Verify static hosting**

Confirm `index.html`, `styles.css`, and `app.js` each return HTTP 200 from a local static server.

Git commit steps are omitted because this directory is not a Git repository.
