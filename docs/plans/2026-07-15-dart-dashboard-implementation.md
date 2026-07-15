# Dart Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-contained GitHub Pages-ready 301 Dart Dashboard for same-device multiplayer scoring.

**Architecture:** Use a static single-page app with `index.html`, `styles.css`, and `app.js`. Keep game rules in pure JavaScript functions exported through CommonJS when running under Node tests and attached to browser state for the UI. Store the active game in `localStorage`.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node's built-in `node:test` and `assert`.

---

### Task 1: Scoring Engine Tests

**Files:**
- Create: `tests/scoring.test.js`
- Create: `app.js`

**Step 1: Write the failing test**

Create tests for:
- creating a game with players and out mode
- dartboard visit scoring
- straight-out win at exactly 0
- double-out win only with double or bullseye final dart
- keyboard double-out confirmation
- bust on score below 0
- bust on score 1 in double-out mode
- undo restoring the previous state

**Step 2: Run test to verify it fails**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because `app.js` and exported scoring functions do not exist yet.

### Task 2: Scoring Engine Implementation

**Files:**
- Modify: `app.js`
- Test: `tests/scoring.test.js`

**Step 1: Write minimal implementation**

Implement:
- `createGame(playerNames, outMode)`
- `applyDartHit(game, hit)`
- `applyManualScore(game, score, options)`
- `undo(game)`
- helper turn advancement and bust logic

Represent hits as `{ area: 'single'|'double'|'triple'|'outerBull'|'bullseye'|'miss', value }`.

**Step 2: Run tests**

Run: `node --test tests/scoring.test.js`

Expected: PASS.

### Task 3: Static App Shell

**Files:**
- Create: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

**Step 1: Add semantic HTML shell**

Create setup view, game view, player list, score display, manual score form, dartboard mount, visit log, and controls.

**Step 2: Wire browser state**

Connect setup submission, player turn rendering, manual integer score submission, undo, new game, and `localStorage` restore.

**Step 3: Manual smoke test**

Open `index.html` in a browser and verify a game can be started, scored, undone, and reset.

### Task 4: Clickable Dartboard

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

**Step 1: Render the dartboard**

Use an inline SVG dartboard with clickable score wedges for singles, doubles, triples, outer bull, and bullseye.

**Step 2: Map clicks to hits**

Attach hit metadata to SVG segments and call `applyDartHit`.

**Step 3: Confirm rule behavior**

Verify double-out finishes only work with double or bullseye dartboard clicks, and manual exact-zero double-out entries prompt for confirmation.

### Task 5: Visual Design and Motion

**Files:**
- Modify: `styles.css`
- Modify: `app.js`

**Step 1: Apply visual thesis**

Use a dark arcade sports-bar interface with high contrast, restrained neon accents, and readable scoring hierarchy.

**Step 2: Add meaningful animations**

Animate doubles, triples, outer bull, bullseye, bust, checkout, and turn changes.

**Step 3: Check responsive layout**

Verify desktop and mobile widths for no overlap, readable controls, and a stable board aspect ratio.

### Task 6: Final Verification

**Files:**
- Test all files

**Step 1: Run automated tests**

Run: `node --test tests/scoring.test.js`

Expected: PASS.

**Step 2: Start local static server**

Run: `python -m http.server 8000`

Expected: server starts and app loads at `http://localhost:8000`.

**Step 3: Browser smoke test**

Verify setup, straight-out scoring, double-out scoring, keyboard scoring, undo, saved refresh, and animations.

**Step 4: Report status**

Summarize implemented files, verification commands, and any known limitations.
