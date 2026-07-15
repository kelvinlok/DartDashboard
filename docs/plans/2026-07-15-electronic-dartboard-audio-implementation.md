# Electronic Dartboard Audio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate an original, high-quality electronic dartboard WAV sound pack and integrate responsive, persistent, fault-tolerant playback into the 301 dashboard.

**Architecture:** A standalone `sound-manager.js` module will own Web Audio loading, buses, overlap rules, ducking, and saved preferences. Pure helpers in `app.js` will translate accepted game transitions into semantic sound events, while a reproducible PowerShell/Python asset pipeline will render mastered WAV files with synthesized effects and energetic Windows speech callouts.

**Tech Stack:** Vanilla JavaScript, Web Audio API, Node.js built-in test runner, PowerShell `System.Speech`, Python 3 standard library, PCM WAV assets, HTML/CSS.

---

### Task 1: Define semantic sound events

**Files:**
- Modify: `app.js:20-40`
- Modify: `app.js:305-335`
- Test: `tests/scoring.test.js`

**Step 1: Write the failing event-mapping tests**

Import `soundEventForDart` and add table-driven assertions showing that accepted single, double, triple, outer-bull, and bullseye hits map to their respective event names; a transition ending in `bust` overrides the hit bed; and a transition ending in `checkout` overrides every other hit type.

```js
test("maps accepted dart transitions to semantic sound events", () => {
  assert.equal(soundEventForDart({ area: "single" }, { lastEvent: "single" }), "single");
  assert.equal(soundEventForDart({ area: "double" }, { lastEvent: "double" }), "double");
  assert.equal(soundEventForDart({ area: "triple" }, { lastEvent: "triple" }), "triple");
  assert.equal(soundEventForDart({ area: "outerBull" }, { lastEvent: "outerBull" }), "outerBull");
  assert.equal(soundEventForDart({ area: "bullseye" }, { lastEvent: "bullseye" }), "bullseye");
  assert.equal(soundEventForDart({ area: "triple" }, { lastEvent: "bust" }), "bust");
  assert.equal(soundEventForDart({ area: "double" }, { lastEvent: "checkout" }), "checkout");
});
```

**Step 2: Run the test and verify it fails**

Run: `node --test tests/scoring.test.js`

Expected: FAIL because `soundEventForDart` is not exported.

**Step 3: Implement the pure mapping helper**

Add a small helper near the other presentation helpers. It must give terminal results priority and return `null` for missing/unsupported hits.

```js
function soundEventForDart(hit, nextGame) {
  if (nextGame?.lastEvent === "bust") return "bust";
  if (nextGame?.lastEvent === "checkout") return "checkout";
  return ["single", "double", "triple", "outerBull", "bullseye"].includes(hit?.area)
    ? hit.area
    : null;
}
```

Export it from the existing `api` object.

**Step 4: Run the scoring tests**

Run: `node --test tests/scoring.test.js`

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add app.js tests/scoring.test.js
git commit -m "test(audio): define dart sound event mapping"
```

### Task 2: Build the Web Audio manager with tests

**Files:**
- Create: `sound-manager.js`
- Create: `tests/sound-manager.test.js`

**Step 1: Write failing tests for settings, loading, and playback rules**

Use small fakes for `AudioContext`, `fetch`, and storage. Cover these behaviors:

- The manifest contains all eight event names and their exact WAV paths.
- Defaults are `{ muted: false, volume: 0.8 }`.
- Invalid saved JSON or out-of-range values fall back safely.
- `setMuted` and `setVolume` persist settings.
- `unlock()` resumes a suspended context.
- `load()` fetches and decodes each asset but absorbs individual failures.
- Muted or unloaded events do not start a source.
- Short effects may overlap.
- Starting `bullseye`, `bust`, or `checkout` stops the previous major source.
- Major playback lowers the effects bus and restores it after the buffer duration.

The public CommonJS/browser API should expose:

```js
{
  AUDIO_MANIFEST,
  DEFAULT_AUDIO_SETTINGS,
  SoundManager,
  normalizeAudioSettings,
}
```

**Step 2: Run the test and verify it fails**

Run: `node --test tests/sound-manager.test.js`

Expected: FAIL with `Cannot find module '../sound-manager.js'`.

**Step 3: Implement `sound-manager.js`**

Use the repository’s existing UMD-style pattern so Node can require the module and the browser receives `window.DartAudio`.

```js
const AUDIO_MANIFEST = Object.freeze({
  single: "assets/audio/hit-single.wav",
  double: "assets/audio/hit-double.wav",
  triple: "assets/audio/hit-triple.wav",
  outerBull: "assets/audio/outer-bull.wav",
  bullseye: "assets/audio/bullseye.wav",
  bust: "assets/audio/bust.wav",
  checkout: "assets/audio/checkout.wav",
  turnChange: "assets/audio/turn-change.wav",
});

