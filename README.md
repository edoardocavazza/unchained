# Unchained

Unchained takes advantage from browsers support for ES6 modules and ServiceWorkers in order to load a full web application without using a bundler like Webpack or Rollup.

☢️ *This project is just a research about web technologies.*

DO NOT use it in production.

## Why

* Since Safari, Firefox and Chrome started to support ES6 modules syntax, I started to look for a good practise to load my applications.

* Bundlers are great, and I will continue to use them for working/production environments, but I felt nostalgic about the times where I used to build application without have to install ~1000 node modules just to start.

## How it works

Native ES6 modules syntax accepts relative paths only, but the value of a dependencies system through NPM/Yarn is unestimable. Also, it doesn't work with other source formats rather than javascript (JSON, texts, styles...) or syntaxes (like JSX).

Today, those issues are resolved on dev environment side by bundlers (Webpack, Rollup, Browserify) and transpilers (Babel, Traceur).

The idea is to intercept import calls and transform the source in a ServiceWorker context, using the wonderful Babel standalone distribution to manipulate sources and correctly resolve node dependencies.

![Unchained concept](https://docs.google.com/drawings/d/e/2PACX-1vQdqQI38CpJUSRT7diAH9dQOb-N8fGmp8LpOIdmJ6WbebEeDuzenx5wuZNtD0sPCpkYQ3INe3LsRHqM/pub?w=1362&h=1437)


## Usage

Use the Unchained client helper to register a ServiceWorker and to import the main application file.

**index.html**
```html
<script src="https://rawgit.com/edoardocavazza/unchained/master/lib/client.js"></script>
<script>
UnchainedClient
    .register('./sw.js', { scope: '/' }, {
        // Unchained configuration
        plugins: [
            ['jsx', { pragma: 'h' }],
            'env',
            'resolve',
            'common',
            'json',
            'text',
        ],
    })
    .then(() => UnchainedClient.import('index.js'))
    .then(() => console.log('🚀'));
</script>
```

**sw.js**
```js
// import Unchained core and plugins.
self.importScripts(
    'https://rawgit.com/edoardocavazza/unchained/master/lib/core.js',
    'https://rawgit.com/edoardocavazza/unchained/master/lib/plugins/env.js',
    'https://rawgit.com/edoardocavazza/unchained/master/lib/plugins/resolve.js',
    'https://rawgit.com/edoardocavazza/unchained/master/lib/plugins/common.js',
    'https://rawgit.com/edoardocavazza/unchained/master/lib/plugins/jsx.js',
    'https://rawgit.com/edoardocavazza/unchained/master/lib/plugins/json.js',
    'https://rawgit.com/edoardocavazza/unchained/master/lib/plugins/text.js'
);

// immediatly activate the ServiceWorker
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// intercept fetch events.
self.addEventListener('fetch', (event) => {
    // check if requested resource is an import
    if (self.Unchained.check(event)) {
        event.respondWith(
            // resolve the resource response
            self.Unchained.resolve(event, UNCHAINED_CONF)
        );
    }
});
```

**index.js**
```js
import { Component, h, render } from 'preact';

class App extends Component {
    render() {
        return <h1>Hello!</h1>;
    }
}

render(document.body, <App />);
```

## Development

See the [wiki](https://github.com/edoardocavazza/unchained/wiki).

## License

MIT
