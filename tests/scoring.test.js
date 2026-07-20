const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createGame,
  applyDartHit,
  applyManualScore,
  audioControlPresentation,
  boardEffectClass,
  comicCalloutForArea,
  dartLabel,
  defaultPlayerName,
  formatPlace,
  handoffTimingFor,
  liveRemaining,
  manualSoundEventForGame,
  normalizeLoadedGame,
  shouldKeepManualScoreFocus,
  shouldPlayTurnChange,
  soundEventForDart,
  turnAnnouncementFor,
  turnHandoffFor,
  undo,
} = require("../app.js");

test("keeps keyboard score focus only for active desktop games", () => {
  const playingGame = { status: "playing" };

  assert.equal(shouldKeepManualScoreFocus(true, playingGame, null), true);
  assert.equal(shouldKeepManualScoreFocus(false, playingGame, null), false);
  assert.equal(shouldKeepManualScoreFocus(true, playingGame, { player: "Noob 1" }), false);
  assert.equal(shouldKeepManualScoreFocus(true, { status: "complete" }, null), false);
});

test("maps accepted dart transitions to semantic sound events", () => {
  assert.equal(soundEventForDart({ area: "single" }, { lastEvent: "single" }), "single");
  assert.equal(soundEventForDart({ area: "double" }, { lastEvent: "double" }), "double");
  assert.equal(soundEventForDart({ area: "triple" }, { lastEvent: "triple" }), "triple");
  assert.equal(soundEventForDart({ area: "outerBull" }, { lastEvent: "outerBull" }), "outerBull");
  assert.equal(soundEventForDart({ area: "bullseye" }, { lastEvent: "bullseye" }), "bullseye");
  assert.equal(soundEventForDart({ area: "triple" }, { lastEvent: "bust" }), "bust");
  assert.equal(soundEventForDart({ area: "double" }, { lastEvent: "checkout" }), "checkout");
});

test("presents missed darts without scoring feedback", () => {
  const miss = { area: "miss", value: 0, score: 0 };

  assert.equal(dartLabel(miss), "MISS");
  assert.equal(soundEventForDart(miss, { lastEvent: "miss" }), null);
  assert.equal(boardEffectClass("miss"), null);
  assert.equal(comicCalloutForArea("miss"), null);
});

test("maps only terminal manual scores to sound events", () => {
  assert.equal(manualSoundEventForGame({ lastEvent: "bust" }), "bust");
  assert.equal(manualSoundEventForGame({ lastEvent: "checkout" }), "checkout");
  assert.equal(manualSoundEventForGame({ lastEvent: "score" }), null);
  assert.equal(manualSoundEventForGame(null), null);
});

test("plays turn handoff audio only while the match continues", () => {
  assert.equal(shouldPlayTurnChange({ status: "playing" }), true);
  assert.equal(shouldPlayTurnChange({ status: "complete" }), false);
  assert.equal(shouldPlayTurnChange(null), false);
});

test("presents saved audio settings accessibly", () => {
  assert.deepEqual(audioControlPresentation({ muted: false, volume: 0.8 }), {
    ariaPressed: "false",
    label: "Mute sound",
    text: "Sound on",
    volume: "0.8",
  });
  assert.deepEqual(audioControlPresentation({ muted: true, volume: 0.35 }), {
    ariaPressed: "true",
    label: "Unmute sound",
    text: "Sound off",
    volume: "0.35",
  });
});

function setCurrentScore(game, score) {
  game.players[game.currentPlayerIndex].score = score;
  game.currentTurn.startScore = score;
}

test("creates playful default player names", () => {
  assert.equal(defaultPlayerName(0), "Noob 1");
  assert.equal(defaultPlayerName(1), "Noob 2");
  assert.equal(defaultPlayerName(4), "Noob 5");
});

test("formats finishing positions as ordinals", () => {
  assert.equal(formatPlace(1), "1st");
  assert.equal(formatPlace(2), "2nd");
  assert.equal(formatPlace(3), "3rd");
  assert.equal(formatPlace(4), "4th");
  assert.equal(formatPlace(11), "11th");
  assert.equal(formatPlace(12), "12th");
  assert.equal(formatPlace(13), "13th");
  assert.equal(formatPlace(21), "21st");
});

