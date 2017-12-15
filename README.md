# Unchained

[![npm](https://img.shields.io/npm/v/unchained-js.svg)](https://www.npmjs.com/package/unchained-js)

Unchained takes advantage from browsers support for ES6 modules and Service Workers in order to load a full web application without using a bundler like Webpack or Rollup.

☢️ *This project is just a research about web technologies.*

DO NOT use it in production.

## Why

* Since Safari, Firefox and Chrome started to support ES6 modules syntax, I started to look for a good practise to load my applications.

* Bundlers are great, and I will continue to use them for working/production environments, but I felt nostalgic about the times where I used to build application without installing ~1000 node modules just to start.

## How it works

Native ES6 modules syntax accepts relative paths only (so, support for dependencies installed by NPM/Yarn is missing). Also, it doesn't work with other source formats rather than javascript (JSON, texts, styles...) or syntaxes (like JSX).

Today, those issues are resolved on dev environment side by bundlers (Webpack, Rollup, Browserify) and transpilers (Babel, Traceur).

The idea is to intercept import calls and transform the source in a ServiceWorker context, using the magninificent Babel standalone distribution to manipulate sources and resolve NPM dependencies.

![Unchained concept](https://docs.google.com/drawings/d/e/2PACX-1vQdqQI38CpJUSRT7diAH9dQOb-N8fGmp8LpOIdmJ6WbebEeDuzenx5wuZNtD0sPCpkYQ3INe3LsRHqM/pub?w=1362&h=1437)


## Usage

Install from NPM:
```sh
$ npm install unchained-js
# OR
$ yarn add unchained-js
```

Use the Unchained client helper to register a ServiceWorker and to import the main application file.

**index.html**
```html
<script src="node_modules/unchained-js/dist/unchained.client.js"></script>
<script>
UnchainedClient
    .register('./sw.js', { scope: '/' })
    .then(() => UnchainedClient.import('index.js'))
    .then(() => console.log('🚀'));
</script>
```

**sw.js**
```js
// import Unchained core and plugins
self.importScripts('node_modules/unchained-js/dist/unchained.sw.js');
```

**index.js**
```js
import { Component, h, render } from 'preact';

class App extends Component {
    render() {
        return <h1>Hello world!</h1>;
    }
}

render(document.body, <App />);
```

## Configuration

The Unchained object can be configured with a set of plugins, through the `Unchained.resolve` method.

### Plugins

An array of Plugin constructors *or* Plugin instances *or* Plugin names.

```js
{
    plugins: [
        // constrcutor
        Unchained.TextPlugin,
        // instance
        new Unchained.ResolvePlugin(),
        // name
        'env',
        // constructor|instance|name with options
        ['jsx', { pragram: 'h' }]
    ]
}
```

> The Plugin name may be registered via the `Unchained.registerPlugin(name, constructor)` method.

A list of available plugins can be found [here](https://github.com/edoardocavazza/unchained/wiki/Plugins).

### Via querystring

You may also configure Unchained via querystring in the service worker registration url:

```js
navigator.serviceWorker.register(`sw.js?unchained={"plugins":["env", "text"]}`);
```

The equivalent can be written using the third parameter of the `Unchained.register` helper method:
```js
Unchained.register('sw.js', { scope: '/' }, {
    plugins: ['env', 'text'],
});
```

## Browsers support ☢️

Support for [Service Workers](https://caniuse.com/#feat=serviceworkers), [ES6 syntax](https://kangax.github.io/compat-table/es6) and [ES6 modules](https://caniuse.com/#feat=es6-module) is required.

Manually tested on Chrome v63.0.3239.84.

## Resources

**ES6 modules**
- [`import`](https://developer.mozilla.org/it/docs/Web/JavaScript/Reference/Statements/import) | [`export`](https://developer.mozilla.org/it/docs/Web/JavaScript/Reference/Statements/export)
- [Dynamic `import()`](https://developers.google.com/web/updates/2017/11/dynamic-import)
- [`<script type="module">`](https://jakearchibald.com/2017/es-modules-in-browsers/)

**Service Workers**
- [Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)

**Babel Standalone**
- [Repository](https://github.com/babel/babel/tree/master/packages/babel-standalone)
- [AST types](https://github.com/babel/babel/blob/master/packages/babel-types/README.md)
- [Transform API](https://babeljs.io/docs/usage/api/)

## Development

See the [wiki](https://github.com/edoardocavazza/unchained/wiki).

## License

MIT

<img src="https://media.giphy.com/media/3ohs7OlN5LgiCRL8OI/giphy.gif" width="100%" />
