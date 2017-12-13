((scope) => {
    const SEARCH_PARAM = 'unchained';
    const CACHE_NAME = 'unchained';

    if (!scope.hasOwnProperty('Babel')) {
        importScripts('https://unpkg.com/@babel/standalone@7.0.0-beta.34/babel.min.js');
    }

    class Unchained {
        static check(event) {
            return event.request.method === 'GET' && new URL(event.request.url).searchParams.has(SEARCH_PARAM);
        }

        static resolveCache(event) {
            const request = event.request;
            return caches.match(event.request)
                .then((cached) => {
                    if (cached && cached.headers.has('ETag')) {
                        return fetch(event.request, {
                            method: 'HEAD',
                            headers: {
                                'pragma': 'no-cache',
                                'cache-control': 'no-cache',
                            },
                        }).then((remoteRes) => {
                            if (remoteRes.headers.get('ETag') === cached.headers.get('ETag')) {
                                return Promise.resolve(cached);
                            }
                            return Promise.reject();
                        }).catch((err) =>
                            (err ? Promise.resolve(cached) : Promise.reject())
                        );
                    }
                    return Promise.reject('Cached resource not found');
                });
        }

        static resolveRemote(event) {
            return fetch(event.request);
        }

        static resolve(event, config = {}) {
            const request = event.request;
            return this.resolveCache(event)
                .catch((err) =>
                    this.resolveRemote(event)
                        .then((response) =>
                            response.clone().text()
                                .then((content) => {
                                    let unpacked = new Unchained(event.request, response, content, config);
                                    return unpacked.prepare()
                                        .then((converted) => {
                                            let finalResponse = new Response(converted, {
                                                headers: {
                                                    'ETag': response.headers.get('ETag'),
                                                    'Content-Type': 'text/javascript',
                                                }
                                            });
                                            return this.cache(event.request, finalResponse)
                                                .then(() => Promise.resolve(finalResponse));
                                        });
                                })
                        )
                )
        }

        static cache(request, response) {
            return caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, response.clone()));
        }

        static registerPlugin(name, fn) {
            this.plugins = this.plugins || [];
            this.plugins[name] = fn;
        }

        static getPlugin(name) {
            return this.plugins && this.plugins[name];
        }

        static transform(file, input, options = {}) {
            options.plugins = options.plugins || [];
            options.compact = options.hasOwnProperty('compact') ? options.compact : false;
            options.filename = options.hasOwnProperty('filename') ? options.filename : file;
            options.sourceFileName = options.hasOwnProperty('sourceFileName') ? options.sourceFileName : options.filename;
            options.sourceMaps = options.hasOwnProperty('sourceMaps') ? options.sourceMaps : 'inline';
            if (input.ast) {
                return Babel.transformFromAst(input.ast, input.code, options);
            }
            return Babel.transform(input.code, options);
        }

        constructor(request, response, content, options = {}) {
            this.file = {
                url: new URL(request.url).pathname,
                type: response.headers.get('Content-type'),
                headers: response.headers,
                content: content,
            };
            this.plugins = [];
            (options.plugins || []).forEach((plugin) => {
                let conf = {};
                if (Array.isArray(plugin)) {
                    conf = plugin[1];
                    plugin = plugin[0];
                }
                if (typeof plugin === 'string') {
                    plugin = Unchained.getPlugin(plugin);
                }
                if (!(plugin instanceof Unchained.Plugin)) {
                    plugin = new plugin(conf);
                }
                this.plugins.push(plugin);
            });
        }

        async prepare() {
            return await this.finalize(
                await this.resolve(
                    await this.transform()
                )
            );
        }

        async transform() {
            let res = {
                code: this.file.content,
                ast: undefined,
                map: undefined,
            };
            let plugins = this.filterPlugins('transform');
            plugins.forEach((plugin) => {
                res = plugin.transform(this.file, res);
            });
            return Promise.resolve(res);
        }

        async resolve(result) {
            if (this.checkDependencies(result)) {
                let promises = [];
                const plugins = this.filterPlugins('resolve');
                const DEPENDENCIES = new Map();
                const collectDependencies = (path) => {
                    if (path.node && path.node.source) {
                        let source = path.node.source;
                        promises.push((async () => {
                            for (let index in plugins) {
                                let plugin = plugins[index];
                                let resolved = await plugin.resolve(this.file.url, source.value);
                                if (resolved) {
                                    DEPENDENCIES.set(source, `${resolved}?${SEARCH_PARAM}`);
                                    return resolved;
                                }
                            }
                            return null;
                        })());
                    }
                };
                result = Unchained.transform(this.file.url, result, {
                    plugins: [
                        {
                            visitor: {
                                ImportDeclaration: collectDependencies,
                                ExportNamedDeclaration: collectDependencies,
                                ExportAllDeclaration: collectDependencies,
                            }
                        }
                    ],
                });
                await Promise.all(promises);
                if (DEPENDENCIES.size) {
                    const updateDependencies = (path) => {
                        if (path.node && path.node.source) {
                            let source = path.node.source;
                            if (DEPENDENCIES.has(source)) {
                                source.value = DEPENDENCIES.get(source);
                            }
                        }
                    };
                    result = Unchained.transform(this.file.url, result, {
                        plugins: [
                            {
                                visitor: {
                                    ImportDeclaration: updateDependencies,
                                    ExportNamedDeclaration: updateDependencies,
                                    ExportAllDeclaration: updateDependencies,
                                }
                            }
                        ],
                    });
                }
            }
            return await result;
        }

        async finalize(result) {
            return Promise.resolve(
                Unchained.transform(this.file.url, result).code
            );
        }

        checkDependencies(result) {
            if (!result.ast) {
                return true;
            }
            const body = result.ast.program.body;
            for (let k in body) {
                if (body[k].type.match(/(Import|Export(Named|All))Declaration/)) {
                    return true;
                }
            }
            return false;
        }

        filterPlugins(method) {
            return this.plugins
                .filter((plugin) => (typeof plugin[method] === 'function'))
                .filter((plugin) => plugin.test(this.file));
        }
    }

    Unchained.Plugin = class {
        constructor(options = {}) {
            this.options = options;
        }

        get types() {
            return ['application/javascript', 'text/javascript'];
        }

        test(file) {
            let checkTypes = this.types || [];
            return !!checkTypes.find((type) => file.type.includes(type));
        }
    }

    scope.Unchained = Unchained;
})(self);
