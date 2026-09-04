const CACHE_PREFIX = "dart-dashboard-v";
const CACHE_NAME = `${CACHE_PREFIX}1`;
const PRECACHE_URLS = Object.freeze([
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
]);

async function installAppShell(cacheStorage, workerScope) {
  const cache = await cacheStorage.open(CACHE_NAME);
  await cache.addAll(PRECACHE_URLS);
  await workerScope.skipWaiting();
}

async function activateAppShell(cacheStorage, clientsObject) {
  const cacheNames = await cacheStorage.keys();
  await Promise.all(cacheNames
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
    .map((name) => cacheStorage.delete(name)));
  await clientsObject.claim();
}

async function responseForRequest(request, dependencies) {
  const { cacheStorage, fetchImpl } = dependencies;
  const cached = await cacheStorage.match(request);
  if (cached) return cached;

  try {
    return await fetchImpl(request);
  } catch (error) {
    if (request.mode === "navigate") {
      const appShell = await cacheStorage.match("./index.html");
      if (appShell) return appShell;
    }
    throw error;
  }
}

function attachServiceWorker(workerScope) {
  workerScope.addEventListener("install", (event) => {
    event.waitUntil(installAppShell(workerScope.caches, workerScope));
  });

  workerScope.addEventListener("activate", (event) => {
    event.waitUntil(activateAppShell(workerScope.caches, workerScope.clients));
  });

  workerScope.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);
    if (event.request.method !== "GET" || requestUrl.origin !== workerScope.location.origin) {
      return;
    }
    event.respondWith(responseForRequest(event.request, {
      cacheStorage: workerScope.caches,
      fetchImpl: workerScope.fetch.bind(workerScope),
    }));
  });
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  attachServiceWorker(self);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CACHE_NAME,
    PRECACHE_URLS,
    activateAppShell,
    attachServiceWorker,
    installAppShell,
    responseForRequest,
  };
}
