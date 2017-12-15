/**
 * Unchained client.
 * Provide helpers for ServiceWorker registration and `import` polyfill.
 */
((scope) => {
    /**
     * @type {Object}
     * Default Unchained configuration.
     */
    const DEFAULT_CONFIG = {
        plugins: [
            ['jsx', { pragma: 'h' }],
            ['babel', {
                presets: [
                    'stage-0',
                ],
                plugins: [
                    ['transform-react-jsx', { pragma: 'h' }],
                ],
            }],
            'common',
            'env',
            'text',
            'json',
            'resolve',
        ],
    };

    /**
     * @class UnchainedClient
     * Helpers for Unchained SW.
     */
    class UnchainedClient {
        /**
         * Check ServiceWorkers and ES6 modules support.
         *
         * @return {Boolean}
         * @throws If ServiceWorkers or ES6 modules are not supported.
         */
        static checkSupport() {
            if (!('serviceWorker' in navigator)) {
                throw 'Unchained cannot work without ServiceWorkers support.';
            }
            if (!('noModule' in document.createElement('script'))) {
                throw 'Unchained cannot work without ES6 modules support.';
            }
            return true;
        }

        /**
         * Register a ServiceWorker.
         *
         * @example
         * Unchained.register('sw.js', { scope: '/' }, {
         *     plugins: ['env', 'text', 'json'],
         * });
         *
         * @param {String} path The path of the SW to register.
         * @param {Object} options A set of SW registration options.
         * @param {Object} config The Unchained configuration.
         * @return {Promise}
         */
        static register(path, options, config = DEFAULT_CONFIG) {
            if (this.checkSupport()) {
                if (config) {
                    // Add the configuration as querystring param of the SW url.
                    let params = `unchained=${JSON.stringify(config)}`;
                    if (path.indexOf('?') === -1) {
                        path += `?${params}`;
                    } else {
                        path += `&${params}`;
                    }
                }
                // Register the SW and wait for installation complete.
                return navigator.serviceWorker.register(path, options)
                    .then(UnchainedClient.waitRegistration);
            }
        }

        /**
         * Helper for ServiceWorker installation.
         *
         * @param {ServiceWorkerRegistration} registration The SW registration.
         * @return {Promise}
         */
        static waitRegistration(registration) {
            return new Promise((resolve) => {
                let installing = registration.installing || registration.waiting;
                if (installing) {
                    // The SW needs to be installed.
                    installing.addEventListener('statechange', () => {
                        if (installing.state === 'activated') {
                            // SW is ready.
                            UnchainedClient.ready = true;
                            resolve();
                        }
                    });
                } else {
                    // SW already installed.
                    UnchainedClient.ready = true;
                    resolve();
                }
            });
        }

        /**
         * Polyfill dynamic import statment.
         *
         * @example
         * Unchained.import('index.js')
         *     .then(() => { // OK })
         *     .catch(() => { // FAILED })
         *
         * @param {String} mod The module to import.
         * @return {Promise}
         */
        static ['import'](mod) {
            if (UnchainedClient.checkSupport()) {
                // SW is supported.
                let resolveServiceWorker = Promise.resolve();
                if (!UnchainedClient.ready) {
                    // Initialize the SW if not installed.
                    resolveServiceWorker = this.register();
                }
                return resolveServiceWorker.then(() => {
                    // SW is ready, start the import.
                    let startTime = Date.now();
                    // eslint-disable-next-line
                    console.log('%c🚀 importing sources...', 'color: #ccc;');
                    let promise;
                    // add `unchained` querystring in order to detect imported files in SW.
                    mod = `${mod}?unchained`;
                    if (typeof self.import === 'function') {
                        // native `import` support.
                        promise = self.import(mod);
                    } else {
                        // polyfill `import`
                        promise = new Promise((resolve, reject) => {
                            // create a "module" script
                            let script = document.createElement('script');
                            script.type = 'module';
                            script.addEventListener('load', () => {
                                // script ready
                                resolve();
                            });
                            script.addEventListener('error', (err) => {
                                // script error
                                reject(err);
                            });
                            script.src = mod;
                            // import it.
                            document.head.appendChild(script);
                        });
                    }
                    return promise
                        .then((res) => {
                            // eslint-disable-next-line
                            console.log(`%c🚀 imported sources in ${Date.now() - startTime}ms.`, 'color: limegreen;');
                            return Promise.resolve(res);
                        })
                        .catch((err) => {
                            // eslint-disable-next-line
                            console.log('%c🚀 source import failed', 'color: red;');
                            return Promise.reject(err);
                        });
                });
            }
        }
    }

    // export UnchainedClient
    scope.UnchainedClient = UnchainedClient;
})(window);
