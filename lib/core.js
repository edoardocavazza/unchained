/**
 * Unchained core.
 * Provide a build process for imported sources and a set of utils for SW integration.
 * It exec transpilation and resolution tasks.
 */

((scope) => {
    /**
     * @typedef {Object} FileDefinition
     * @property {String} url The file url.
     * @property {String} type The file mime type.
     * @property {String} content The file contents.
     * @property {Header} headers The network response headers.
     */

    /**
     * @typedef {Object} FileAnalysis
     * @property {String} code The resulted code after a transformation.
     * @property {Object} ast The resulted AST after a transformation.
     * @property {Object} map The resulted sourcemap after a transformation.
     */

    /**
     * The search param in the querystring in order to detect imported files.
     * @type {String}
     */
    const SEARCH_PARAM = 'unchained';

    /**
     * The cache name where to save transpiled files.
     * @type {String}
     */
    const CACHE_NAME = 'unchained';

    /**
     * @class Unchained
     *
     * @param {Request} request The original file network request.
     * @param {Response} response The original file network response.
     * @param {String} content File content.
     * @param {Object} config Unchained configuration.
     */
    class Unchained {
        /**
         * Check if the network request is an import request.
         *
         * @param {FetchEvent} event The network request event.
         * @return {Boolean}
         */
        static check(event) {
            // check if it is a GET request and the querystring param exists.
            return event.request.method === 'GET' &&
                new URL(event.request.url).searchParams.has(SEARCH_PARAM);
        }

        /**
         * Resolve a network request using Unchained.
         *
         * @param {FetchEvent} event The network request event.
         * @param {Object} config The Unchained configuration.
         * @return {Promise<Response>}
         */
        static async resolve(event, config) {
            // use the provided config or try to auto-detect it from the querystring SW url.
            config = config || Unchained.detectConfig();
            const request = event.request;
            // try to resolve the request using the cache.
            let cached = await this.resolveCache(event);
            if (cached) {
                return cached;
            }
            // eslint-disable-next-line
            console.log(`%c🚀 resolving ${new URL(request.url).pathname}...`, 'color: dodgerblue;');
            // The file needs to be downloaded.
            let response = await this.resolveRemote(event)
            if (response) {
                // get file contents.
                let content = await response.clone().text()
                // create an Unchained context.
                let unpacked = new Unchained(event.request, response, content, config);
                // prepare the file for the response.
                let converted = await unpacked.exec();
                // create a new Response using the transformed code.
                let finalResponse = new Response(converted, {
                    headers: {
                        // save the original ETag header for cache.
                        'ETag': response.headers.get('ETag'),
                        // force Content-type to javascript.
                        'Content-Type': 'text/javascript',
                    }
                });
                // cache the result
                await this.cache(event.request, finalResponse)
                return finalResponse;
            }
            return Promise.reject();
        }

        /**
         * Resolve network request using cache.
         *
         * @param {FetchEvent} event The network request event.
         * @return {Promise<Response>}
         */
        static async resolveCache(event) {
            const request = event.request;
            // check if the requested file exists in cache
            let cached = await caches.match(event.request)
            if (cached) {
                // file has been found in cache.
                // exec an HEAD call to the file in order to check ETag.
                let req = new Request(event.request.url);
                let remoteRes = await fetch(req, {
                    method: 'HEAD',
                    headers: {
                        'pragma': 'no-cache',
                        'cache-control': 'no-cache',
                    },
                });
                if (remoteRes && remoteRes.ok) {
                    // compare cache and fetched ETags.
                    if (remoteRes.headers.get('ETag') === cached.headers.get('ETag')) {
                        // file is not changed.
                        return Promise.resolve(cached);
                    }
                }
            }
            // file does not exist in cache or it is changed.
            return null;
        }

        /**
         * Resolve network request.
         *
         * @param {FetchEvent} event The network request event.
         * @return {Promise<Response>}
         */
        static async resolveRemote(event) {
            return await fetch(event.request);
        }

        /**
         * Save the response in cache.
         *
         * @param {Request} request The network request.
         * @param {Response} response The final response.
         * @return {Promise}
         */
        static async cache(request, response) {
            // open the cache.
            let cache = await caches.open(CACHE_NAME);
            if (cache) {
                // put a clone of the response.
                return await cache.put(request, response.clone());
            }
        }

        /**
         * Register a global Unchained Plugin.
         *
         * @param {String} name The plugin name.
         * @param {Function} fn The plugin constructor.
         * @return {void}
         */
        static registerPlugin(name, fn) {
            this.plugins = this.plugins || [];
            this.plugins[name] = fn;
        }

        /**
         * Get a global plugin by name.
         *
         * @param {String} name The name fo the plugin.
         * @return {Function} The plugin constructor.
         */
        static getPlugin(name) {
            return this.plugins && this.plugins[name];
        }

        /**
         * Auto-detect Unchained configuration from querystring.
         *
         * @return {Object} The Unchained configuration.
         */
        static detectConfig() {
            let swUrl = new URL(self.location.href);
            // check unchained querystring param.
            let conf = swUrl.searchParams.get('unchained');
            if (conf) {
                // parse the value as JSON.
                return JSON.parse(conf);
            }
            return {};
        }

        /**
         * A wrap around `Babel.transform` method.
         *
         * @param {FileDefinition} file The file definition.
         * @param {FileAnalysis} input The input for the transform method.
         * @param {Object} options Babel options for transform method.
         * @return {FileAnalysis}
         */
        static transform(file, input, options = {}) {
            // set default options.
            options.compact = options.hasOwnProperty('compact') ? options.compact : false;
            options.filename = options.hasOwnProperty('filename') ? options.filename : file;
            options.sourceFileName = options.hasOwnProperty('sourceFileName') ? options.sourceFileName : options.filename;
            options.sourceMaps = options.hasOwnProperty('sourceMaps') ? options.sourceMaps : true;
            options.inputSourceMap = input.map || undefined;
            // use code transformation.
            return Babel.transform(input.code, options);
        }

        constructor(request, response, content, config = {}) {
            /**
             * Create a FileDefinition entry.
             * @type {FileDefinition}
             */
            this.file = {
                url: new URL(request.url).pathname,
                type: response.headers.get('Content-type'),
                headers: response.headers,
                content: content,
            };
            /**
             * Store inctance plguins.
             * @type {Array<Plugin>}
             */
            this.plugins = [];
            // iterate configuration plugins.
            (config.plugins || []).forEach((plugin) => {
                let conf = {};
                if (Array.isArray(plugin)) {
                    // array with name and plugin configuration.
                    conf = plugin[1];
                    plugin = plugin[0];
                }
                if (typeof plugin === 'string') {
                    // using plugin name.
                    plugin = Unchained.getPlugin(plugin);
                }
                if (!plugin) {
                    throw 'Unchained invalid plugin.';
                }
                if (!(plugin instanceof Unchained.Plugin)) {
                    // using plugin constructor.
                    plugin = new plugin(conf);
                }
                this.plugins.push(plugin);
            });
        }

        /**
         * Unchained version.
         * @type {String}
         */
        get version() {
            return '0.2.0';
        }

        /**
         * Exec all the Unchained tasks.
         *
         * @return {Promise<String>} Resolve the final code of the file.
         */
        async exec() {
            // 3. finalize the response.
            return await this.finalize(
                // 2. exec import resolutions.
                await this.resolve(
                    // 1. exec transformations.
                    await this.transform()
                )
            );
        }

        /**
         * Transform tasks.
         *
         * @return {Promise<FileAnalysis>}
         */
        async transform() {
            // create a fake initial FileAnalysis.
            let res = {
                code: this.file.content,
                ast: undefined,
                map: undefined,
            };
            // filter plugin with `transform` method.
            let plugins = this.filterPlugins('transform');
            for (let plugin of plugins) {
                // exec plugin transform method.
                res = await plugin.transform(this.file, res);
            }
            return Promise.resolve(res);
        }

        /**
         * Imports resolve task.
         *
         * @param {FileAnalysis} result The result of the transform task.
         * @return {Promise<FileAnalysis>}
         */
        async resolve(result) {
            if (this.checkDependencies(result)) {
                // the current file has dependencies.
                // filter plugin with `resolve` method.
                const plugins = this.filterPlugins('resolve');
                // store the dependencies resolution promises.
                const promises = [];
                // link AST source nodes with their resolved url.
                const dependencies = {};
                // visitor callback for import/export declaration.
                const collectDependencies = (path) => {
                    let source = path.node.source;
                    if (source) {
                        // add the resolution to the queue.
                        promises.push((async () => {
                            // iterate plugins resolve methods.
                            for (let plugin of plugins) {
                                let resolved = await plugin.resolve(this.file.url, source.value);
                                if (resolved) {
                                    // the plugin has resolved the dependency.
                                    dependencies[source.value] = `${resolved}?${SEARCH_PARAM}=${this.version}`;
                                    return resolved;
                                }
                            }
                            return null;
                        })());
                    }
                };
                // apply the import/export detector visitor.
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
                // wait the end of the resolutions queue.
                await Promise.all(promises);
                if (Object.keys(dependencies).length) {
                    // some dependencies needs to be updated.
                    function updatePlugin({ types }) {
                        const updateDependencies = (path) => {
                            let source = path.node.source;
                            if (source) {
                                if (dependencies[source.value]) {
                                    // replace the current value with the resolved one.
                                    source.value = dependencies[source.value];
                                }
                            }
                        };
                        return {
                            visitor: {
                                ImportDeclaration: updateDependencies,
                                ExportNamedDeclaration: updateDependencies,
                                ExportAllDeclaration: updateDependencies,
                            }
                        };
                    }
                    // exec the dependencies update.
                    result = Unchained.transform(this.file.url, result, {
                        plugins: [updatePlugin],
                    });
                }
            }
            return await result;
        }

        /**
         * Convert FileAnalysis into code.
         *
         * @param {FileAnalysis} result The result of the resolve task.
         * @return {Promise<String>}
         */
        async finalize(result) {
            // inline sourcemaps
            return Promise.resolve(
                Unchained.transform(this.file.url, result, {
                    sourceMaps: 'inline',
                }).code
            );
        }

        /**
         * Check if the file has ES6 imports/exports.
         *
         * @param {FileAnalysis} input The current file analysis.
         * @return {Boolean}
         */
        checkDependencies(input) {
            if (!input.ast) {
                // AST is not provided, file MAY have imports/exports.
                return true;
            }
            const body = input.ast.program.body;
            for (let k in body) {
                // check for imports/exports in file top-level
                if (body[k].type.match(/(Import|Export(Named|All))Declaration/)) {
                    return true;
                }
            }
            // nothing found.
            return false;
        }

        /**
         * Filter plugin for method and file type.
         *
         * @param {String} method The method which should exist.
         * @return {Array<Plugin>} A filtered list of plugins.
         */
        filterPlugins(method) {
            return this.plugins
                // check if the method exists.
                .filter((plugin) => (typeof plugin[method] === 'function'))
                // check if the current file type is supported by the plugin.
                .filter((plugin) => plugin.test(this.file));
        }
    }

    /**
     * @class UnchainedPlugin
     * Base Plugin class.
     *
     * @param {Object} config Plugin configuration.
     */
    class UnchainedPlugin {
        constructor(config = {}) {
            this.config = config;
        }

        /**
         * A list of supported mime types.
         * @type {Array<String>}
         */
        get types() {
            return ['application/javascript', 'text/javascript'];
        }

        /**
         * Test if the file is supported bu the plugin using `plugin.types`.
         *
         * @param {FileDefinition} file The file to check.
         * @return {Boolean}
         */
        test(file) {
            let checkTypes = this.types || [];
            return !!checkTypes.find((type) => file.type.includes(type));
        }
    }

    Unchained.Plugin = UnchainedPlugin;

    // export Unchained
    scope.Unchained = Unchained;
})(self);
