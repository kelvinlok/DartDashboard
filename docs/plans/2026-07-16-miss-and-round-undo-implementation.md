# Miss Entry and One-Round Undo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an explicit zero-point miss action and retain exactly one full round of undoable score-entry actions.

**Architecture:** Keep the existing immutable game-transition and full-snapshot undo model, but store a flat rolling window capped at three actions per player. Route the new miss button through the same dart-hit transition and presentation path as SVG segments so scoring, handoffs, persistence, and Undo stay consistent.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js built-in test runner, localStorage

---

### Task 0: Preserve the Existing Dartboard Color Fix

**Files:**
- Modify: `styles.css:456-465`
- Test: `tests/board-colors.test.js`

The working tree already contains the approved black/white bed correction. Commit it separately so later CSS work for the miss control does not mix concerns.

**Step 1: Verify the focused regression**

Run: `node --test tests/board-colors.test.js`

Expected: PASS with one test proving even single beds are black and odd single beds are cream.

**Step 2: Verify the full suite**

Run: `node --test`

Expected: all tests pass.

**Step 3: Commit only the color fix**

```powershell
git add -- styles.css tests/board-colors.test.js
git commit -m "fix: correct dartboard black and white beds"
```

### Task 1: Retain One Full Round of Flat Undo Snapshots

**Files:**
- Modify: `tests/scoring.test.js:350-410`
- Modify: `app.js:115-125`
- Modify: `app.js:300-325`

**Step 1: Replace the one-step undo test with failing rolling-window tests**

Add these tests near the existing Undo coverage in `tests/scoring.test.js`:

```javascript
test("retains six undo actions for a two-player game", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");

  for (let index = 0; index < 7; index += 1) {
    game = applyDartHit(game, { area: "miss", value: 0 });
  }

  assert.equal(game.snapshots.length, 6);

  for (let index = 0; index < 6; index += 1) game = undo(game);
  assert.equal(game.currentPlayerIndex, 0);
  assert.equal(game.currentTurn.darts.length, 1);
  assert.equal(game.snapshots.length, 0);
  assert.deepEqual(undo(game), game);
});

test("retains nine undo actions for a three-player game", () => {
  let game = createGame(["Kelvin", "Ada", "Grace"], "straight");

  for (let index = 0; index < 10; index += 1) {
    game = applyDartHit(game, { area: "miss", value: 0 });
  }

  assert.equal(game.snapshots.length, 9);
});

test("stores each keyboard total as one undo action", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  game = applyManualScore(game, 60);
  game = applyManualScore(game, 45);

  assert.equal(game.snapshots.length, 2);
  game = undo(game);
  assert.equal(game.players[0].score, 241);
  assert.equal(game.players[1].score, 301);
  assert.equal(game.currentPlayerIndex, 1);
});
```

Replace the old normalization expectation with coverage for trimming and flattening:

```javascript
test("normalizes saved undo history to a flat one-round window", () => {
  const game = createGame(["Kelvin", "Ada", "Grace"], "straight");
  const snapshots = [];

  for (let index = 0; index < 12; index += 1) {
    const snapshot = structuredClone(game);
    snapshot.lastEvent = `legacy-${index}`;
    snapshot.snapshots = [structuredClone(game)];
    snapshots.push(snapshot);
  }

  game.snapshots = snapshots;
  const normalized = normalizeLoadedGame(game);

  assert.equal(normalized.snapshots.length, 9);
  assert.equal(normalized.snapshots[0].lastEvent, "legacy-3");
  assert.ok(normalized.snapshots.every((snapshot) => snapshot.snapshots.length === 0));
});
```

**Step 2: Run the focused tests and verify RED**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because `pushSnapshot` still replaces the history with one entry and normalization still retains only one entry.

**Step 3: Implement the bounded flat history**

Add a pure capacity helper beside `pushSnapshot` in `app.js`:

```javascript
function undoHistoryLimit(game) {
  return Array.isArray(game?.players) ? game.players.length * 3 : 0;
}

function flatSnapshot(game) {
  const snapshot = clone(game);
  snapshot.snapshots = [];
  return snapshot;
}

function pushSnapshot(game) {
  const limit = undoHistoryLimit(game);
  const snapshots = Array.isArray(game.snapshots)
    ? game.snapshots.map(flatSnapshot)
    : [];
  snapshots.push(flatSnapshot(game));
  game.snapshots = limit > 0 ? snapshots.slice(-limit) : [];
}
```

Update the start of `normalizeLoadedGame`:

```javascript
const limit = undoHistoryLimit(normalized);
normalized.snapshots = Array.isArray(normalized.snapshots) && limit > 0
  ? normalized.snapshots.slice(-limit).map(flatSnapshot)
  : [];
```