test("maps special dart beds to comic callouts", () => {
  assert.equal(comicCalloutForArea("double"), "DOUBLE!");
  assert.equal(comicCalloutForArea("triple"), "TRIPLE!");
  assert.equal(comicCalloutForArea("outerBull"), "BULL!");
  assert.equal(comicCalloutForArea("bullseye"), "BULLSEYE!");
  assert.equal(comicCalloutForArea("bust"), "BUSTED!");
  assert.equal(comicCalloutForArea("single"), null);
});

test("restarts board animation only for visible board effects", () => {
  assert.equal(boardEffectClass("double"), "hit-double");
  assert.equal(boardEffectClass("triple"), "hit-triple");
  assert.equal(boardEffectClass("outerBull"), "hit-outerBull");
  assert.equal(boardEffectClass("bullseye"), "hit-bullseye");
  assert.equal(boardEffectClass("bust"), "hit-bust");
  assert.equal(boardEffectClass("checkout"), "hit-checkout");
  assert.equal(boardEffectClass("single"), null);
  assert.equal(boardEffectClass("score"), null);
  assert.equal(boardEffectClass(null), null);
});

test("formats incoming player names for the turn announcement", () => {
  assert.deepEqual(turnAnnouncementFor("Ada"), {
    player: "ADA",
    suffix: "'S TURN!",
  });
  assert.deepEqual(turnAnnouncementFor("James"), {
    player: "JAMES",
    suffix: "' TURN!",
  });
  assert.equal(turnAnnouncementFor("  "), null);
});

test("sequences incoming players after special comic effects", () => {
  assert.deepEqual(handoffTimingFor("single"), {
    announcementDelay: 0,
    handoffDuration: 1000,
  });
  assert.deepEqual(handoffTimingFor("triple"), {
    announcementDelay: 900,
    handoffDuration: 1800,
  });
  assert.deepEqual(handoffTimingFor("bust"), {
    announcementDelay: 900,
    handoffDuration: 1800,
  });
});

test("creates a 301 game with named players and selected out mode", () => {
  const game = createGame(["Kelvin", "Ada"], "double");

  assert.equal(game.startingScore, 301);
  assert.equal(game.outMode, "double");
  assert.equal(game.players[0].name, "Kelvin");
  assert.equal(game.players[0].score, 301);
  assert.equal(game.players[1].score, 301);
  assert.equal(game.currentPlayerIndex, 0);
  assert.deepEqual(game.finishOrder, []);
  assert.equal(game.status, "playing");
});

test("projects the remaining score after every dart in a visit", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");

  game = applyDartHit(game, { area: "triple", value: 20 });
  assert.equal(liveRemaining(game), 241);
  assert.equal(game.players[0].score, 301);

  game = applyDartHit(game, { area: "single", value: 20 });
  assert.equal(liveRemaining(game), 221);
  assert.equal(game.players[0].score, 301);
});

test("records a miss as one zero-point dart", () => {
  const game = applyDartHit(createGame(["Kelvin", "Ada"], "straight"), {
    area: "miss",
    value: 0,
  });

  assert.equal(game.players[0].score, 301);
  assert.equal(liveRemaining(game), 301);
  assert.equal(game.currentTurn.total, 0);
  assert.deepEqual(game.currentTurn.darts, [
    { area: "miss", value: 0, score: 0 },
  ]);
  assert.equal(game.lastEvent, "miss");
});

test("completes a zero-point visit after three misses", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");

  game = applyDartHit(game, { area: "miss", value: 0 });
  game = applyDartHit(game, { area: "miss", value: 0 });
  game = applyDartHit(game, { area: "miss", value: 0 });

  assert.equal(game.players[0].score, 301);
  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.history[0].total, 0);
  assert.deepEqual(game.history[0].darts, [
    { area: "miss", value: 0, score: 0 },
    { area: "miss", value: 0, score: 0 },
    { area: "miss", value: 0, score: 0 },
  ]);
});