const MAJOR_EVENTS = new Set(["bullseye", "bust", "checkout"]);
const DEFAULT_AUDIO_SETTINGS = Object.freeze({ muted: false, volume: 0.8 });
```

`SoundManager` receives optional dependencies (`AudioContextClass`, `fetchImpl`, `storage`, `setTimeoutImpl`) for deterministic tests. It creates a master gain, an effects gain, and a major gain. `play(name)` creates a fresh buffer source for overlap, routes major events to the major bus, and tracks/stops only the current major source. Use gain ramps rather than abrupt changes for ducking; restore the effects bus when the major buffer ends. Every public method must catch platform and asset errors and return a harmless result.

**Step 4: Run the manager tests**

Run: `node --test tests/sound-manager.test.js`

Expected: all tests PASS.

**Step 5: Run the full suite**

Run: `node --test tests/*.test.js`

Expected: all tests PASS.

**Step 6: Commit**

```bash
git add sound-manager.js tests/sound-manager.test.js
git commit -m "feat(audio): add resilient Web Audio manager"
```

### Task 3: Create the reproducible sound-production pipeline

**Files:**
- Create: `tools/generate-dart-audio.ps1`
- Create: `tools/render-dart-audio.py`
- Create: `tests/audio-assets.test.js`
- Create: `assets/audio/hit-single.wav`
- Create: `assets/audio/hit-double.wav`
- Create: `assets/audio/hit-triple.wav`
- Create: `assets/audio/outer-bull.wav`
- Create: `assets/audio/bullseye.wav`
- Create: `assets/audio/bust.wav`
- Create: `assets/audio/checkout.wav`
- Create: `assets/audio/turn-change.wav`

**Step 1: Write the failing asset-integrity test**

For every manifest entry, assert that the file exists, begins with `RIFF`, contains `WAVE`, is 44.1 kHz mono 16-bit PCM, has non-silent sample data, and stays below 0 dBFS. Assert sensible duration bands: 0.12–0.8 seconds for normal hits and turn change, 0.6–3.5 seconds for voiced major events.

**Step 2: Run the integrity test and verify it fails**

Run: `node --test tests/audio-assets.test.js`

Expected: FAIL because the WAV files do not exist.

**Step 3: Implement the PowerShell voice renderer**

`tools/generate-dart-audio.ps1` must:

1. Resolve every path relative to the repository root.
2. Load `System.Speech` and choose an installed English voice, preferring `Microsoft Mark`, then `Microsoft David`, then the first available voice.
3. Render “Bullseye!”, “Bust!”, and “Game shot!” at high volume and an energetic positive rate into temporary PCM WAV files.
4. Invoke `python tools/render-dart-audio.py` with those three temporary inputs and `assets/audio` as the output directory.
5. Delete only the temporary voice directory after successful rendering.
6. Exit nonzero with a clear message if Python, `System.Speech`, or a usable voice is unavailable.

**Step 4: Implement the deterministic Python renderer**

Use only Python’s standard library (`wave`, `math`, `random`, `struct`, and `pathlib`) at 44,100 Hz mono. Seed randomness for reproducible noise layers. Implement reusable DSP helpers for envelopes, sine/triangle/square oscillators, filtered noise, pitch sweeps, mixing, delay, soft clipping, peak normalization, and WAV read/write.

Render the set with these recipes:

- `hit-single`: short filtered-noise impact + 880 Hz confirmation chirp.
- `hit-double`: stronger impact + rising 660/990 Hz two-note accent.
- `hit-triple`: sharp impact + 660/880/1320 Hz arpeggio with a short stereo-like delay collapsed safely to mono.
- `outer-bull`: low body thump + metallic transient + 440-to-880 Hz rise.
- `bullseye`: premium impact + C-major rising flourish + processed “Bullseye!” voice.
- `bust`: muted impact + descending dissonant sweep + processed “Bust!” voice.
- `checkout`: strongest impact + celebratory C-major fanfare + processed “Game shot!” voice.
- `turn-change`: restrained two-note handoff cue.

Voice processing must remove leading/trailing silence, add light slapback, high-pass rumble, normalize speech, and place it after the identifying musical transient. Master each final mix to a peak no higher than -1 dBFS and apply 5 ms boundary fades.

**Step 5: Render the assets**

Run: `powershell -ExecutionPolicy Bypass -File tools/generate-dart-audio.ps1`

Expected: eight WAV files are written under `assets/audio` with a summary of durations and sizes.

**Step 6: Run the asset tests**

Run: `node --test tests/audio-assets.test.js`

Expected: all tests PASS.

**Step 7: Audition and tune**

Play all eight WAV files in order. Adjust synthesis levels, voice timing, envelopes, and normalization only in the generator scripts; regenerate rather than editing binary assets manually. Confirm that normal hits remain compact, major callouts are intelligible, and no file clips or clicks.

**Step 8: Commit**

```bash
git add tools/generate-dart-audio.ps1 tools/render-dart-audio.py tests/audio-assets.test.js assets/audio
git commit -m "feat(audio): add original electronic dartboard sound pack"
```

### Task 4: Add accessible audio controls

**Files:**
- Modify: `index.html:34-45`
- Modify: `styles.css:100-130`
- Modify: `styles.css:1180-1195`

**Step 1: Add the controls to the game header**

Before Undo, add a compact audio group containing:

```html
<button
  id="sound-toggle"
  type="button"
  class="ghost-button sound-toggle"
  aria-pressed="false"
  aria-label="Mute sound"
>
  Sound on
</button>
<label class="volume-control" for="sound-volume">
  <span>Volume</span>
  <input id="sound-volume" type="range" min="0" max="1" step="0.05" value="0.8" />
</label>
```

**Step 2: Style the controls**

Keep the group visually subordinate to scoring, provide a visible `:focus-visible` state, and ensure the range input has a usable touch target. In the existing 680 px media query, keep the mute button visible and collapse the volume label text while preserving its accessible name.

**Step 3: Validate the markup manually**

Open `index.html` at desktop and mobile widths. Confirm keyboard focus order, readable button state, no header overflow, and a minimum practical touch target.

**Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat(audio): add persistent sound controls"
```

### Task 5: Integrate playback with accepted game actions

**Files:**
- Modify: `index.html:145-150`
- Modify: `app.js:338-980`
- Test: `tests/scoring.test.js`

**Step 1: Load the manager before the application**

Add `<script src="sound-manager.js"></script>` immediately before `app.js`.

**Step 2: Initialize audio safely**

Create the manager during `init()` from `window.DartAudio`, call `load()` without blocking render, read its saved settings into the controls, and register a one-time `pointerdown`/`keydown` unlock path. If the module or Web Audio is unavailable, keep the controls disabled and let the game continue.

**Step 3: Connect settings controls**

The mute button calls `setMuted`, updates `aria-pressed`, accessible label, and visible text. The slider calls `setVolume`; moving it above zero may unmute only if that behavior is made explicit in the UI. Render settings from the manager as the single source of truth.

**Step 4: Play scoring events after accepted transitions**

In `handleBoardAction`, call `soundEventForDart(hit, next)` only after `applyDartHit` succeeds, then play the returned event. Bust and checkout therefore override the physical bed. Do not play from `render()`, storage restoration, invalid actions, or undo.

For manual scoring, play only `bust` or `checkout`; ordinary manually entered totals do not pretend that a particular board bed was struck.

**Step 5: Play turn handoff at the actual handoff moment**

When the handoff timer completes and `pulseTurn(true)` runs, play `turnChange`. Suppress it after the final checkout when the match is complete.

**Step 6: Run automated tests**

Run: `node --test tests/*.test.js`

Expected: all tests PASS.

**Step 7: Perform browser interaction checks**

Verify click and keyboard scoring for every bed, three-dart handoff, bust, bullseye, checkout, manual bust/checkout, rapid clicks, mute, volume, reload persistence, undo silence, restored-game silence, and continued scoring with one asset temporarily renamed.

**Step 8: Commit**

```bash
git add app.js index.html tests/scoring.test.js
git commit -m "feat(audio): connect dart events to sound playback"
```

### Task 6: Final verification and documentation

**Files:**
- Modify if needed: `docs/plans/2026-07-15-electronic-dartboard-audio-design.md`

**Step 1: Run the complete automated suite**

Run: `node --test tests/*.test.js`

Expected: all tests PASS with zero failures.

**Step 2: Regenerate and compare assets**

Run: `powershell -ExecutionPolicy Bypass -File tools/generate-dart-audio.ps1`

Expected: generation succeeds and `git status --short` shows no binary changes, proving deterministic output.

**Step 3: Inspect repository state**

Run: `git status --short`

Expected: clean working tree. If regeneration changes assets, fix generator nondeterminism and repeat Tasks 3 and 6.

**Step 4: Complete the manual quality pass**

Test one full two-player match on desktop and a mobile viewport. Confirm instant response, clear event hierarchy, intelligible energetic callouts, comfortable repeated-hit loudness, saved settings, accessible controls, and silent fault recovery.

**Step 5: Commit any verification-driven adjustments**

```bash
git add app.js sound-manager.js index.html styles.css tools tests assets/audio docs/plans/2026-07-15-electronic-dartboard-audio-design.md
git commit -m "fix(audio): polish dartboard playback and mixing"
```

Skip this commit if verification required no changes.
