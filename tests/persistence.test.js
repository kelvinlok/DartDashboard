const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  GAME_SCHEMA_VERSION,
  STORAGE_KEY,
  applyDartHit,
  createGame,
  getSafeStorage,
  loadSavedGame,
  saveSavedGame,
  validateGameState,
} = require("../app.js");

function makeStorage(raw = null, options = {}) {
  const values = new Map();
  if (raw !== null) values.set(STORAGE_KEY, raw);

  return {
    removed: [],
    writes: [],
    getItem(key) {
      if (options.throwOnGet) throw new Error("storage read blocked");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.throwOnSet) throw new Error("storage quota full");
      values.set(key, value);
      this.writes.push([key, value]);
    },
    removeItem(key) {
      if (options.throwOnRemove) throw new Error("storage removal blocked");
      values.delete(key);
      this.removed.push(key);
    },
  };
}

function validSavedGame() {
  return createGame(["Kelvin", "Ada"], "straight");
}

test("resolves localStorage without allowing a throwing getter to escape", () => {
  const storage = makeStorage();
  const blockedHost = {};
  Object.defineProperty(blockedHost, "localStorage", {
    get() {
      throw new Error("storage disabled");
    },
  });

  assert.equal(getSafeStorage({ localStorage: storage }), storage);
  assert.equal(getSafeStorage(blockedHost), null);
  assert.equal(getSafeStorage({}), null);
});

test("reports failed game writes without throwing or mutating the candidate state", () => {
  const game = validSavedGame();
  const before = structuredClone(game);
  const storage = makeStorage(null, { throwOnSet: true });

  assert.deepEqual(saveSavedGame(storage, game), {
    ok: false,
    reason: "write-failed",
  });
  assert.deepEqual(game, before);
  assert.deepEqual(saveSavedGame(null, game), {
    ok: false,
    reason: "unavailable",
  });
});

test("loads a current valid save and exposes its schema version", () => {
  const game = validSavedGame();
  const storage = makeStorage(JSON.stringify(game));
  const loaded = loadSavedGame(storage);

  assert.equal(GAME_SCHEMA_VERSION, 1);
  assert.equal(loaded.warning, null);
  assert.equal(loaded.persistenceAvailable, true);
  assert.deepEqual(loaded.game, game);
  assert.equal(validateGameState(loaded.game), true);
});

test("migrates an unversioned game and its undo snapshots, then persists version 1", () => {
  let legacy = validSavedGame();
  legacy = applyDartHit(legacy, { area: "single", value: 20 });
  delete legacy.schemaVersion;
  legacy.snapshots.forEach((snapshot) => delete snapshot.schemaVersion);
  const storage = makeStorage(JSON.stringify(legacy));

  const loaded = loadSavedGame(storage);

  assert.equal(loaded.game.schemaVersion, 1);
  assert.ok(loaded.game.snapshots.every((snapshot) => snapshot.schemaVersion === 1));
  assert.equal(validateGameState(loaded.game), true);
  assert.equal(JSON.parse(storage.writes.at(-1)[1]).schemaVersion, 1);
});

test("migrates the supported unversioned winner shape", () => {
  const legacy = validSavedGame();
  delete legacy.schemaVersion;
  delete legacy.finishOrder;
  legacy.players[1].score = 0;
  legacy.status = "won";
  legacy.winner = "Ada";
  const storage = makeStorage(JSON.stringify(legacy));

  const loaded = loadSavedGame(storage);

  assert.equal(loaded.game.schemaVersion, 1);
  assert.equal(loaded.game.status, "complete");
  assert.deepEqual(loaded.game.finishOrder, [1]);
  assert.equal(validateGameState(loaded.game), true);
});

test("removes invalid JSON and returns a visible recovery message", () => {
  const storage = makeStorage("not-json");
  const loaded = loadSavedGame(storage);

  assert.equal(loaded.game, null);
  assert.match(loaded.warning, /could not be recovered.*removed/i);
  assert.deepEqual(storage.removed, [STORAGE_KEY]);
});

test("rejects unsupported schema versions and invalid nested game invariants", () => {
  const invalidGames = [];

  const unsupported = validSavedGame();
  unsupported.schemaVersion = 99;
  invalidGames.push(unsupported);

  const noPlayers = validSavedGame();
  noPlayers.players = [];
  invalidGames.push(noPlayers);

  const invalidScore = validSavedGame();
  invalidScore.players[0].score = -1;
  invalidGames.push(invalidScore);

  const invalidPlayerIndex = validSavedGame();
  invalidPlayerIndex.currentPlayerIndex = 20;
  invalidGames.push(invalidPlayerIndex);

  const missingTurn = validSavedGame();
  delete missingTurn.currentTurn;
  invalidGames.push(missingTurn);

  const inconsistentTurn = validSavedGame();
  inconsistentTurn.currentTurn.total = 20;
  invalidGames.push(inconsistentTurn);

  const inconsistentFinishOrder = validSavedGame();
  inconsistentFinishOrder.finishOrder = [0];
  invalidGames.push(inconsistentFinishOrder);

  const invalidHistory = validSavedGame();
  invalidHistory.history = [{ result: "score" }];
  invalidGames.push(invalidHistory);

  const invalidSnapshot = validSavedGame();
  invalidSnapshot.snapshots = [{ status: "playing" }];
  invalidGames.push(invalidSnapshot);

  for (const invalid of invalidGames) {
    const storage = makeStorage(JSON.stringify(invalid));
    const loaded = loadSavedGame(storage);

    assert.equal(loaded.game, null);
    assert.match(loaded.warning, /could not be recovered.*removed/i);
    assert.deepEqual(storage.removed, [STORAGE_KEY]);
    assert.equal(validateGameState(invalid), false);
  }
});

test("storage read failures recover to setup with a persistent warning", () => {
  const loaded = loadSavedGame(makeStorage(null, { throwOnGet: true }));

  assert.equal(loaded.game, null);
  assert.equal(loaded.persistenceAvailable, false);
  assert.match(loaded.warning, /recovery is unavailable.*keep this page open/i);
});

test("recovery messages have a live container and are rendered through textContent", () => {
  const repositoryRoot = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(repositoryRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(repositoryRoot, "app.js"), "utf8");

  assert.match(
    html,
    /<p[^>]*id="recovery-warning"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden[^>]*><\/p>/,
  );
  assert.match(app, /els\.recoveryWarning\.textContent\s*=/);
});
