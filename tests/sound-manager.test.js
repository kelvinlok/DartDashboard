const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AUDIO_MANIFEST,
  DEFAULT_AUDIO_SETTINGS,
  SoundManager,
  normalizeAudioSettings,
} = require("../sound-manager.js");

class FakeAudioParam {
  constructor(value = 1) {
    this.value = value;
    this.events = [];
  }

  cancelScheduledValues(time) {
    this.events.push(["cancel", time]);
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push(["set", value, time]);
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(["ramp", value, time]);
  }
}

class FakeAudioContext {
  constructor() {
    this.state = "suspended";
    this.currentTime = 4;
    this.destination = { type: "destination" };
    this.gains = [];
    this.sources = [];
    this.decoded = [];
    this.resumeCalls = 0;
  }

  createGain() {
    const node = {
      gain: new FakeAudioParam(),
      connections: [],
      connect(target) {
        this.connections.push(target);
      },
    };
    this.gains.push(node);
    return node;
  }

  createBufferSource() {
    const source = {
      buffer: null,
      connections: [],
      starts: 0,
      stops: 0,
      connect(target) {
        this.connections.push(target);
      },
      start() {
        this.starts += 1;
      },
      stop() {
        this.stops += 1;
        if (this.onended) this.onended();
      },
    };
    this.sources.push(source);
    return source;
  }

  async decodeAudioData(data) {
    this.decoded.push(data);
    return { duration: data.duration || 0.25 };
  }

  async resume() {
    this.resumeCalls += 1;
    this.state = "running";
  }
}

function makeStorage(raw = null) {
  return {
    raw,
    writes: [],
    getItem() {
      return this.raw;
    },
    setItem(key, value) {
      this.raw = value;
      this.writes.push([key, value]);
    },
  };
}

function makeHarness(options = {}) {
  const requests = [];
  const timers = [];
  const storage = options.storage || makeStorage();
  const fetchImpl = async (path) => {
    requests.push(path);
    if (path === options.failPath) throw new Error("asset unavailable");
    return {
      ok: true,
      async arrayBuffer() {
        return { duration: path.includes("bullseye") ? 1.2 : 0.25 };
      },
    };
  };
  const manager = new SoundManager({
    AudioContextClass: FakeAudioContext,
    fetchImpl,
    storage,
    setTimeoutImpl(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
  });
  return { manager, requests, storage, timers };
}

test("publishes the complete dart audio manifest", () => {
  assert.deepEqual(AUDIO_MANIFEST, {
    single: "assets/audio/hit-single.wav",
    double: "assets/audio/hit-double.wav",
    triple: "assets/audio/hit-triple.wav",
    outerBull: "assets/audio/outer-bull.wav",
    bullseye: "assets/audio/bullseye.wav",
    bust: "assets/audio/bust.wav",
    checkout: "assets/audio/checkout.wav",
    turnChange: "assets/audio/turn-change.wav",
  });
});

test("uses safe defaults for missing or invalid saved settings", () => {
  assert.deepEqual(DEFAULT_AUDIO_SETTINGS, { muted: false, volume: 0.8 });
  assert.deepEqual(makeHarness().manager.getSettings(), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(makeHarness({ storage: makeStorage("not json") }).manager.getSettings(), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(normalizeAudioSettings({ muted: "yes", volume: 4 }), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(normalizeAudioSettings({ muted: true, volume: 0.35 }), { muted: true, volume: 0.35 });
});

test("persists mute and volume changes", () => {
  const { manager, storage } = makeHarness();

  assert.deepEqual(manager.setMuted(true), { muted: true, volume: 0.8 });
  assert.deepEqual(manager.setVolume(0.45), { muted: true, volume: 0.45 });
  assert.deepEqual(JSON.parse(storage.raw), { muted: true, volume: 0.45 });
  assert.equal(storage.writes.length, 2);
});

test("unlocks a suspended audio context", async () => {
  const { manager } = makeHarness();

  assert.equal(await manager.unlock(), true);
  assert.equal(manager.context.resumeCalls, 1);
  assert.equal(manager.context.state, "running");
});

test("loads and decodes every available asset while absorbing individual failures", async () => {
  const failPath = AUDIO_MANIFEST.double;
  const { manager, requests } = makeHarness({ failPath });

  assert.equal(await manager.load(), 7);
  assert.deepEqual(requests, Object.values(AUDIO_MANIFEST));
  assert.equal(manager.context.decoded.length, 7);
  assert.equal(manager.play("single"), true);
  assert.equal(manager.play("double"), false);
});

test("does not start sources for unloaded or muted events", async () => {
  const { manager } = makeHarness();

  assert.equal(manager.play("single"), false);
  await manager.load();
  manager.setMuted(true);
  assert.equal(manager.play("single"), false);
  assert.equal(manager.context.sources.length, 0);
});

test("allows short effects to overlap", async () => {
  const { manager } = makeHarness();
  await manager.load();

  assert.equal(manager.play("triple"), true);
  assert.equal(manager.play("triple"), true);
  assert.equal(manager.context.sources.length, 2);
  assert.deepEqual(manager.context.sources.map((source) => source.starts), [1, 1]);
  assert.deepEqual(manager.context.sources.map((source) => source.stops), [0, 0]);
});

test("replaces only the previous major source", async () => {
  const { manager } = makeHarness();
  await manager.load();

  manager.play("bullseye");
  manager.play("bust");
  manager.play("checkout");

  assert.equal(manager.context.sources.length, 3);
  assert.deepEqual(manager.context.sources.map((source) => source.stops), [1, 1, 0]);
});

test("ducks effects during major playback and restores them after its duration", async () => {
  const { manager, timers } = makeHarness();
  await manager.load();

  manager.play("bullseye");

  const effectsGain = manager.context.gains[1].gain;
  assert.ok(effectsGain.events.some((event) => event[0] === "ramp" && event[1] === 0.35));
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 1200);

  timers[0].callback();
  assert.ok(effectsGain.events.some((event) => event[0] === "ramp" && event[1] === 1));
});