test("creates no handoff until a dartboard visit is complete", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  let previous = game;
  game = applyDartHit(game, { area: "triple", value: 20 });
  assert.equal(turnHandoffFor(previous, game), null);

  previous = game;
  game = applyDartHit(game, { area: "single", value: 20 });
  assert.equal(turnHandoffFor(previous, game), null);
});

test("creates a handoff from a completed three-dart visit", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  game = applyDartHit(game, { area: "triple", value: 20 });
  game = applyDartHit(game, { area: "single", value: 20 });
  const previous = game;

  game = applyDartHit(game, { area: "double", value: 10 });
  const handoff = turnHandoffFor(previous, game);

  assert.equal(handoff.player, "Kelvin");
  assert.equal(handoff.playerIndex, 0);
  assert.equal(handoff.scoreAfter, 201);
  assert.equal(handoff.total, 100);
  assert.equal(handoff.darts.length, 3);
  assert.equal(handoff.result, "score");
});

test("creates a handoff from a keyboard total", () => {
  const previous = createGame(["Kelvin", "Ada"], "straight");
  const game = applyManualScore(previous, 60);
  const handoff = turnHandoffFor(previous, game);

  assert.equal(handoff.input, "manual");
  assert.equal(handoff.total, 60);
  assert.equal(handoff.scoreAfter, 241);
});

test("creates a handoff that preserves a restored bust score", () => {
  const previous = createGame(["Kelvin", "Ada"], "straight");
  setCurrentScore(previous, 10);
  const game = applyManualScore(previous, 12);
  const handoff = turnHandoffFor(previous, game);

  assert.equal(handoff.result, "bust");
  assert.equal(handoff.total, 12);
  assert.equal(handoff.scoreAfter, 10);
});

test("creates a handoff with checkout position", () => {
  const previous = createGame(["Kelvin", "Ada"], "straight");
  setCurrentScore(previous, 20);
  const game = applyDartHit(previous, { area: "single", value: 20 });
  const handoff = turnHandoffFor(previous, game);

  assert.equal(handoff.result, "win");
  assert.equal(handoff.scoreAfter, 0);
  assert.equal(handoff.meta.place, 1);
});

test("records three dartboard hits as one completed visit and advances turn", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");

  game = applyDartHit(game, { area: "triple", value: 20 });
  game = applyDartHit(game, { area: "single", value: 20 });
  game = applyDartHit(game, { area: "double", value: 10 });

  assert.equal(game.players[0].score, 201);
  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.currentTurn.darts.length, 0);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].total, 100);
});

test("straight-out checkout records first place and continues the match", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  setCurrentScore(game, 60);

  game = applyDartHit(game, { area: "triple", value: 20 });

  assert.equal(game.status, "playing");
  assert.equal(game.winner, "Kelvin");
  assert.equal(game.players[0].score, 0);
  assert.deepEqual(game.finishOrder, [0]);
  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.history[0].meta.place, 1);
});

test("double out wins only when the exact-zero final dart is double or bullseye", () => {
  let game = createGame(["Kelvin", "Ada"], "double");
  setCurrentScore(game, 40);

  game = applyDartHit(game, { area: "single", value: 20 });
  game = applyDartHit(game, { area: "single", value: 20 });

  assert.equal(game.status, "playing");
  assert.equal(game.players[0].score, 40);
  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.history[0].result, "bust");

  game = createGame(["Kelvin", "Ada"], "double");
  setCurrentScore(game, 40);
  game = applyDartHit(game, { area: "double", value: 20 });

  assert.equal(game.status, "playing");
  assert.equal(game.winner, "Kelvin");
  assert.deepEqual(game.finishOrder, [0]);
});

test("bullseye is a valid double-out finish", () => {
  let game = createGame(["Kelvin", "Ada"], "double");
  setCurrentScore(game, 50);

  game = applyDartHit(game, { area: "bullseye", value: 50 });

  assert.equal(game.status, "playing");
  assert.equal(game.players[0].score, 0);
  assert.deepEqual(game.finishOrder, [0]);
});

