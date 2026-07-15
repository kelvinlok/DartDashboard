# Incoming Turn Announcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dramatic incoming-player animation to the handoff pause while sequencing it after existing special-hit effects.

**Architecture:** Pure helpers produce announcement copy and timing. The browser layer coordinates handoff duration and a dedicated overlay, while existing scoring and comic-callout behavior remain unchanged.

**Tech Stack:** Vanilla JavaScript, CSS animations, semantic HTML, Node.js built-in test runner, browser CDP checks

---

### Task 1: Define announcement copy and timing

**Files:**
- Modify: `tests/scoring.test.js`
- Modify: `app.js`

**Step 1:** Add failing tests for possessive name formatting and normal versus special timing.

**Step 2:** Run `node --test tests/scoring.test.js` and confirm failures are caused by missing helpers.

**Step 3:** Implement and export the minimal pure helpers.

**Step 4:** Run the scoring suite and confirm it passes.

### Task 2: Coordinate handoff sequencing

**Files:**
- Modify: `app.js`

**Step 1:** Allow `setGame` to receive the computed handoff duration.

**Step 2:** Derive the incoming player only for active matches and schedule the announcement immediately or after the special callout.

**Step 3:** Ensure reset, Undo, new game, and subsequent scoring clear pending announcement timers.

### Task 3: Build the comic handoff overlay

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

**Step 1:** Add the visual-only overlay structure and cache its elements during initialization.

**Step 2:** Add impact burst, opposing text entrances, collision shake, hold, and punch-out animations using transforms and opacity.

**Step 3:** Add mobile long-name sizing and reduced-motion treatment.

### Task 4: Verify behavior and responsiveness

**Files:**
- Verify: `app.js`
- Verify: `styles.css`
- Verify: `index.html`

**Step 1:** Run `node --check app.js`, `node --test tests/scoring.test.js`, and `git diff --check`.

**Step 2:** In a browser, verify ordinary and special sequencing, player-name copy, input lock duration, and preservation of special callouts.

**Step 3:** Verify the overlay fits at 390x844 and desktop board placement remains stable.

**Step 4:** Confirm all static assets return HTTP 200.
