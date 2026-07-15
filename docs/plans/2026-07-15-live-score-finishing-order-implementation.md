# Live Score And Finishing Order Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update remaining scores after each dart and continue a multiplayer match until every player checks out.

**Architecture:** Keep committed player scores as turn-boundary state and add a pure `liveRemaining(game)` projection for in-progress display. Replace the global first-checkout win transition with an ordered `finishOrder` list; turn advancement skips indexes in that list and the match becomes `complete` only after every player finishes. Existing snapshots continue to provide atomic Undo behavior.

**Tech Stack:** Vanilla JavaScript, HTML5, CSS, localStorage, Node.js built-in test runner

---

### Task 1: Project Live Remaining Scores

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`

**Step 1: Write the failing test**

Import `liveRemaining`. Start a player at 301, apply triple 20, and assert `liveRemaining(game) === 241` while the committed player score is still 301. Apply single 20 and assert the live value is 221.

**Step 2: Verify the test fails**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because `liveRemaining` is not exported.

**Step 3: Implement the projection**

Add and export:

```js
function liveRemaining(game) {
  if (!game || !game.currentTurn) return 0;
  return Math.max(0, game.currentTurn.startScore - game.currentTurn.total);
}
```

Use it for the large Remaining readout, checkout hint, and active unfinished scoreboard row. Keep inactive rows on their committed `player.score` values.

**Step 4: Verify the test passes**

Run: `node --test tests/scoring.test.js`

Expected: the live-score test passes; older winner tests may still reflect the previous state model and will be updated in Task 2.

### Task 2: Record Finish Order And Continue Play

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`

**Step 1: Write failing continuation tests**

Add tests proving:

- the first exact checkout leaves `status === "playing"`, records player index 0 in `finishOrder`, keeps their score at zero, sets them as `winner`, and advances to player 1;
- after a three-player checkout, later turn rotation skips the finished player;
- the final player's checkout changes status to `complete` and preserves finish order;
- Undo after a checkout restores an empty finish order and the original active player.

Update previous assertions that expected `status === "won"` after the first checkout.

**Step 2: Verify the tests fail**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because games have no `finishOrder` and the first checkout still ends scoring.

**Step 3: Implement per-player finishing**

- Initialize `finishOrder: []` in `createGame`.
- Make `advanceTurn` search circularly for the next player whose index is not in `finishOrder`.
- On a valid checkout, set the current score to zero, append the current player index once, retain the first finisher in `winner`, and write the finishing place into the history entry metadata.
- If every player is finished, set `status: "complete"`; otherwise advance to the next unfinished player and leave status as `playing`.
- Keep `lastEvent: "checkout"` so existing checkout feedback still fires.

**Step 4: Verify the tests pass**

Run: `node --test tests/scoring.test.js`

Expected: all scoring and continuation tests PASS.

### Task 3: Present Checkout Positions In The UI

**Files:**
- Modify: `app.js`
- Modify: `styles.css`

**Step 1: Add place formatting**

Add a small ordinal formatter for `1st`, `2nd`, `3rd`, and later positions.

**Step 2: Update game rendering**

- Keep controls enabled while `status === "playing"`.
- Show the next unfinished player in the heading after checkout.
- Show the active player's live remaining value.
- Render finished scoreboard rows with a finished class and ordinal place.
- Show a checkout banner while `lastEvent === "checkout"`; when status is complete, show final match completion copy.
- Treat history result `win` as a checkout and retain its existing positive styling.

**Step 3: Add restrained finish styling**

Visually distinguish finished rows without reducing score-table legibility. Reuse the existing green and cyan system rather than adding another palette.

### Task 4: Preserve Older Saved Matches

**Files:**
- Modify: `app.js`

**Step 1: Normalize loaded state**

When loading a game without `finishOrder`, initialize an empty list. If its old status is `won`, identify the recorded winner or zero-score player, place that index first when possible, and map the match to `complete` so it remains viewable but does not unexpectedly resume.

**Step 2: Keep new playing saves intact**

Do not alter current games that already contain `finishOrder` or any snapshot data.

### Task 5: Verify The Complete Workflow

**Files:**
- Verify: `app.js`
- Verify: `styles.css`
- Verify: `index.html`
- Verify: `tests/scoring.test.js`

**Step 1: Run syntax and automated tests**

Run: `node --check app.js` and `node --test tests/scoring.test.js`.

Expected: zero syntax errors and all tests PASS.

**Step 2: Verify in a browser**

Serve the static site locally. Confirm the large score and active scoreboard row update after one dart, the first checkout advances to the next player, finished rows display places and are skipped, Undo restores checkout state, and all-player completion disables scoring.

**Step 3: Verify static hosting**

Confirm `index.html`, `styles.css`, and `app.js` each return HTTP 200 from the local static server.

Git commit steps are omitted because this directory is not a Git repository.
