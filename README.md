# Unchained

Unchained takes advantage from browsers support for ES6 modules and ServiceWorkers in order to load a full web application without using a bundler like Webpack or Rollup.

☢️ *This project is just a research about web technologies.*

DO NOT use it in production.

## Why

* Since Safari, Firefox and Chrome started to support ES6 modules syntax, I started to find out a good practise to load my applications.

* Bundlers are great, and I will continue to use them for working/production environments, but I felt nostalgic about the times where I used to build application without have to install ~1000 node modules just to start.

## How it works

Native ES6 modules syntax accepts relative paths only, but the value of a dependencies system through NPM/Yarn is unestimable. Also, it doesn't work with other source formats rather than javascript (JSON, texts, styles...) or syntaxes (like JSX).

Today, those issues are resolved on dev environment side by bundlers (Webpack, Rollup, Browserify) and transpilers (Babel, Traceur).

The idea is to intercept import calls and transform the source in a ServiceWorker context, using the wonderful Babel standalone distribution to manipulate sources and correctly resolve node dependencies.

![Unchained concept](https://docs.google.com/drawings/d/e/2PACX-1vQdqQI38CpJUSRT7diAH9dQOb-N8fGmp8LpOIdmJ6WbebEeDuzenx5wuZNtD0sPCpkYQ3INe3LsRHqM/pub?w=1362&h=1437)
