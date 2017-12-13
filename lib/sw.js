/**
 * Unchained ServiceWorker sample.
 */

// import core and plugins.
self.importScripts(
    './core.js',
    './plugins/env.js',
    './plugins/resolve.js',
    './plugins/common.js',
    './plugins/jsx.js',
    './plugins/json.js',
    './plugins/text.js'
);

// promptly activate the ServiceWorker.
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); // Become available to all pages
});

// intercept fetch events.
self.addEventListener('fetch', (event) => {
    // check if requested resource is an import.
    if (self.Unchained.check(event)) {
        event.respondWith(
            // resolve the resource response
            self.Unchained.resolve(event)
        );
    }
});
