/**
 * Unchained ServiceWorker sample.
 */

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
