self.importScripts(
    './core.js',
    './plugins/env.js',
    './plugins/resolve.js',
    './plugins/common.js',
    './plugins/jsx.js',
    './plugins/json.js',
    './plugins/text.js'
);

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); // Become available to all pages
});

self.addEventListener('fetch', (event) => {
    if (self.Unchained.check(event)) {
        event.respondWith(
            self.Unchained.resolve(event)
        );
    }
});