test("manual double-out exact-zero score requires finish confirmation", () => {
  let game = createGame(["Kelvin", "Ada"], "double");
  setCurrentScore(game, 40);

  game = applyManualScore(game, 40);

  assert.equal(game.status, "playing");
  assert.equal(game.players[0].score, 40);
  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.history[0].result, "bust");

  game = createGame(["Kelvin", "Ada"], "double");
  setCurrentScore(game, 40);
  game = applyManualScore(game, 40, { confirmDoubleOut: true });

  assert.equal(game.status, "playing");
  assert.equal(game.players[0].score, 0);
  assert.deepEqual(game.finishOrder, [0]);
});

test("turn rotation skips players who already checked out", () => {
  let game = createGame(["Kelvin", "Ada", "Lin"], "straight");
  setCurrentScore(game, 20);

  game = applyDartHit(game, { area: "single", value: 20 });
  assert.equal(game.currentPlayerIndex, 1);

  game = applyManualScore(game, 0);
  assert.equal(game.currentPlayerIndex, 2);

  game = applyManualScore(game, 0);
  assert.equal(game.currentPlayerIndex, 1);
  assert.deepEqual(game.finishOrder, [0]);
});

test("match completes only after every player checks out", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  setCurrentScore(game, 20);
  game = applyDartHit(game, { area: "single", value: 20 });

  setCurrentScore(game, 20);
  game = applyDartHit(game, { area: "single", value: 20 });

  assert.equal(game.status, "complete");
  assert.equal(game.winner, "Kelvin");
  assert.deepEqual(game.finishOrder, [0, 1]);
  assert.equal(game.players[0].score, 0);
  assert.equal(game.players[1].score, 0);
  assert.equal(game.history[0].meta.place, 2);
});

test("undo restores player eligibility after a checkout", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  setCurrentScore(game, 20);
  game = applyDartHit(game, { area: "single", value: 20 });

  const restored = undo(game);

  assert.equal(restored.status, "playing");
  assert.equal(restored.players[0].score, 20);
  assert.equal(restored.currentPlayerIndex, 0);
  assert.deepEqual(restored.finishOrder, []);
});

test("scores below zero bust and restore the turn-start score", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  setCurrentScore(game, 10);

  game = applyManualScore(game, 12);

  assert.equal(game.players[0].score, 10);
  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.history[0].result, "bust");
});

test("double-out turns that leave one point bust", () => {
  let game = createGame(["Kelvin", "Ada"], "double");
  setCurrentScore(game, 41);

  game = applyManualScore(game, 40);

  assert.equal(game.players[0].score, 41);
  assert.equal(game.currentPlayerIndex, 1);
  assert.equal(game.history[0].result, "bust");
});

test("undo restores the previous game state", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");
  game = applyManualScore(game, 60);

  const restored = undo(game);

  assert.equal(restored.players[0].score, 301);
  assert.equal(restored.currentPlayerIndex, 0);
  assert.equal(restored.history.length, 0);
});

test("retains six undo actions for a two-player game", () => {
  let game = createGame(["Kelvin", "Ada"], "straight");

  for (let index = 0; index < 7; index += 1) {
    game = applyDartHit(game, { area: "miss", value: 0 });
  }

  assert.equal(game.snapshots.length, 6);
  assert.ok(game.snapshots.every((snapshot) => snapshot.snapshots.length === 0));

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

test("normalizes legacy winner saves as completed matches", () => {
  const legacy = createGame(["Kelvin", "Ada"], "straight");
  delete legacy.finishOrder;
  legacy.players[1].score = 0;
  legacy.status = "won";
  legacy.winner = "Ada";

  const normalized = normalizeLoadedGame(legacy);

  assert.equal(normalized.status, "complete");
  assert.deepEqual(normalized.finishOrder, [1]);
  assert.equal(legacy.finishOrder, undefined);
});

test("adds finish order to legacy games still in progress", () => {
  const legacy = createGame(["Kelvin", "Ada"], "straight");
  delete legacy.finishOrder;

  const normalized = normalizeLoadedGame(legacy);

  assert.equal(normalized.status, "playing");
  assert.deepEqual(normalized.finishOrder, []);
});
