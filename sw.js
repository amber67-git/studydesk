/* StudyDesk service worker: makes the installed app open offline.
 *
 * - App shell (HTML/CSS/JS): network first, cached copy when offline, so an
 *   online start always gets the newest version and an offline start still works.
 * - Fonts, icons, manifest: cache first (they rarely change), refreshed in the background.
 * - Google Fonts CSS/files: stale-while-revalidate.
 * - Everything else (Google Books, MusicBrainz, Crossref, TMDB, cover images):
 *   not intercepted. Live lookups stay live and nothing from them is cached.
 *
 * Data is NOT touched here: notes live in localStorage, which a service worker
 * never reads or writes.
 */
var CACHE = 'studydesk-shell-v1';
var FONT_CACHE = 'studydesk-fonts-v1';
// Absolute URLs of the shell, so same-origin requests outside it are left alone
// (the GitHub Pages origin is shared with the owner's other project sites).
var SHELL = [
  './', './style.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './fonts/patrick-hand-400-latin.woff2', './fonts/patrick-hand-400-latin-ext.woff2', './fonts/patrick-hand-400-vietnamese.woff2',
  './fonts/architects-daughter-400-latin.woff2', './fonts/architects-daughter-400-latin-ext.woff2',
  './fonts/inter-var-latin.woff2', './fonts/inter-var-latin-ext.woff2', './fonts/jetbrains-mono-var-latin.woff2'
];
var ROOT = new URL('./', self.location.href).href;
var SHELL_URLS = SHELL.map(function (p) { return new URL(p, self.location.href).href; });

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      // only our own obsolete caches: other apps on this origin keep theirs
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('studydesk-') === 0 && k !== CACHE && k !== FONT_CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isShellAsset(url) {
  return SHELL_URLS.indexOf(url.href.split('#')[0]) !== -1;
}
function isRootDocument(url) {
  var u = url.href.split('#')[0].split('?')[0];
  return u === ROOT || u === ROOT + 'index.html';
}
function isShellDocument(url) {
  var p = url.pathname;
  return p.endsWith('/style.css') || p.endsWith('/app.js');
}

// cache writes are kept alive with waitUntil: the browser may stop the worker
// right after the response is returned, before the write finishes
function putInCache(event, cacheName, key, response) {
  var work = caches.open(cacheName).then(function (cache) { return cache.put(key, response); });
  event.waitUntil(work);
  return work;
}

// The app document: network first, cached copy offline. Every root alias
// (./, ./index.html, ?query) maps to the single ROOT cache entry, so an update
// fetched online is the same copy served offline later.
function rootDocument(event) {
  return fetch(event.request).then(function (response) {
    if (response && response.ok) putInCache(event, CACHE, ROOT, response.clone());
    return response;
  }).catch(function () {
    return caches.match(ROOT).then(function (cached) {
      return cached || new Response('offline', { status: 503, statusText: 'offline' });
    });
  });
}

// Any other same-origin navigation is not part of the shell: never cached;
// offline it lands on the app root (a redirect, so relative asset URLs resolve).
function otherNavigation(event) {
  return fetch(event.request).catch(function () { return Response.redirect(ROOT, 302); });
}

function networkFirst(event) {
  var request = event.request;
  return fetch(request).then(function (response) {
    if (response && response.ok) putInCache(event, CACHE, request, response.clone());
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || new Response('offline', { status: 503, statusText: 'offline' });
    });
  });
}

function staleWhileRevalidate(event, cacheName, allowOpaque) {
  var request = event.request;
  return caches.match(request).then(function (cached) {
    var network = fetch(request).then(function (response) {
      // the Google Fonts stylesheet can come back opaque (no-cors); accept that
      // only for those hosts, everything else must be a readable 2xx
      var cacheable = response && (response.ok || (allowOpaque && response.type === 'opaque'));
      if (cacheable) putInCache(event, cacheName, request, response.clone());
      return response;
    }).catch(function () { return cached; });
    if (cached) {
      event.waitUntil(network.catch(function () { /* offline refresh: nothing to do */ }));
      return cached;
    }
    return network;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(isRootDocument(url) ? rootDocument(event) : otherNavigation(event));
    } else if (isShellAsset(url)) {
      event.respondWith(isShellDocument(url) ? networkFirst(event) : staleWhileRevalidate(event, CACHE, false));
    }
    // other same-origin files are not ours to cache: browser default
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE, true));
  }
  // any other origin: let the browser handle it normally
});
