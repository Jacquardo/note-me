const CACHE_VERSION = 'v11.0.1'; // Change le numéro à chaque mise à jour !const CACHE_NAME = `notes-me-${CACHE_VERSION}`;
const REQUIRED_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/logo.png'
];

const OPTIONAL_ASSETS = [
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/notes.css',
  './css/modals.css',
  './css/responsive.css',

  './js/app.js',
  './js/state.js',

  './js/config/constants.js',
  './js/config/backgrounds.js',

  './js/db/database.js',
  './js/db/migrations.js',
  './js/db/notesRepository.js',
  './js/db/filesRepository.js',
  './js/db/versionsRepository.js',
  './js/db/settingsRepository.js',

  './js/services/exportZip.js',
  './js/services/importZip.js',
  './js/services/search.js',
  './js/services/storage.js',
  './js/services/history.js',
  './js/services/pwa.js',

  './js/ui/dom.js',
  './js/ui/toast.js',
  './js/ui/modals.js',
  './js/ui/notesRenderer.js',
  './js/ui/listViews.js',
  './js/ui/emptyState.js',
  './js/ui/accessibility.js',
  './js/ui/settingsPanel.js',

  './js/utils/debounce.js',
  './js/utils/dates.js',
  './js/utils/files.js',
  './js/utils/colors.js',
  './js/utils/ids.js',
  './js/utils/text.js',

  './vendor/sortable.min.js',
  './vendor/jszip.min.js',

  './assets/img1.png',
  './assets/img2.png',
  './assets/img3.png',
  './assets/img4.png',
  './assets/img5.png',
  './assets/img6.png',
  './assets/img7.png',
  './assets/img8.png',
  './assets/img9.png',
  './assets/img10.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    installCache()
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    cleanupOldCaches()
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});

async function installCache() {
  const cache = await caches.open(CACHE_NAME);

  await cache.addAll(REQUIRED_ASSETS);

  await Promise.allSettled(
    OPTIONAL_ASSETS.map(async (asset) => {
      try {
        const response = await fetch(asset, {
          cache: 'no-cache'
        });

        if (response.ok) {
          await cache.put(asset, response);
        }
      } catch (error) {
        console.warn('[Service Worker] Ressource optionnelle non mise en cache :', asset, error);
      }
    })
  );
}

async function cleanupOldCaches() {
  const keys = await caches.keys();

  await Promise.all(
    keys
      .filter((key) => key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  );
}

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);

    // Sécurité ajoutée : on ne met en cache que si la réponse est ok (status 200-299)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('./index.html', networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cached = await caches.match('./index.html');

    if (cached) {
      return cached;
    }

    return new Response(
      '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Notes Me hors ligne</title></head><body><h1>Notes Me est hors ligne</h1><p>La page principale est indisponible dans le cache.</p></body></html>',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'text/html; charset=UTF-8'
        }
      }
    );
  }
}

async function handleAssetRequest(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);

    // Sécurité ajoutée : on s'assure que la réponse réseau est valide
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return new Response(
      'Ressource indisponible hors ligne.',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8'
        }
      }
    );
  }
}

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearCurrentCache());
  }
});

async function clearCurrentCache() {
  await caches.delete(CACHE_NAME);
}
