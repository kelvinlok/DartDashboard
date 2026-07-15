# Dartboard Click Latency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove increasing dartboard click latency while retaining one-step undo and existing game effects.

**Architecture:** Limit persisted undo data to the immediately previous game state and migrate legacy saves to that shape. Avoid synchronous animation restarts for hit types without a board animation, and remove the misleading wait cursor while preserving the handoff lock.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js built-in test runner, browser CDP smoke tests

---

### Task 1: Define single-step undo behavior

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`

**Step 1: Write failing tests**

Add tests that enter multiple darts, assert `snapshots.length === 1`, Undo once to the immediately preceding dart, and assert a second Undo has no effect. Add a legacy normalization test that retains only the latest snapshot.

**Step 2: Run tests to verify they fail**

Run: `node --test tests/scoring.test.js`

Expected: failures showing multiple snapshots remain and repeated Undo still walks backward.

**Step 3: Implement the minimal snapshot limit**

Change `pushSnapshot` to replace the snapshot array with one pre-entry snapshot. Normalize loaded snapshot arrays with `slice(-1)` so existing local saves migrate safely.

**Step 4: Run tests to verify they pass**

Run: `node --test tests/scoring.test.js`

Expected: all scoring tests pass.

### Task 2: Avoid unnecessary board reflow

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`

**Step 1: Write a failing effect-selection test**

Add assertions that double, triple, bulls, bust, and checkout are animated board effects while single and score are not.

**Step 2: Run tests to verify they fail**

Run: `node --test tests/scoring.test.js`

Expected: failure because the effect-selection helper does not exist.

**Step 3: Implement and use the allowlist**

Export a small board-effect selector and make `flashBoard` restart layout only when a supported animation will be applied. Clearing an effect must not force layout.

**Step 4: Run tests to verify they pass**

Run: `node --test tests/scoring.test.js`

Expected: all scoring tests pass.

### Task 3: Correct handoff cursor feedback

**Files:**
- Modify: `styles.css`

**Step 1: Add a source regression check**

Confirm `.is-handoff .board-stage` currently sets `cursor: wait`.

**Step 2: Apply the minimal CSS change**

Use the normal cursor during handoff. Keep the existing handoff state and one-second timer unchanged.

### Task 4: Verify responsiveness and regressions

**Files:**
- Verify: `app.js`
- Verify: `styles.css`
- Verify: `index.html`

**Step 1: Run static and unit checks**

Run: `node --check app.js`

Run: `node --test tests/scoring.test.js`

Expected: syntax check succeeds and all tests pass.

**Step 2: Measure long-match browser input**

Load a generated 210-dart game in headless Chrome, dispatch ordinary single hits, and compare synchronous click duration with the pre-fix 24-26 ms measurement.

Expected: click handling remains near fresh-game timing and the save is substantially smaller than 2.1 MB.

**Step 3: Smoke-test responsive layouts and assets**

Verify no horizontal overflow at 390px, stable board placement on desktop, and HTTP 200 responses for `index.html`, `styles.css`, and `app.js`.
