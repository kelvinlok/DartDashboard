# Comic Hit Effects Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix clipped dartboard numbers, use `Noob` default player names, and add visual-only American comic hit announcements.

**Architecture:** Keep the static HTML/CSS/JavaScript structure. Add two pure UI helpers to `app.js` so naming and hit-label behavior are unit-testable, then connect a fixed, pointer-transparent overlay to exact dartboard hit events. Expand the SVG view box rather than shrinking the playable board.

**Tech Stack:** HTML5, CSS animations, inline SVG, vanilla JavaScript, Node.js built-in test runner

---

### Task 1: Test Player Defaults And Comic Labels

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`

**Step 1: Write failing tests**

Import `defaultPlayerName` and `comicCalloutForArea`. Assert that zero-based player indexes produce `Noob 1`, `Noob 2`, and that double, triple, outer bull, and bullseye areas map to `DOUBLE!`, `TRIPLE!`, `BULL!`, and `BULLSEYE!`. Assert a single returns `null`.

**Step 2: Verify the tests fail**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because the two helpers are not exported.

**Step 3: Implement the helpers**

Add and export:

```js
function defaultPlayerName(index) {
  return `Noob ${index + 1}`;
}

function comicCalloutForArea(area) {
  return {
    double: "DOUBLE!",
    triple: "TRIPLE!",
    outerBull: "BULL!",
    bullseye: "BULLSEYE!",
  }[area] || null;
}
```

Use `defaultPlayerName` for the initial two rows, empty row fallbacks, and the Add button.

**Step 4: Verify the tests pass**

Run: `node --test tests/scoring.test.js`

Expected: all tests PASS.

### Task 2: Fix The Dartboard Number Frame

**Files:**
- Modify: `app.js`
- Modify: `styles.css`

**Step 1: Expand the SVG view box**

Change the dartboard view box from `0 0 500 500` to a padded coordinate space that includes every label and its glyph bounds.

**Step 2: Preserve responsive sizing**

Keep the dartboard square and centered while ensuring the full SVG is visible in the stage at desktop and mobile widths.

### Task 3: Add Comic Hit Announcements

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

**Step 1: Add overlay markup**

Add a hidden `aria-live` comic-callout element containing an impact burst and announcement word.

**Step 2: Connect exact hits**

Add `showComicCallout(area)`. Restart its animation for each mapped dartboard area, hide it after roughly 850ms, and do not invoke it for keyboard totals.

**Step 3: Style the impact panel**

Use fixed centering, a jagged polygon burst, halftone dots, thick outlined text, per-hit colors, slam/overshoot/shake keyframes, and pointer-events disabled. Add a reduced-motion fade variant.

### Task 4: Verify The Complete Change

**Files:**
- Verify: `index.html`
- Verify: `styles.css`
- Verify: `app.js`
- Verify: `tests/scoring.test.js`

**Step 1: Run automated tests**

Run: `node --test tests/scoring.test.js`

Expected: all tests PASS with no warnings.

**Step 2: Serve the static site**

Run a local static server and verify `index.html` returns HTTP 200.

**Step 3: Inspect responsive rendering**

Capture desktop and mobile views where browser tooling is available. Confirm all 20 dartboard numbers are visible, the callout is centered above the UI, and no content overlaps.

Git commit steps are omitted because this directory is not a Git repository.
