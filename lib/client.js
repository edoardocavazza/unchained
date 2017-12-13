((scope) => {
    const SW_URL = scope.UNCHAINED_SW_URL || (() => {
        let src = document.currentScript.src;
        let path = src.split('/').slice(0, -1);
        path.push('Unchained.sw.js');
        return path.join('/');
    })();

    const SW_OPTIONS = scope.UNCHAINED_SW_OPTIONS || (() => {
        let base = document.querySelector('base');
        if (base) {
            return {
                scope: base.getAttribute('href'),
            };
        }
        return {
            scope: '/',
        };
    })();

    const UnchainedClient = {
        checkSupport() {
            if ('serviceWorker' in navigator) {
                return true;
            }
            throw 'Unchained cannot work without ServiceWorkers support.';
        },

        register(path, options, config) {
            if (this.checkSupport()) {
                if (typeof path !== 'string') {
                    config = path;
                    path = SW_URL;
                    options = SW_OPTIONS;
                }
                if (config) {
                    let params = `unchained=${JSON.stringify(config)}`;
                    if (path.indexOf('?') === -1) {
                        path += `?${params}`;
                    } else {
                        path += `&${params}`;
                    }
                }
                return navigator.serviceWorker.register(path, options)
                    .then(UnchainedClient.waitRegistration);
            }
        },

        waitRegistration(registration) {
            return new Promise((resolve) => {
                let installing = registration.installing || registration.waiting;
                if (installing) {
                    installing.addEventListener('statechange', () => {
                        if (installing.state === 'activated') {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        },

        'import'(mod) {
            if (UnchainedClient.checkSupport()) {
                let resolveServiceWorker = Promise.resolve();
                if (!navigator.serviceWorker.controller) {
                    resolveServiceWorker = this.register();
                }
                return resolveServiceWorker.then(() => {
                    let log = UnchainedClient.logger();
                    let promise;
                    mod = `${mod}?unchained`;
                    if (typeof self.import === 'function') {
                        promise = self.import(mod);
                    } else {
                        promise = new Promise((resolve, reject) => {
                            let script = document.createElement('script');
                            script.type = 'module';
                            script.addEventListener('load', () => {
                                resolve();
                            });
                            script.addEventListener('error', (err) => {
                                reject(err);
                            });
                            script.src = mod;
                            document.head.appendChild(script);
                        });
                    }
                    return promise
                        .then((res) => {
                            log.end();
                            return Promise.resolve(res);
                        })
                        .catch((err) => {
                            log.end();
                            return Promise.reject(err);
                        });
                });
            }
        },

        logger() {
            // eslint-disable-next-line
            console.log('%c🚀 Importing sources...', 'color: #ccc;');
            let start = Date.now();
            return {
                end() {
                    // eslint-disable-next-line
                    console.log(`%c🚀 Imported sources in ${Date.now() - start}ms.`, 'color: limegreen;');
                },
            };
        },
    };

    scope.UnchainedClient = UnchainedClient;
})(window);
