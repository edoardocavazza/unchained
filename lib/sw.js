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

const UNCHAINED_CONF = (() => {
    let swUrl = new URL(self.location.href);
    let conf = swUrl.searchParams.get('unchained');
    if (conf) {
        return JSON.parse(conf);
    }
    return {};
})();

self.addEventListener('fetch', (event) => {
    if (self.Unchained.check(event)) {
        event.respondWith(
            self.Unchained.resolve(event, UNCHAINED_CONF)
        );
    }
});