Do not change `undo`: it already pops the newest snapshot and reattaches the remaining history to the restored state.

**Step 4: Run the focused tests and verify GREEN**

Run: `node --test tests/scoring.test.js`

Expected: all scoring tests pass.

**Step 5: Commit the undo redesign**

```powershell
git add -- app.js tests/scoring.test.js
git commit -m "feat: retain one round of undo history"
```

### Task 2: Define Miss Scoring and Presentation

**Files:**
- Modify: `tests/scoring.test.js:20-110`
- Modify: `app.js:330-360`
- Modify: `app.js:820-830`

**Step 1: Write failing miss-behavior tests**

Add `dartLabel` to the import list in `tests/scoring.test.js`, then add:

```javascript
test("records a miss as a zero-point dart", () => {
  const previous = createGame(["Kelvin", "Ada"], "straight");
  const game = applyDartHit(previous, { area: "miss", value: 0 });

  assert.equal(game.players[0].score, 301);
  assert.equal(game.currentTurn.total, 0);
  assert.deepEqual(game.currentTurn.darts, [
    { area: "miss", value: 0, score: 0 },
  ]);
  assert.equal(game.lastEvent, "miss");
});

test("three misses complete the visit and advance the player", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  game = applyDartHit(game, { area: "miss", value: 0 });
  game = applyDartHit(game, { area: "miss", value: 0 });
  game = applyDartHit(game, { area: "miss", value: 0 });

  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.history[0].total, 0);
  assert.equal(game.history[0].darts.length, 3);
  assert.equal(game.players[0].score, 301);
});

test("presents a miss without a scoring sound", () => {
  assert.equal(dartLabel({ area: "miss", value: 0, score: 0 }), "MISS");
  assert.equal(soundEventForDart({ area: "miss" }, { lastEvent: "miss" }), null);
  assert.equal(boardEffectClass("miss"), null);
  assert.equal(comicCalloutForArea("miss"), null);
});
```

**Step 2: Run the focused tests and verify RED**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because `dartLabel` is not exported and currently renders a miss as `0`.

**Step 3: Implement the minimal presentation change**

Add `dartLabel` to the exported `api` object in `app.js`. Update the helper:

```javascript
function dartLabel(dart) {
  if (dart.area === "miss") return "MISS";
  if (dart.area === "triple") return `T${dart.value}`;
  if (dart.area === "double") return `D${dart.value}`;
  if (dart.area === "outerBull") return "25";
  if (dart.area === "bullseye") return "BULL";
  if (dart.area === "manual") return `${dart.score}`;
  return `${dart.value}`;
}
```

No scoring change is required: `scoreForHit` already treats `area === "miss"` as zero, and the existing sound/effect allowlists already exclude it.

**Step 4: Run the focused tests and verify GREEN**

Run: `node --test tests/scoring.test.js`

Expected: all scoring tests pass.

**Step 5: Commit the miss model and presentation**

```powershell
git add -- app.js tests/scoring.test.js
git commit -m "feat: record zero-point missed darts"
```

### Task 3: Add the Explicit Miss Control

**Files:**
- Modify: `index.html:121-124`
- Modify: `styles.css:376-440`
- Modify: `styles.css:1340-1360`
- Modify: `app.js:735-765`
- Modify: `app.js:835-875`
- Modify: `app.js:950-965`
- Modify: `app.js:995-1015`
- Create: `tests/miss-control.test.js`

**Step 1: Write a failing markup regression test**

Create `tests/miss-control.test.js`:

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("provides an explicit miss button below the dartboard", () => {
  assert.match(
    html,
    /<div class="board-stack">[\s\S]*<div id="dartboard" class="dartboard"><\/div>[\s\S]*<button[^>]*id="miss-button"[^>]*>[\s\S]*Miss[\s\S]*0[\s\S]*<\/button>[\s\S]*<\/div>/,
  );
});
```

**Step 2: Run the markup test and verify RED**

Run: `node --test tests/miss-control.test.js`

Expected: FAIL because the board stack and miss button do not exist.

**Step 3: Add the native button below the board mount**

Replace the contents of `.board-stage` in `index.html` with:

```html
<div class="board-stack">
  <div id="dartboard" class="dartboard"></div>
  <button
    id="miss-button"
    type="button"
    class="ghost-button miss-button"
    aria-label="Record missed dart for zero points"
  >
    <strong>Miss</strong>
    <span>0 points</span>
  </button>
