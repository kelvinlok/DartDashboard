const test = require("node:test");
const assert = require("node:assert/strict");

const { registerServiceWorker } = require("../app.js");
const {
  CACHE_NAME,
  PRECACHE_URLS,
  activateAppShell,
  installAppShell,
  responseForRequest,
} = require("../service-worker.js");

const EXPECTED_APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./sound-manager.js",
  "./app.js",
  "./assets/audio/hit-single.wav",
  "./assets/audio/hit-double.wav",
  "./assets/audio/hit-triple.wav",
  "./assets/audio/outer-bull.wav",
  "./assets/audio/bullseye.wav",
  "./assets/audio/bust.wav",
  "./assets/audio/checkout.wav",
  "./assets/audio/turn-change.wav",
];

test("registers the hosted service worker and absorbs unsupported or failed registration", async () => {
  const registrations = [];
  const supported = {
    serviceWorker: {
      async register(path) {
        registrations.push(path);
      },
    },
  };
  const failing = {
    serviceWorker: {
      async register() {
        throw new Error("registration blocked");
      },
    },
  };

  assert.equal(await registerServiceWorker(supported), true);
  assert.deepEqual(registrations, ["service-worker.js"]);
  assert.equal(await registerServiceWorker(failing), false);
  assert.equal(await registerServiceWorker({}), false);
  assert.equal(await registerServiceWorker(null), false);
});

test("precache manifest contains the complete versioned application shell", async () => {
  const calls = [];
  const cacheStorage = {
    async open(name) {
      calls.push(["open", name]);
      return {
        async addAll(urls) {
          calls.push(["addAll", [...urls]]);
        },
      };
    },
  };
  let skipWaitingCalls = 0;

  await installAppShell(cacheStorage, {
    async skipWaiting() {
      skipWaitingCalls += 1;
    },
  });

  assert.match(CACHE_NAME, /^dart-dashboard-v\d+$/);
  assert.deepEqual(PRECACHE_URLS, EXPECTED_APP_SHELL);
  assert.deepEqual(calls, [
    ["open", CACHE_NAME],
    ["addAll", EXPECTED_APP_SHELL],
  ]);
  assert.equal(skipWaitingCalls, 1);
});

test("activation removes only older Dart Dashboard caches and claims clients", async () => {
  const deleted = [];
  const cacheStorage = {
    async keys() {
      return [CACHE_NAME, "dart-dashboard-v0", "unrelated-cache"];
    },
    async delete(name) {
      deleted.push(name);
      return true;
    },
  };
  let claimCalls = 0;

  await activateAppShell(cacheStorage, {
    async claim() {
      claimCalls += 1;
    },
  });

  assert.deepEqual(deleted, ["dart-dashboard-v0"]);
  assert.equal(claimCalls, 1);
});

test("serves the cached page shell when a cold navigation is offline", async () => {
  const shellResponse = { source: "precache", body: "Dart Dashboard" };
  const request = {
    method: "GET",
    mode: "navigate",
    url: "https://example.test/dd/scoreboard",
  };
  const matches = [];
  const cacheStorage = {
    async match(key) {
      matches.push(key);
      return key === "./index.html" ? shellResponse : undefined;
    },
  };

  const response = await responseForRequest(request, {
    cacheStorage,
    async fetchImpl() {
      throw new TypeError("offline");
    },
  });

  assert.equal(response, shellResponse);
  assert.deepEqual(matches, [request, "./index.html"]);
});
