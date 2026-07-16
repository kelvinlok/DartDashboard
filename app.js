(function attachDartDashboard(root) {
  const STARTING_SCORE = 301;
  const STORAGE_KEY = "dart-dashboard-game";
  const COMIC_DURATION = 900;
  const HANDOFF_DURATION = 1000;
  const BOARD_NUMBERS = [
    20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
  ];

  function defaultPlayerName(index) {
    return `Noob ${index + 1}`;
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

  function normalizeLoadedGame(game) {
    const normalized = clone(game);
    const limit = undoHistoryLimit(normalized);
    normalized.snapshots = Array.isArray(normalized.snapshots) && limit > 0
      ? normalized.snapshots.slice(-limit).map(flatSnapshot)
      : [];
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

  function turnHandoffFor(previousGame, nextGame) {
    if (!previousGame || !nextGame) return null;
    if (nextGame.history.length <= previousGame.history.length) return null;
    return clone(nextGame.history[0]);
  }

  const api = {
    STARTING_SCORE,
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
    handoffTimingFor,
    liveRemaining,
    manualSoundEventForGame,
    normalizeLoadedGame,
    shouldPlayTurnChange,
    soundEventForDart,
    turnAnnouncementFor,
    turnHandoffFor,
    undo,
    scoreForHit,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof window === "undefined") return;

  root.DartDashboard = api;

  const state = {
    game: null,
    selectedHit: null,
    turnHandoff: null,
    handoffTimer: null,
    soundManager: null,
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
    if (!state.game) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.game));
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.players && parsed.status) return normalizeLoadedGame(parsed);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }

  function clearTurnHandoff() {
    clearTimeout(state.handoffTimer);
    state.handoffTimer = null;
    state.turnHandoff = null;
    hideTurnAnnouncement();
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
      }, options?.handoffDuration || HANDOFF_DURATION);
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

  function renderSetupPlayers() {
    const rows = Array.from(els.playerRows.querySelectorAll(".player-row"));
    const names = rows.map((row) => row.querySelector("input").value);
    els.playerRows.innerHTML = "";
    const nextNames = names.length ? names : [defaultPlayerName(0), defaultPlayerName(1)];

    nextNames.forEach((name, index) => addPlayerRow(name || defaultPlayerName(index)));
  }

  function addPlayerRow(value) {
    const row = document.createElement("label");
    row.className = "player-row";
    row.innerHTML = `
      <span>P${els.playerRows.children.length + 1}</span>
      <input type="text" value="${escapeHtml(value)}" maxlength="18" />
      <button type="button" class="icon-button remove-player" aria-label="Remove player">x</button>
    `;
    els.playerRows.appendChild(row);
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
    els.addPlayer.addEventListener("click", () => {
      addPlayerRow(defaultPlayerName(els.playerRows.children.length));
    });

    els.playerRows.addEventListener("click", (event) => {
      const button = event.target.closest(".remove-player");
      if (!button) return;
      if (els.playerRows.children.length <= 2) {
        showToast("Keep at least two players.");
        return;
      }
      button.closest(".player-row").remove();
    });

    els.setupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const names = Array.from(els.playerRows.querySelectorAll("input"))
        .map((input) => input.value.trim())
        .filter(Boolean);
      const mode = new FormData(els.setupForm).get("outMode");

      try {
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
      state.game = null;
      saveGame();
      render();
    });
  }

  function init() {
    Object.assign(els, {
      setupView: $("#setup-view"),
      gameView: $("#game-view"),
      setupForm: $("#setup-form"),
      playerRows: $("#player-rows"),
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

    initializeAudio();
    renderSetupPlayers();
    renderDartboard();
    bindEvents();
    state.game = loadGame();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
