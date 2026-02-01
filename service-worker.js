/**
 * Service Worker for Soap Recipe Calculator
 * Provides offline capability with cache-first strategy for static assets
 */

// Cache version - increment to force cache invalidation on deploy
const CACHE_VERSION = 2;
const STATIC_CACHE_NAME = `soap-calc-static-v${CACHE_VERSION}`;
const DATA_CACHE_NAME = `soap-calc-data-v${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    // Core JS modules
    '/js/main.js',
    '/js/core/calculator.js',
    '/js/core/optimizer.js',
    '/js/core/optimizer/index.js',
    '/js/core/optimizer/scoring.js',
    '/js/core/optimizer/optimization.js',
    '/js/core/optimizer/generation.js',
    '/js/core/optimizer/dietary.js',
    '/js/core/optimizer/cupboard.js',
    '/js/lib/constants.js',
    '/js/lib/patterns.js',
    '/js/lib/validation.js',
    '/js/lib/references.js',
    '/js/lib/additiveConfig.js',
    '/js/state/state.js',
    '/js/ui/ui.js',
    '/js/ui/helpers.js',
    '/js/ui/panels.js',
    '/js/ui/panelManager.js',
    '/js/ui/renderers.js',
    '/js/ui/finalRecipe.js',
    '/js/ui/components/itemRow.js',
    '/js/ui/components/toast.js',
    '/js/ui/components/errorBoundary.js'
];

// Data files to cache (can be updated more frequently)
const DATA_ASSETS = [
    '/data/fats.json',
    '/data/fatty-acids.json',
    '/data/glossary.json',
    '/data/tooltips.json',
    '/data/sources.json',
    '/data/formulas.json',
    '/data/fragrances.json',
    '/data/colourants.json',
    '/data/soap-performance.json',
    '/data/skin-care.json',
    '/data/schemas/fats.schema.json',
    '/data/schemas/fatty-acids.schema.json',
    '/data/schemas/glossary.schema.json',
    '/data/schemas/tooltips.schema.json',
    '/data/schemas/sources.schema.json',
    '/data/schemas/formulas.schema.json',
    '/data/schemas/fragrances.schema.json',
    '/data/schemas/colourants.schema.json',
    '/data/schemas/soap-performance.schema.json',
    '/data/schemas/skin-care.schema.json',
    '/data/schemas/common-definitions.schema.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            caches.open(DATA_CACHE_NAME).then((cache) => {
                console.log('[SW] Caching data assets');
                return cache.addAll(DATA_ASSETS);
            })
        ]).then(() => {
            console.log('[SW] Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old versioned caches and take control
self.addEventListener('activate', (event) => {
    const currentCaches = [STATIC_CACHE_NAME, DATA_CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('soap-calc-') && !currentCaches.includes(name))
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - cache-first for static, network-first for data
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Data files: network-first with cache fallback
    if (url.pathname.startsWith('/data/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone and cache the new response
                    const responseClone = response.clone();
                    caches.open(DATA_CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Static assets: stale-while-revalidate
    // Serves cached content immediately, updates cache in background
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((response) => {
                // Don't cache non-success responses
                if (!response || response.status !== 200) {
                    return response;
                }

                // Clone and update cache in background
                const responseClone = response.clone();
                caches.open(STATIC_CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });

                return response;
            });

            // Return cached response immediately, or wait for network
            return cachedResponse || fetchPromise;
        })
    );
});

// Handle messages from the client
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