</div>
```

**Step 4: Route the button through the existing dart action path**

In `app.js`, extract the transition body from `handleBoardAction` into:

```javascript
function recordDartHit(hit) {
  if (!state.game || state.game.status !== "playing" || state.turnHandoff) return;

  try {
    const previous = state.game;
    const next = applyDartHit(previous, hit);
    const soundEvent = soundEventForDart(hit, next);
    const handoff = turnHandoffFor(previous, next);
    const event = next.lastEvent === "bust" ? "bust" : next.lastEvent;
    const calloutArea = event === "bust" ? "bust" : hit.area;
    const presentation = handoffPresentation(next, handoff, calloutArea);
    setGame(next, {
      handoff,
      handoffDuration: presentation?.handoffDuration,
    });
    playSound(soundEvent);
    flashBoard(event === "checkout" ? "checkout" : event || hit.area);
    showComicCallout(calloutArea);
    if (presentation) {
      showTurnAnnouncement(presentation.player, presentation.announcementDelay);
    }
  } catch (error) {
    showToast(error.message);
  }
}
```

Keep `handleBoardAction` responsible only for finding a `.segment` and constructing its hit, then call `recordDartHit(hit)`. Bind the new button in `bindEvents`:

```javascript
els.missButton.addEventListener("click", () => {
  recordDartHit({ area: "miss", value: 0 });
});
```

Add `missButton: $("#miss-button")` in `init`. In `renderGame`, set:

```javascript
els.missButton.disabled = !playing;
```

Do not add a click listener to `.board-stage`; empty stage clicks must remain inert.

**Step 5: Style the control without shrinking the board**

Add desktop styles near `.board-stage`:

```css
.board-stack {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 10px 14px 14px;
}

.miss-button {
  width: min(100%, 320px);
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.miss-button span {
  color: var(--muted);
  font-size: 0.78rem;
}

.dart-chip.miss {
  border: 1px dashed var(--muted);
  background: #11151d;
  color: var(--muted);
}
```

Inside the `max-width: 680px` media query, keep the board within its stack:

```css
.board-stack {
  gap: 6px;
  padding: 4px 4px 8px;
}

.dartboard {
  width: 100%;
  max-width: 100%;
}

.miss-button {
  width: min(100%, 280px);
  min-height: 44px;
}
```

**Step 6: Run focused and full automated checks**

Run: `node --test tests/miss-control.test.js tests/scoring.test.js`

Expected: both test files pass.

Run: `node --test`

Expected: all repository tests pass.

**Step 7: Commit the control**

```powershell
git add -- index.html app.js styles.css tests/miss-control.test.js
git commit -m "feat: add explicit missed dart control"
```

### Task 4: Verify Persistence, Performance, and Responsive Behavior

**Files:**
- Verify: `app.js`
- Verify: `index.html`
- Verify: `styles.css`
- Verify: `tests/scoring.test.js`
- Verify: `tests/miss-control.test.js`

**Step 1: Run syntax and whitespace checks**

Run: `node --check app.js`

Expected: exit code 0 with no output.

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

**Step 2: Run the complete suite from a clean process**

Run: `node --test`

Expected: all tests pass with zero failures, cancellations, or skipped tests.

**Step 3: Exercise long-match snapshot bounds**

Run:

```powershell
@'
const { createGame, applyDartHit } = require("./app.js");
let game = createGame(["A", "B", "C"], "straight");
for (let index = 0; index < 300; index += 1) {
  game = applyDartHit(game, { area: "miss", value: 0 });
}
if (game.snapshots.length !== 9) throw new Error("Undo window is not bounded to 9");
if (game.snapshots.some((snapshot) => snapshot.snapshots.length !== 0)) {
  throw new Error("Nested undo history detected");
}
console.log(`snapshots=${game.snapshots.length} bytes=${JSON.stringify(game).length}`);
'@ | node -
```

Expected: `snapshots=9`, no nested-history error, and stable completion time.

**Step 4: Perform desktop and mobile browser smoke tests**

Serve the repository over a local HTTP server and verify at desktop width and 390 by 844:

- `Miss · 0` appears directly below the board without reducing or clipping it.
- Clicking Miss adds a `MISS` chip, keeps Remaining unchanged, and advances Darts.
- Three misses trigger the normal one-second player handoff.
- Empty board-stage clicks do nothing.
- Undo is locked during handoff, then restores each miss and crosses player boundaries.
- Seven actions in a two-player game allow six consecutive Undo operations and no seventh.
- Keyboard totals each require only one Undo.
- Bust and checkout Undo restore score, active player, finish order, and match status.
- Refresh preserves the bounded undo window.

**Step 5: Review the final change set**

Run: `git status --short`

Expected: only intentional implementation-plan or verification artifacts remain uncommitted.

Run: `git log -5 --oneline`

Expected: separate commits for the color correction, undo redesign, miss model, and miss control.
