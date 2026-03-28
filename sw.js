/* ================================================================
   Service Worker — FTRV Lot Manager PWA
   Caches app shell for offline use. Inventory data is handled
   by IndexedDB (see db.js), not the SW cache.
   ================================================================ */

var CACHE_NAME = "ftrv-lot-v79";
var APP_SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/db.js",
  "./js/sync.js",
  "./js/views.js",
  "./js/app.js",
  "./js/gate.js",
  "./manifest.json",
  "./img/powered-by-rayi.png",
  "./img/lot-map-p1.jpg",
  "./img/lot-map-p2.jpg",
];

// Install — cache the app shell
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activate — clean old caches
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch — network-first for data, cache-first for app shell
self.addEventListener("fetch", function (e) {
  var url = e.request.url;

  // API / data calls → network only (IndexedDB handles caching)
  if (url.indexOf("googleapis.com") !== -1
      || url.indexOf("script.google.com") !== -1) {
    return;  // Let the browser handle it normally
  }

  // data files (data.json, data-CLE.json, data-AUS.json, etc.) → network-first
  if (url.indexOf("data.json") !== -1 || /data-[A-Z]+\.json/i.test(url)) {
    e.respondWith(
      fetch(e.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function () {
        // Offline — fall back to cached data.json
        return caches.match(e.request);
      })
    );
    return;
  }

  // App shell → cache-first, fallback to network
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (response) {
        // Cache new resources
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    }).catch(function () {
      // Offline fallback
      if (e.request.mode === "navigate") {
        return caches.match("./index.html");
      }
    })
  );
});
