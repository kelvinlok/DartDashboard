(function attachDartDashboard(root) {
  const STARTING_SCORE = 301;
  const GAME_SCHEMA_VERSION = 1;
  const STORAGE_KEY = "dart-dashboard-game";
  const PLAYER_NAMES_STORAGE_KEY = "dart-dashboard-player-names";
  const PERSISTENCE_WARNING =
    "Match recovery is unavailable. Changes will stay on this page only; keep this page open.";
  const INVALID_SAVE_WARNING =
    "The saved match could not be recovered and was removed. Start a new game.";
  const COMIC_DURATION = 900;
  const HANDOFF_DURATION = 1000;
  const BOARD_NUMBERS = [
    20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
  ];

  function defaultPlayerName(index) {
    return `Noob ${index + 1}`;
  }

  function normalizePlayerNames(playerNames) {
    if (!Array.isArray(playerNames)) return null;
    const names = playerNames
      .map((name) => String(name).trim())
      .filter(Boolean);
    return names.length >= 2 ? names : null;
  }

  function savePlayerNames(storage, playerNames) {
    const names = normalizePlayerNames(playerNames);
    if (!storage || !names) return false;
    try {
      storage.setItem(PLAYER_NAMES_STORAGE_KEY, JSON.stringify(names));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadPlayerNames(storage) {
    if (!storage) return null;
    try {
      const raw = storage.getItem(PLAYER_NAMES_STORAGE_KEY);
      if (!raw) return null;
      const names = normalizePlayerNames(JSON.parse(raw));
      if (names) return names;
      storage.removeItem(PLAYER_NAMES_STORAGE_KEY);
    } catch (error) {
      try {
        storage.removeItem(PLAYER_NAMES_STORAGE_KEY);
      } catch (removeError) {
        // Storage may be unavailable; defaults remain usable.
      }
    }
    return null;
  }

  function formatPlace(place) {
    const remainder = place % 100;
    if (remainder >= 11 && remainder <= 13) return `${place}th`;
    if (place % 10 === 1) return `${place}st`;
    if (place % 10 === 2) return `${place}nd`;
    if (place % 10 === 3) return `${place}rd`;
    return `${place}th`;
  }

  function comicCalloutForArea(area) {
    return {
      double: "DOUBLE!",
      triple: "TRIPLE!",
      outerBull: "BULL!",
      bullseye: "BULLSEYE!",
      bust: "BUSTED!",
    }[area] || null;
  }

  function boardEffectClass(area) {
    return ["double", "triple", "outerBull", "bullseye", "bust", "checkout"].includes(area)
      ? `hit-${area}`
      : null;
  }

  function soundEventForDart(hit, nextGame) {
    if (nextGame?.lastEvent === "bust") return "bust";
    if (nextGame?.lastEvent === "checkout") return "checkout";
    return ["single", "double", "triple", "outerBull", "bullseye"].includes(hit?.area)
      ? hit.area
      : null;
  }

  function manualSoundEventForGame(game) {
    return ["bust", "checkout"].includes(game?.lastEvent) ? game.lastEvent : null;
  }

  function shouldPlayTurnChange(game) {
    return game?.status === "playing";
  }

  function shouldKeepManualScoreFocus(isDesktop, game, handoff) {
    return Boolean(isDesktop && game?.status === "playing" && !handoff);
  }

  function audioControlPresentation(settings) {
    const muted = Boolean(settings?.muted);
    return {
      ariaPressed: String(muted),
      label: muted ? "Unmute sound" : "Mute sound",
      text: muted ? "Sound off" : "Sound on",
      volume: String(settings?.volume ?? 0.8),
    };
  }

  function turnAnnouncementFor(name) {
    const player = String(name || "").trim();
    if (!player) return null;
    return {
      player: player.toUpperCase(),
      suffix: player.toLowerCase().endsWith("s") ? "' TURN!" : "'S TURN!",
    };
  }

  function handoffTimingFor(area) {
    const announcementDelay = comicCalloutForArea(area) ? COMIC_DURATION : 0;
    return {
      announcementDelay,
      handoffDuration: announcementDelay ? COMIC_DURATION * 2 : HANDOFF_DURATION,
    };
  }

  function liveRemaining(game) {
    if (!game || !game.currentTurn) return 0;
    return Math.max(0, game.currentTurn.startScore - game.currentTurn.total);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createGame(playerNames, outMode) {
    const names = playerNames
      .map((name) => String(name).trim())
      .filter(Boolean);

    if (names.length < 2) {
      throw new Error("At least two players are required.");
    }

    if (!["straight", "double"].includes(outMode)) {
      throw new Error("Out mode must be straight or double.");
    }

    return {
      schemaVersion: GAME_SCHEMA_VERSION,
      startingScore: STARTING_SCORE,
      outMode,
      players: names.map((name) => ({ name, score: STARTING_SCORE })),
      currentPlayerIndex: 0,
      currentTurn: {
        startScore: STARTING_SCORE,
        darts: [],
        total: 0,
      },
      history: [],
      finishOrder: [],
      snapshots: [],
      status: "playing",
      winner: null,
      lastEvent: null,
      createdAt: new Date().toISOString(),
    };
  }

  function currentPlayer(game) {
    return game.players[game.currentPlayerIndex];
  }

  function undoHistoryLimit(game) {
    return Array.isArray(game?.players) ? game.players.length * 3 : 0;
  }

  function flatSnapshot(game) {
    const { snapshots: _snapshots, ...state } = game;
    return { ...clone(state), snapshots: [] };
  }

  function pushSnapshot(game) {
    const limit = undoHistoryLimit(game);
    const snapshots = Array.isArray(game.snapshots)
      ? [...game.snapshots]
      : [];
    snapshots.push(flatSnapshot(game));
    game.snapshots = limit > 0 ? snapshots.slice(-limit) : [];
  }

  function isDoubleFinish(hit) {
    return hit && (hit.area === "double" || hit.area === "bullseye");
  }

  function scoreForHit(hit) {
    if (!hit || hit.area === "miss") return 0;
    if (hit.area === "outerBull") return 25;
    if (hit.area === "bullseye") return 50;
    const value = Number(hit.value) || 0;
    if (hit.area === "double") return value * 2;
    if (hit.area === "triple") return value * 3;
    return value;
  }

  function makeTurn(game, result, total, scoreAfter, input, meta) {
    return {
      player: currentPlayer(game).name,
      playerIndex: game.currentPlayerIndex,
      startScore: game.currentTurn.startScore,
      scoreAfter,
      total,
      result,
      input,
      darts: clone(game.currentTurn.darts),
      meta: meta || {},
      at: new Date().toISOString(),
    };
  }

  function advanceTurn(game) {
    const finished = game.finishOrder || [];
    for (let offset = 1; offset <= game.players.length; offset += 1) {
      const candidate = (game.currentPlayerIndex + offset) % game.players.length;
      if (!finished.includes(candidate)) {
        game.currentPlayerIndex = candidate;
        break;
      }
    }
    game.currentTurn = {
      startScore: currentPlayer(game).score,
      darts: [],
      total: 0,
    };
  }

  function finishTurn(game, result, scoreAfter, input, meta) {
    const total = game.currentTurn.total;

    if (result === "win") {
      const playerIndex = game.currentPlayerIndex;
      game.finishOrder = game.finishOrder || [];
      if (!game.finishOrder.includes(playerIndex)) {
        game.finishOrder.push(playerIndex);
      }
      const place = game.finishOrder.indexOf(playerIndex) + 1;
      game.history.unshift(
        makeTurn(game, result, total, scoreAfter, input, {
          ...(meta || {}),
          place,
        }),
      );
      currentPlayer(game).score = 0;
      game.winner = game.winner || currentPlayer(game).name;
      game.lastEvent = "checkout";
      if (game.finishOrder.length === game.players.length) {
        game.status = "complete";
      } else {
        game.status = "playing";
        advanceTurn(game);
      }
      return game;
    }

    game.history.unshift(makeTurn(game, result, total, scoreAfter, input, meta));

    if (result === "score") {
      currentPlayer(game).score = scoreAfter;
      game.lastEvent = "score";
    } else {
      currentPlayer(game).score = game.currentTurn.startScore;
      game.lastEvent = "bust";
    }

    advanceTurn(game);
    return game;
  }

  function evaluateTurn(game, latestHit, input, options) {
    const scoreAfter = game.currentTurn.startScore - game.currentTurn.total;
    const exactZero = scoreAfter === 0;
    const belowZero = scoreAfter < 0;
    const doubleDeadEnd = game.outMode === "double" && scoreAfter === 1;
    const confirmedManualDouble =
      input === "manual" && options && options.confirmDoubleOut === true;

    if (belowZero || doubleDeadEnd) {
      return finishTurn(game, "bust", game.currentTurn.startScore, input, {
        reason: belowZero ? "below-zero" : "double-one",
      });
    }

    if (exactZero) {
      if (
        game.outMode === "straight" ||
        isDoubleFinish(latestHit) ||
        confirmedManualDouble
      ) {
        return finishTurn(game, "win", 0, input);
      }

      return finishTurn(game, "bust", game.currentTurn.startScore, input, {
        reason: "double-out-required",
      });
    }

    if (input === "manual" || game.currentTurn.darts.length === 3) {
      return finishTurn(game, "score", scoreAfter, input);
    }

    game.lastEvent = latestHit ? latestHit.area : "score";
    return game;
  }

  function ensurePlayable(game) {
    if (game.status !== "playing") {
      throw new Error("Game is already finished.");
    }
  }

  function applyDartHit(game, hit) {
    ensurePlayable(game);
    const next = clone(game);
    pushSnapshot(next);

    const normalizedHit = {
      area: hit.area,
      value: Number(hit.value) || 0,
      score: scoreForHit(hit),
    };

    next.currentTurn.darts.push(normalizedHit);
    next.currentTurn.total += normalizedHit.score;
    return evaluateTurn(next, normalizedHit, "dartboard");
  }

  function applyManualScore(game, score, options) {
    ensurePlayable(game);
    const amount = Number.parseInt(score, 10);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Manual score must be a non-negative integer.");
    }

    const next = clone(game);
    pushSnapshot(next);
    next.currentTurn.darts = [
      {
        area: "manual",
        value: amount,
        score: amount,
      },
    ];
    next.currentTurn.total = amount;
    return evaluateTurn(next, null, "manual", options || {});
  }

  function undo(game) {
    if (!game.snapshots || game.snapshots.length === 0) return game;
    const snapshots = clone(game.snapshots);
    const previous = snapshots.pop();
    previous.snapshots = snapshots;
    return previous;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isSafeIntegerInRange(value, minimum, maximum) {
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  }

  function isValidDart(dart) {
    if (!isPlainObject(dart)) return false;
    if (!isSafeIntegerInRange(dart.value, 0, Number.MAX_SAFE_INTEGER)) return false;
    if (!isSafeIntegerInRange(dart.score, 0, Number.MAX_SAFE_INTEGER)) return false;

    if (["single", "double", "triple"].includes(dart.area)) {
      return isSafeIntegerInRange(dart.value, 1, 20) && dart.score === scoreForHit(dart);
    }
    if (dart.area === "outerBull") return dart.value === 25 && dart.score === 25;
    if (dart.area === "bullseye") return dart.value === 50 && dart.score === 50;
    if (dart.area === "miss") return dart.value === 0 && dart.score === 0;
    if (dart.area === "manual") return dart.score === dart.value;
    return false;
  }

  function isValidDartList(darts, allowEmpty) {
    if (!Array.isArray(darts)) return false;
    if ((!allowEmpty && darts.length === 0) || darts.length > 3) return false;
    if (!darts.every(isValidDart)) return false;
    const manualDarts = darts.filter((dart) => dart.area === "manual");
    return manualDarts.length === 0 || (darts.length === 1 && manualDarts.length === 1);
  }

  function isValidCurrentTurn(turn) {
    if (!isPlainObject(turn)) return false;
    if (!isSafeIntegerInRange(turn.startScore, 1, STARTING_SCORE)) return false;
    if (!isSafeIntegerInRange(turn.total, 0, Number.MAX_SAFE_INTEGER)) return false;
    if (!isValidDartList(turn.darts, true)) return false;
    return turn.total === turn.darts.reduce((total, dart) => total + dart.score, 0);
  }

  function isValidHistoryTurn(turn, players, outMode) {
    if (!isPlainObject(turn)) return false;
    if (!isSafeIntegerInRange(turn.playerIndex, 0, players.length - 1)) return false;
    if (turn.player !== players[turn.playerIndex].name) return false;
    if (!isSafeIntegerInRange(turn.startScore, 1, STARTING_SCORE)) return false;
    if (!isSafeIntegerInRange(turn.scoreAfter, 0, STARTING_SCORE)) return false;
    if (!isSafeIntegerInRange(turn.total, 0, Number.MAX_SAFE_INTEGER)) return false;
    if (!["score", "bust", "win"].includes(turn.result)) return false;
    if (!["dartboard", "manual"].includes(turn.input)) return false;
    if (!isValidDartList(turn.darts, false)) return false;
    if (!isPlainObject(turn.meta) || typeof turn.at !== "string") return false;
    if (turn.total !== turn.darts.reduce((total, dart) => total + dart.score, 0)) {
      return false;
    }
    if (turn.input === "manual" && turn.darts[0].area !== "manual") return false;
    if (turn.input === "dartboard" && turn.darts.some((dart) => dart.area === "manual")) {
      return false;
    }

    const remaining = turn.startScore - turn.total;
    if (turn.result === "score") {
      return remaining > 0
        && turn.scoreAfter === remaining
        && (outMode !== "double" || remaining !== 1);
    }
    if (turn.result === "bust") {
      return turn.scoreAfter === turn.startScore
        && (remaining < 0 || (outMode === "double" && remaining <= 1));
    }
    if (remaining !== 0 || turn.scoreAfter !== 0) return false;
    if (outMode === "double" && turn.input === "dartboard") {
      return isDoubleFinish(turn.darts.at(-1));
    }
    return true;
  }

  function validateGameState(game, allowSnapshots = true) {
    if (!isPlainObject(game) || game.schemaVersion !== GAME_SCHEMA_VERSION) return false;
    if (game.startingScore !== STARTING_SCORE) return false;
    if (!["straight", "double"].includes(game.outMode)) return false;
    if (!Array.isArray(game.players) || game.players.length < 2) return false;
    if (!game.players.every((player) => (
      isPlainObject(player)
      && typeof player.name === "string"
      && player.name.trim() === player.name
      && player.name.length > 0
      && isSafeIntegerInRange(player.score, 0, STARTING_SCORE)
    ))) return false;
    if (!isSafeIntegerInRange(game.currentPlayerIndex, 0, game.players.length - 1)) {
      return false;
    }
    if (!isValidCurrentTurn(game.currentTurn)) return false;
    if (!Array.isArray(game.history)) return false;
    if (!game.history.every((turn) => isValidHistoryTurn(turn, game.players, game.outMode))) {
      return false;
    }
    if (!Array.isArray(game.finishOrder)) return false;
    if (!game.finishOrder.every((index) => (
      isSafeIntegerInRange(index, 0, game.players.length - 1)
    ))) return false;
    if (new Set(game.finishOrder).size !== game.finishOrder.length) return false;

    const finished = new Set(game.finishOrder);
    if (!game.players.every((player, index) => (player.score === 0) === finished.has(index))) {
      return false;
    }
    if (!["playing", "complete"].includes(game.status)) return false;
    if (game.status === "playing") {
      if (finished.size === game.players.length || finished.has(game.currentPlayerIndex)) return false;
      if (game.currentTurn.startScore !== game.players[game.currentPlayerIndex].score) return false;
      const remaining = game.currentTurn.startScore - game.currentTurn.total;
      if (remaining <= 0 || (game.outMode === "double" && remaining === 1)) return false;
      if (game.currentTurn.darts.length > 2) return false;
    } else if (finished.size === 0) {
      return false;
    }

    if (finished.size === 0) {
      if (game.winner !== null) return false;
    } else if (game.winner !== game.players[game.finishOrder[0]].name) {
      return false;
    }
    if (game.lastEvent !== null && typeof game.lastEvent !== "string") return false;
    if (typeof game.createdAt !== "string") return false;
    if (!Array.isArray(game.snapshots)) return false;
    if (!allowSnapshots) return game.snapshots.length === 0;
    if (game.snapshots.length > undoHistoryLimit(game)) return false;

    return game.snapshots.every((snapshot) => (
      validateGameState(snapshot, false)
      && snapshot.startingScore === game.startingScore
      && snapshot.outMode === game.outMode
      && snapshot.createdAt === game.createdAt
      && snapshot.players.length === game.players.length
      && snapshot.players.every((player, index) => player.name === game.players[index].name)
    ));
  }

  function normalizeStateShape(game) {
    const { snapshots: _snapshots, ...state } = game;
    const normalized = { ...clone(state), schemaVersion: GAME_SCHEMA_VERSION, snapshots: [] };
    if (Array.isArray(normalized.finishOrder)) return normalized;

    normalized.finishOrder = [];
    if (normalized.status === "won") {
      const winnerIndex = normalized.players.findIndex(
        (player) => player.name === normalized.winner,
      );
      const zeroScoreIndex = normalized.players.findIndex((player) => player.score === 0);
      const finishedIndex = winnerIndex !== -1 ? winnerIndex : zeroScoreIndex;
      if (finishedIndex !== -1) normalized.finishOrder.push(finishedIndex);
      normalized.status = "complete";
    }
    return normalized;
  }

  function normalizeLoadedGame(game) {
    const normalized = normalizeStateShape(game);
    const limit = undoHistoryLimit(normalized);
    normalized.snapshots = Array.isArray(game.snapshots) && limit > 0
      ? game.snapshots.slice(-limit).map(normalizeStateShape)
      : [];
    return normalized;
  }

  function migrateSavedGame(game) {
    if (!isPlainObject(game)) return null;
    if (game.schemaVersion === undefined || game.schemaVersion === 0) {
      return { game: normalizeLoadedGame(game), migrated: true };
    }
    if (game.schemaVersion !== GAME_SCHEMA_VERSION) return null;
    return { game: clone(game), migrated: false };
  }

  function getSafeStorage(host) {
    try {
      return host?.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function saveSavedGame(storage, game) {
    if (!storage) return { ok: false, reason: "unavailable" };
    try {
      if (game === null) {
        storage.removeItem(STORAGE_KEY);
      } else {
        if (!validateGameState(game)) return { ok: false, reason: "invalid-game" };
        storage.setItem(STORAGE_KEY, JSON.stringify(game));
      }
      return { ok: true, reason: null };
    } catch (error) {
      return { ok: false, reason: "write-failed" };
    }
  }

  function discardInvalidSave(storage) {
    try {
      storage?.removeItem(STORAGE_KEY);
      return Boolean(storage);
    } catch (error) {
      return false;
    }
  }

  function invalidSaveResult(storage) {
    const removed = discardInvalidSave(storage);
    return {
      game: null,
      warning: removed
        ? INVALID_SAVE_WARNING
        : "The saved match could not be recovered or removed. Match recovery is unavailable; keep this page open.",
      persistenceAvailable: removed,
    };
  }

  function loadSavedGame(storage) {
    if (!storage) {
      return { game: null, warning: PERSISTENCE_WARNING, persistenceAvailable: false };
    }

    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (error) {
      return { game: null, warning: PERSISTENCE_WARNING, persistenceAvailable: false };
    }
    if (!raw) return { game: null, warning: null, persistenceAvailable: true };

    let migration;
    try {
      migration = migrateSavedGame(JSON.parse(raw));
    } catch (error) {
      return invalidSaveResult(storage);
    }
    if (!migration || !validateGameState(migration.game)) return invalidSaveResult(storage);

    if (migration.migrated) {
      const saved = saveSavedGame(storage, migration.game);
      if (!saved.ok) {
        return {
          game: migration.game,
          warning: PERSISTENCE_WARNING,
          persistenceAvailable: false,
        };
      }
    }
    return { game: migration.game, warning: null, persistenceAvailable: true };
  }

  async function registerServiceWorker(navigatorObject) {
    try {
      if (typeof navigatorObject?.serviceWorker?.register !== "function") return false;
      await navigatorObject.serviceWorker.register("service-worker.js");
      return true;
    } catch (error) {
      return false;
    }
  }

  function turnHandoffFor(previousGame, nextGame) {
    if (!previousGame || !nextGame) return null;
    if (nextGame.history.length <= previousGame.history.length) return null;
    return clone(nextGame.history[0]);
  }

  const api = {
    GAME_SCHEMA_VERSION,
    STARTING_SCORE,
    STORAGE_KEY,
    BOARD_NUMBERS,
    createGame,
    applyDartHit,
    applyManualScore,
    audioControlPresentation,
    boardEffectClass,
    comicCalloutForArea,
    dartLabel,
    defaultPlayerName,
    formatPlace,
    getSafeStorage,
    handoffTimingFor,
    liveRemaining,
    loadPlayerNames,
    loadSavedGame,
    manualSoundEventForGame,
    normalizePlayerNames,
    normalizeLoadedGame,
    registerServiceWorker,
    savePlayerNames,
    saveSavedGame,
    shouldKeepManualScoreFocus,
    shouldPlayTurnChange,
    soundEventForDart,
    turnAnnouncementFor,
    turnHandoffFor,
    undo,
    validateGameState,
    scoreForHit,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof window === "undefined") return;

  root.DartDashboard = api;

  const state = {
    game: null,
    storage: null,
    recoveryWarning: null,
    selectedHit: null,
    turnHandoff: null,
    handoffTimer: null,
    soundManager: null,
    setupDrag: null,
  };

  const els = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function playSound(name) {
    if (!name || !state.soundManager) return false;
    try {
      return state.soundManager.play(name);
    } catch (error) {
      return false;
    }
  }

  function renderAudioSettings() {
    if (!state.soundManager) return;
    try {
      const presentation = audioControlPresentation(state.soundManager.getSettings());
      els.soundToggle.setAttribute("aria-pressed", presentation.ariaPressed);
      els.soundToggle.setAttribute("aria-label", presentation.label);
      els.soundToggle.textContent = presentation.text;
      els.soundVolume.value = presentation.volume;
    } catch (error) {
      // Audio settings must never interrupt gameplay.
    }
  }

  function initializeAudio() {
    els.soundToggle.disabled = true;
    els.soundVolume.disabled = true;

    try {
      const SoundManager = root.DartAudio?.SoundManager;
      if (!SoundManager) return;
      const manager = new SoundManager();
      if (!manager.context) return;

      state.soundManager = manager;
      els.soundToggle.disabled = false;
      els.soundVolume.disabled = false;
      renderAudioSettings();
      void manager.load();

      const unlockAudio = () => {
        root.removeEventListener("pointerdown", unlockAudio);
        root.removeEventListener("keydown", unlockAudio);
        void manager.unlock();
      };
      root.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
      root.addEventListener("keydown", unlockAudio, { once: true });
    } catch (error) {
      state.soundManager = null;
    }
  }

  function saveGame() {
    const result = saveSavedGame(state.storage, state.game);
    state.recoveryWarning = result.ok ? null : PERSISTENCE_WARNING;
    return result;
  }

  function loadGame() {
    return loadSavedGame(state.storage);
  }

  function clearTurnHandoff() {
    clearTimeout(state.handoffTimer);
    state.handoffTimer = null;
    state.turnHandoff = null;
    hideTurnAnnouncement();
  }

  function focusManualScore() {
    const isDesktop = root.matchMedia
      ? root.matchMedia("(min-width: 681px)").matches
      : root.innerWidth > 680;

    if (
      !els.manualScore ||
      els.manualScore.disabled ||
      !shouldKeepManualScoreFocus(isDesktop, state.game, state.turnHandoff)
    ) return;

    els.manualScore.focus({ preventScroll: true });
  }

  function scheduleManualScoreFocus() {
    setTimeout(focusManualScore, 0);
  }

  function setGame(game, options) {
    clearTurnHandoff();
    state.game = game;
    state.turnHandoff = options?.handoff || null;
    saveGame();
    render();

    if (state.turnHandoff) {
      state.handoffTimer = setTimeout(() => {
        hideTurnAnnouncement();
        state.turnHandoff = null;
        state.handoffTimer = null;
        render();
        pulseTurn(true);
        if (shouldPlayTurnChange(state.game)) playSound("turnChange");
        focusManualScore();
      }, options?.handoffDuration || HANDOFF_DURATION);
    } else {
      focusManualScore();
    }
  }

  function formatOutMode(mode) {
    return mode === "double" ? "Double out" : "Straight out";
  }

  function createSvgElement(name, attrs) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }

  function polarToCartesian(cx, cy, radius, angle) {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  }

  function describeArc(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
    const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
    const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M",
      outerStart.x,
      outerStart.y,
      "A",
      outerRadius,
      outerRadius,
      0,
      largeArc,
      0,
      outerEnd.x,
      outerEnd.y,
      "L",
      innerStart.x,
      innerStart.y,
      "A",
      innerRadius,
      innerRadius,
      0,
      largeArc,
      1,
      innerEnd.x,
      innerEnd.y,
      "Z",
    ].join(" ");
  }

  function renderDartboard() {
    if (!els.board) return;
    els.board.innerHTML = "";

    const svg = createSvgElement("svg", {
      viewBox: "-24 -24 548 548",
      role: "img",
      "aria-label": "Clickable dartboard",
      class: "dartboard-svg",
    });

    const boardGroup = createSvgElement("g", { class: "board-face" });
    svg.appendChild(boardGroup);

    const center = 250;
    const rings = [
      { area: "double", inner: 210, outer: 236 },
      { area: "singleOuter", inner: 142, outer: 210 },
      { area: "triple", inner: 116, outer: 142 },
      { area: "single", inner: 35, outer: 116 },
    ];

    BOARD_NUMBERS.forEach((number, index) => {
      const start = index * 18 - 9;
      const end = start + 18;
      rings.forEach((ring) => {
        const area = ring.area === "singleOuter" ? "single" : ring.area;
        const path = createSvgElement("path", {
          d: describeArc(center, center, ring.inner, ring.outer, start, end),
          class: `segment ${ring.area} ${index % 2 === 0 ? "even" : "odd"}`,
          tabindex: "0",
          role: "button",
          "aria-label": `${area} ${number}`,
          "data-area": area,
          "data-value": number,
        });
        boardGroup.appendChild(path);
      });

      const labelPos = polarToCartesian(center, center, 254, start + 9);
      const label = createSvgElement("text", {
        x: labelPos.x,
        y: labelPos.y,
        class: "board-number",
        "text-anchor": "middle",
        "dominant-baseline": "middle",
      });
      label.textContent = number;
      svg.appendChild(label);
    });

    const outerBull = createSvgElement("circle", {
      cx: center,
      cy: center,
      r: 34,
      class: "segment outerBull",
      tabindex: "0",
      role: "button",
      "aria-label": "Outer bull 25",
      "data-area": "outerBull",
      "data-value": "25",
    });
    const bullseye = createSvgElement("circle", {
      cx: center,
      cy: center,
      r: 16,
      class: "segment bullseye",
      tabindex: "0",
      role: "button",
      "aria-label": "Bullseye 50",
      "data-area": "bullseye",
      "data-value": "50",
    });

    svg.appendChild(outerBull);
    svg.appendChild(bullseye);
    els.board.appendChild(svg);
  }

  function flashBoard(area) {
    if (!els.board) return;
    const effectClass = boardEffectClass(area);
    els.board.classList.remove(
      "hit-double",
      "hit-triple",
      "hit-outerBull",
      "hit-bullseye",
      "hit-bust",
      "hit-checkout",
    );
    if (!effectClass) return;
    void els.board.offsetWidth;
    els.board.classList.add(effectClass);
  }

  function showComicCallout(area) {
    const word = comicCalloutForArea(area);
    if (!word || !els.comicCallout) return;

    clearTimeout(showComicCallout.timer);
    els.comicCallout.hidden = false;
    els.comicCallout.dataset.effect = area;
    els.comicCalloutWord.textContent = word;
    els.comicCallout.classList.remove("is-active");
    void els.comicCallout.offsetWidth;
    els.comicCallout.classList.add("is-active");

    showComicCallout.timer = setTimeout(() => {
      els.comicCallout.classList.remove("is-active");
      els.comicCallout.hidden = true;
    }, 900);
  }

  function hideComicCallout() {
    clearTimeout(showComicCallout.timer);
    if (!els.comicCallout) return;
    els.comicCallout.classList.remove("is-active");
    els.comicCallout.hidden = true;
  }

  function showTurnAnnouncement(name, delay) {
    const announcement = turnAnnouncementFor(name);
    if (!announcement || !els.turnAnnouncement) return;

    hideTurnAnnouncement();
    const reveal = () => {
      hideComicCallout();
      els.turnPlayer.textContent = announcement.player;
      els.turnSuffix.textContent = announcement.suffix;
      els.turnAnnouncement.classList.toggle("is-long", announcement.player.length > 10);
      els.turnAnnouncement.classList.toggle("is-very-long", announcement.player.length > 18);
      els.turnAnnouncement.hidden = false;
      els.turnAnnouncement.classList.remove("is-active");
      void els.turnAnnouncement.offsetWidth;
      els.turnAnnouncement.classList.add("is-active");
      showTurnAnnouncement.hideTimer = setTimeout(hideTurnAnnouncement, COMIC_DURATION);
    };

    if (delay) {
      showTurnAnnouncement.revealTimer = setTimeout(reveal, delay);
    } else {
      reveal();
    }
  }

  function hideTurnAnnouncement() {
    clearTimeout(showTurnAnnouncement.revealTimer);
    clearTimeout(showTurnAnnouncement.hideTimer);
    if (!els.turnAnnouncement) return;
    els.turnAnnouncement.classList.remove("is-active", "is-long", "is-very-long");
    els.turnAnnouncement.hidden = true;
  }

  function handoffPresentation(game, handoff, effectArea) {
    if (!handoff || game.status !== "playing") return null;
    const announcement = turnAnnouncementFor(currentPlayer(game).name);
    if (!announcement) return null;
    return {
      ...announcement,
      ...handoffTimingFor(effectArea),
    };
  }

  function renderSetupPlayers(preferredNames) {
    const rows = Array.from(els.playerRows.querySelectorAll(".player-row"));
    const names = rows.map((row) => row.querySelector("input").value);
    els.playerRows.innerHTML = "";
    const nextNames = preferredNames?.length
      ? preferredNames
      : names.length
        ? names
        : [defaultPlayerName(0), defaultPlayerName(1)];

    nextNames.forEach((name, index) => addPlayerRow(name || defaultPlayerName(index)));
  }

  function persistSetupPlayerNames() {
    savePlayerNames(
      state.storage,
      setupPlayerRows().map((row) => row.querySelector("input").value),
    );
  }

  function addPlayerRow(value) {
    const row = document.createElement("div");
    row.className = "player-row";
    row.setAttribute("role", "listitem");
    row.innerHTML = `
      <button type="button" class="drag-handle" draggable="true">
        <span aria-hidden="true">⠿</span>
      </button>
      <span class="player-position"></span>
      <input type="text" value="${escapeHtml(value)}" maxlength="18" draggable="false" />
      <button type="button" class="icon-button remove-player" aria-label="Remove player">x</button>
    `;
    els.playerRows.appendChild(row);
    updatePlayerPositions();
  }

  function setupPlayerRows() {
    return Array.from(els.playerRows.querySelectorAll(".player-row"));
  }

  function updatePlayerPositions(announceRow) {
    setupPlayerRows().forEach((row, index) => {
      const position = index + 1;
      row.querySelector(".player-position").textContent = `P${position}`;
      row.querySelector("input").setAttribute("aria-label", `Player ${position} name`);
      row
        .querySelector(".drag-handle")
        .setAttribute("aria-label", `Move player ${position}. Drag, or use arrow keys.`);
    });

    if (!announceRow || !els.playerOrderStatus) return;
    const position = setupPlayerRows().indexOf(announceRow) + 1;
    const name = announceRow.querySelector("input").value.trim() || `Player ${position}`;
    els.playerOrderStatus.textContent = `${name} moved to position ${position}.`;
  }

  function animatePlayerReflow(previousPositions, draggedRow) {
    if (root.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setupPlayerRows().forEach((row) => {
      if (row === draggedRow || typeof row.animate !== "function") return;
      const previousTop = previousPositions.get(row);
      if (previousTop === undefined) return;
      const distance = previousTop - row.getBoundingClientRect().top;
      if (!distance) return;
      row.animate(
        [{ transform: `translateY(${distance}px)` }, { transform: "translateY(0)" }],
        { duration: 170, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    });
  }

  function placePlayerRow(row, beforeRow) {
    const rows = setupPlayerRows();
    const oldIndex = rows.indexOf(row);
    const previousPositions = new Map(
      rows.map((item) => [item, item.getBoundingClientRect().top]),
    );

    if (beforeRow) els.playerRows.insertBefore(row, beforeRow);
    else els.playerRows.appendChild(row);

    const changed = setupPlayerRows().indexOf(row) !== oldIndex;
    if (changed) {
      if (state.setupDrag) state.setupDrag.moved = true;
      updatePlayerPositions();
      animatePlayerReflow(previousPositions, row);
      persistSetupPlayerNames();
    }
    return changed;
  }

  function placePlayerRowAt(row, targetIndex) {
    const rows = setupPlayerRows();
    const otherRows = rows.filter((item) => item !== row);
    const boundedIndex = Math.max(0, Math.min(targetIndex, otherRows.length));
    return placePlayerRow(row, otherRows[boundedIndex] || null);
  }

  function placeDraggedPlayer(clientY) {
    if (!state.setupDrag?.row) return;
    const row = state.setupDrag.row;
    const beforeRow = setupPlayerRows()
      .filter((item) => item !== row)
      .find((item) => {
        const bounds = item.getBoundingClientRect();
        return clientY < bounds.top + bounds.height / 2;
      });
    placePlayerRow(row, beforeRow || null);
  }

  function startSetupDrag(row, mode, pointerId) {
    state.setupDrag = {
      row,
      mode,
      pointerId,
      moved: false,
    };
    row.classList.add("is-dragging");
    els.playerRows.classList.add("is-sorting");
  }

  function finishSetupDrag() {
    if (!state.setupDrag) return;
    const { row, moved } = state.setupDrag;
    row.classList.remove("is-dragging");
    els.playerRows.classList.remove("is-sorting");
    state.setupDrag = null;
    updatePlayerPositions(moved ? row : null);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderGame() {
    const game = state.game;
    const handoff = state.turnHandoff;
    const playing = game && game.status === "playing" && !handoff;

    document.body.classList.toggle("is-playing", Boolean(game));
    els.setupView.hidden = Boolean(game);
    els.gameView.hidden = !game;
    els.gameView.classList.toggle("is-handoff", Boolean(handoff));

    if (!game) return;

    const displayPlayerIndex = handoff?.playerIndex ?? game.currentPlayerIndex;
    const player = game.players[displayPlayerIndex];
    const finishOrder = game.finishOrder || [];
    const displayScore = handoff ? handoff.scoreAfter : liveRemaining(game);
    const displayedDarts = handoff ? handoff.darts : game.currentTurn.darts;
    const displayedTotal = handoff ? handoff.total : game.currentTurn.total;
    const matchComplete = game.status === "complete";
    const allCheckedOut = finishOrder.length === game.players.length;
    els.matchMeta.textContent = `${formatOutMode(game.outMode)} - 301`;
    els.currentPlayer.textContent = matchComplete && !handoff ? "Match complete" : player.name;
    els.currentScore.textContent = displayScore;
    els.visitTotal.textContent = displayedTotal;
    els.dartCount.textContent = handoff?.input === "manual"
      ? "Total"
      : `${displayedDarts.length}/3`;
    els.checkoutHint.textContent = handoff
      ? handoff.result === "bust"
        ? "Score restored"
        : handoff.result === "win"
          ? `Checked out ${formatPlace(handoff.meta.place)}`
          : `${handoff.total} scored`
      : matchComplete
        ? "Final standings"
        : checkoutHint(displayScore, game.outMode);
    els.manualScore.disabled = !playing;
    els.manualSubmit.disabled = !playing;
    els.missButton.disabled = !playing;
    els.undoButton.disabled = !game.snapshots.length || Boolean(handoff);

    els.scoreboard.innerHTML = "";
    game.players.forEach((item, index) => {
      const row = document.createElement("li");
      const finishIndex = finishOrder.indexOf(index);
      const finished = finishIndex !== -1;
      const active = playing && index === game.currentPlayerIndex;
      const handingOff = Boolean(handoff) && index === displayPlayerIndex;
      row.className = [finished && "finished", active && "active", handingOff && "handoff"]
        .filter(Boolean)
        .join(" ");
      const score = finished
        ? formatPlace(finishIndex + 1)
        : handingOff || active
          ? displayScore
          : item.score;
      row.innerHTML = `
        <span>${escapeHtml(item.name)}</span>
        <strong>${score}</strong>
      `;
      els.scoreboard.appendChild(row);
    });

    els.visitDarts.innerHTML = "";
    displayedDarts.forEach((dart) => {
      const chip = document.createElement("span");
      chip.className = `dart-chip ${dart.area}`;
      chip.textContent = dartLabel(dart);
      els.visitDarts.appendChild(chip);
    });

    els.history.innerHTML = "";
    game.history.slice(0, 12).forEach((turn) => {
      const item = document.createElement("li");
      item.className = turn.result;
      item.innerHTML = `
        <span>${escapeHtml(turn.player)}</span>
        <strong>${turn.result === "bust" ? "BUST" : turn.total}</strong>
        <small>${turn.startScore} -> ${turn.scoreAfter}</small>
      `;
      els.history.appendChild(item);
    });

    const latestTurn = game.history[0];
    const showCheckout = game.lastEvent === "checkout" && latestTurn?.result === "win";
    els.winnerBanner.hidden = !matchComplete && !showCheckout;
    if (matchComplete) {
      els.winnerBanner.textContent = allCheckedOut
        ? `${game.winner} wins - all players checked out`
        : `${game.winner} won this saved match`;
    } else if (showCheckout) {
      els.winnerBanner.textContent = `${latestTurn.player} checks out ${formatPlace(latestTurn.meta.place)}`;
    }
  }

  function checkoutHint(score, outMode) {
    if (outMode === "straight") return score <= 180 ? "Exact zero wins" : "Score down";
    if (score === 50) return "Bullseye finish";
    if (score > 1 && score <= 40 && score % 2 === 0) return `D${score / 2} checkout`;
    if (score === 1) return "No double-out finish";
    return "Leave a double";
  }

  function dartLabel(dart) {
    if (dart.area === "miss") return "MISS";
    if (dart.area === "triple") return `T${dart.value}`;
    if (dart.area === "double") return `D${dart.value}`;
    if (dart.area === "outerBull") return "25";
    if (dart.area === "bullseye") return "BULL";
    if (dart.area === "manual") return `${dart.score}`;
    return `${dart.value}`;
  }

  function render() {
    els.recoveryWarning.textContent = state.recoveryWarning || "";
    els.recoveryWarning.hidden = !state.recoveryWarning;
    renderGame();
  }

  function handleBoardAction(target) {
    const segment = target.closest(".segment");
    if (!segment) return;

    const hit = {
      area: segment.dataset.area,
      value: Number(segment.dataset.value),
    };

    recordDartHit(hit);
  }

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

  function pulseTurn(shouldPulse) {
    if (!shouldPulse) return;
    els.gameView.classList.remove("turn-pulse");
    void els.gameView.offsetWidth;
    els.gameView.classList.add("turn-pulse");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2600);
  }

  function bindEvents() {
    document.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      scheduleManualScoreFocus();
    });

    els.addPlayer.addEventListener("click", () => {
      addPlayerRow(defaultPlayerName(els.playerRows.children.length));
      persistSetupPlayerNames();
    });

    els.playerRows.addEventListener("input", (event) => {
      if (event.target.matches("input")) persistSetupPlayerNames();
    });

    els.playerRows.addEventListener("click", (event) => {
      const button = event.target.closest(".remove-player");
      if (!button) return;
      if (els.playerRows.children.length <= 2) {
        showToast("Keep at least two players.");
        return;
      }
      button.closest(".player-row").remove();
      updatePlayerPositions();
      persistSetupPlayerNames();
    });

    els.playerRows.addEventListener("dragstart", (event) => {
      const handle = event.target.closest(".drag-handle");
      if (!handle) {
        event.preventDefault();
        return;
      }
      const row = handle.closest(".player-row");
      startSetupDrag(row, "native");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.querySelector("input").value);
      event.dataTransfer.setDragImage(row, 18, row.offsetHeight / 2);
    });

    els.playerRows.addEventListener("dragover", (event) => {
      if (state.setupDrag?.mode !== "native") return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      placeDraggedPlayer(event.clientY);
    });

    els.playerRows.addEventListener("drop", (event) => {
      if (state.setupDrag?.mode !== "native") return;
      event.preventDefault();
      finishSetupDrag();
    });

    els.playerRows.addEventListener("dragend", finishSetupDrag);

    els.playerRows.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest(".drag-handle");
      if (!handle || event.pointerType === "mouse" || event.button !== 0) return;
      event.preventDefault();
      startSetupDrag(handle.closest(".player-row"), "pointer", event.pointerId);
      handle.setPointerCapture(event.pointerId);
    });

    els.playerRows.addEventListener("pointermove", (event) => {
      if (
        state.setupDrag?.mode !== "pointer" ||
        state.setupDrag.pointerId !== event.pointerId
      ) return;
      event.preventDefault();
      placeDraggedPlayer(event.clientY);
    });

    const finishPointerDrag = (event) => {
      if (
        state.setupDrag?.mode !== "pointer" ||
        state.setupDrag.pointerId !== event.pointerId
      ) return;
      finishSetupDrag();
    };
    els.playerRows.addEventListener("pointerup", finishPointerDrag);
    els.playerRows.addEventListener("pointercancel", finishPointerDrag);

    els.playerRows.addEventListener("keydown", (event) => {
      const handle = event.target.closest(".drag-handle");
      if (!handle || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const row = handle.closest(".player-row");
      const rows = setupPlayerRows();
      const currentIndex = rows.indexOf(row);
      const targetIndex = {
        ArrowUp: currentIndex - 1,
        ArrowDown: currentIndex + 1,
        Home: 0,
        End: rows.length - 1,
      }[event.key];

      if (placePlayerRowAt(row, targetIndex)) updatePlayerPositions(row);
      handle.focus();
    });

    els.setupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const names = Array.from(els.playerRows.querySelectorAll("input"))
        .map((input) => input.value.trim())
        .filter(Boolean);
      const mode = new FormData(els.setupForm).get("outMode");

      try {
        savePlayerNames(state.storage, names);
        setGame(createGame(names, mode));
        flashBoard(null);
      } catch (error) {
        showToast(error.message);
      }
    });

    els.manualForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.game || state.game.status !== "playing" || state.turnHandoff) return;
      hideComicCallout();
      const score = Number.parseInt(els.manualScore.value, 10);
      const playerScore = currentPlayer(state.game).score;
      let confirmDoubleOut = false;

      if (
        state.game.outMode === "double" &&
        Number.isFinite(score) &&
        score === playerScore
      ) {
        confirmDoubleOut = window.confirm(
          "Confirm this manual score finished on a double or bullseye?",
        );
      }

      try {
        const previous = state.game;
        const next = applyManualScore(previous, score, { confirmDoubleOut });
        const soundEvent = manualSoundEventForGame(next);
        const handoff = turnHandoffFor(previous, next);
        const calloutArea = next.lastEvent === "bust" ? "bust" : null;
        const presentation = handoffPresentation(next, handoff, calloutArea);
        els.manualScore.value = "";
        setGame(next, {
          handoff,
          handoffDuration: presentation?.handoffDuration,
        });
        playSound(soundEvent);
        flashBoard(next.lastEvent === "bust" ? "bust" : next.lastEvent);
        if (calloutArea) showComicCallout(calloutArea);
        if (presentation) {
          showTurnAnnouncement(presentation.player, presentation.announcementDelay);
        }
      } catch (error) {
        showToast(error.message);
      }
    });

    els.board.addEventListener("click", (event) => handleBoardAction(event.target));
    els.board.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleBoardAction(event.target);
    });
    els.missButton.addEventListener("click", () => {
      recordDartHit({ area: "miss", value: 0 });
    });

    els.soundToggle.addEventListener("click", () => {
      if (!state.soundManager) return;
      const settings = state.soundManager.getSettings();
      state.soundManager.setMuted(!settings.muted);
      renderAudioSettings();
    });

    els.soundVolume.addEventListener("input", () => {
      if (!state.soundManager) return;
      state.soundManager.setVolume(Number(els.soundVolume.value));
      renderAudioSettings();
    });

    els.undoButton.addEventListener("click", () => {
      if (!state.game) return;
      hideComicCallout();
      setGame(undo(state.game));
      flashBoard(null);
    });

    els.newGame.addEventListener("click", () => {
      if (state.game && !window.confirm("Start a new game?")) return;
      clearTurnHandoff();
      hideComicCallout();
      const names = state.game?.players.map((player) => player.name);
      savePlayerNames(state.storage, names);
      state.game = null;
      saveGame();
      renderSetupPlayers(names);
      render();
    });
  }

  function init() {
    Object.assign(els, {
      setupView: $("#setup-view"),
      gameView: $("#game-view"),
      recoveryWarning: $("#recovery-warning"),
      setupForm: $("#setup-form"),
      playerRows: $("#player-rows"),
      playerOrderStatus: $("#player-order-status"),
      addPlayer: $("#add-player"),
      board: $("#dartboard"),
      missButton: $("#miss-button"),
      matchMeta: $("#match-meta"),
      currentPlayer: $("#current-player"),
      currentScore: $("#current-score"),
      visitTotal: $("#visit-total"),
      dartCount: $("#dart-count"),
      checkoutHint: $("#checkout-hint"),
      scoreboard: $("#scoreboard"),
      visitDarts: $("#visit-darts"),
      history: $("#history"),
      manualForm: $("#manual-form"),
      manualScore: $("#manual-score"),
      manualSubmit: $("#manual-submit"),
      soundToggle: $("#sound-toggle"),
      soundVolume: $("#sound-volume"),
      undoButton: $("#undo-button"),
      newGame: $("#new-game"),
      winnerBanner: $("#winner-banner"),
      comicCallout: $("#comic-callout"),
      comicCalloutWord: $("#comic-callout-word"),
      turnAnnouncement: $("#turn-announcement"),
      turnPlayer: $("#turn-player"),
      turnSuffix: $("#turn-suffix"),
      toast: $("#toast"),
    });

    state.storage = getSafeStorage(root);
    void registerServiceWorker(root.navigator);
    initializeAudio();
    renderSetupPlayers(loadPlayerNames(state.storage));
    renderDartboard();
    bindEvents();
    const loaded = loadGame();
    state.game = loaded.game;
    state.recoveryWarning = loaded.warning;
    render();
    focusManualScore();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
