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
            return '0.1.0';
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

/**
 * Unchained Common plugin.
 * Convert commonjs require/exports.
 */
((Unchained) => {
    /**
     * Match AST types for ES6 import export.
     * @type {RegExp}
     */
    const IMPORT_EXPORT_DECL_REGEX = /^(?:Import|Export(?:Named|Default|All))Declaration/;

    // babel plugin for `require` transformation.
    function commonRequire({ types }) {
        return {
            visitor: {
                // intercept call expressions.
                CallExpression(path) {
                    const node = path.node;
                    if (node.callee.name !== 'require') {
                        // the called function is not `require`, ignore it.
                        return;
                    }
                    if (node.arguments.length !== 1 || node.arguments[0].type !== 'StringLiteral') {
                        // the required argument is not a string, so we can not handle it during the transpiling.
                        return;
                    }

                    // create an ES6 import declaration.
                    let modName = node.arguments[0].value;
                    let id = path.scope.generateUidIdentifierBasedOnNode(modName);
                    let importDecl = types.importDeclaration(
                        [types.importDefaultSpecifier(id)],
                        types.stringLiteral(modName)
                    );
                    // replace the require call with the imported value.
                    path.replaceWith(id);

                    // import declaration should be on the top-level of the file.
                    let program = path.hub.file.path;
                    program.node.body.unshift(importDecl);
                },
            },
        };
    }

    // babel plugin for `exports` transformation.
    function commonWrap({ types }) {
        return {
            visitor: {
                // intercept file top-level.
                Program(path) {
                    // check if the file has not ES6 imports/exports. we do not handle mixed mode.
                    for (const child of path.node.body) {
                        if (IMPORT_EXPORT_DECL_REGEX.test(child.type)) {
                            // ES6 import/export found, exit.
                            return;
                        }
                    }

                    // wrap the file defining `module` and `exports` variables.
                    const id = path.scope.generateUidIdentifierBasedOnNode('module');
                    const exportsId = types.identifier('exports');
                    const mod = types.objectExpression([
                        types.objectProperty(types.identifier('exports'), types.objectExpression([])),
                    ]);
                    const decl = new types.variableDeclaration('let', [
                        types.variableDeclarator(id, mod),
                    ]);
                    const wrap = types.expressionStatement(
                        types.callExpression(
                            types.functionExpression(null, [types.identifier('module'), exportsId], types.blockStatement(path.node.body)),
                            [id, types.memberExpression(id, types.identifier('exports'))]
                        )
                    );
                    // export the defined variables as default.
                    const final = types.exportDefaultDeclaration(
                        types.memberExpression(id, types.identifier('exports'))
                    );
                    path.node.body = [decl, wrap, final];
                },
            },
        };
    }

    /**
     * @class CommonPlugin
     * @extends Unchained.Plugin
     */
    class CommonPlugin extends Unchained.Plugin {
        /**
         * @inheritdoc
         */
        test(file) {
            // check if file contains module or exports expressions.
            return file.content.match(/module/) &&
                file.content.match(/exports/) &&
                super.test(file);
        }

        /**
         * Transform `require`|`exports` statements into ES6 `import`|`export` statements.
         *
         * @param {FileDefinition} file The input file.
         * @param {FileAnalysis} result The previous code analysis.
         * @return {Promise<FileAnalysis>} The transformed code analysis.
         */
        async transform(file, result) {
            let plugins = [];
            if (result.code.match(/require\s*\(/)) {
                // add the plugin for `require` transformations.
                plugins.push(commonRequire);
            }
            // add the plugin for `exports` transformations.
            plugins.push(commonWrap);
            // transform the code.
            return Unchained.transform(file.url, result, {
                plugins,
            });
        }
    }

    // register the plugin with `common` name.
    Unchained.registerPlugin('common', CommonPlugin);
})(self.Unchained);

/**
 * Unchained ENV plugin.
 * Replace process.env with the given value.
 */
((Unchained) => {
    /**
     * @class ENVPlugin
     * @extends Unchained.Plugin
     *
     * @param {Object} config.env A set of ENV variables.
     */
    class ENVPlugin extends Unchained.Plugin {
        /**
         * @inheritdoc
         */
        test(file) {
            // check if the file contains `process.env`.
            return file.content.match(/process\.env/) && super.test(file);
        }

        /**
         * Replace `prcoess.env.{x}` variables.
         *
         * @param {FileDefinition} file The input file.
         * @param {FileAnalysis} result The previous code analysis.
         * @return {Promise<FileAnalysis>} The transformed code analysis.
         */
        async transform(file, result) {
            // store env variables.
            let env = this.config.env || {};
            return Unchained.transform(file.url, result, {
                plugins: [
                    // babel plugin.
                    ({ types }) => {
                        return {
                            visitor: {
                                // intercept member expressions.
                                MemberExpression(path) {
                                    // the member expression requires `process.env`.
                                    if (path.get('object').matchesPattern('process.env')) {
                                        // evaluate the key.
                                        const key = path.toComputedKey();
                                        // check if the key is a string, so we can replace it during the transpiling.
                                        if (types.isStringLiteral(key)) {
                                            // replace the value.
                                            path.replaceWith(types.valueToNode(env[key]));
                                        }
                                    }
                                },
                            },
                        };
                    },
                ],
            });
        }
    }

    // register the plugin with `env` name.
    Unchained.registerPlugin('env', ENVPlugin);
})(self.Unchained);

/**
 * Unchained JSON plugin.
 * Handle .json files import.
 */
((Unchained) => {
    /**
     * @class JSONPlugin
     * @extends Unchained.Plugin
     */
    class JSONPlugin extends Unchained.Plugin {
        /**
         * @inheritdoc
         */
        get types() {
            return ['application/json', 'text/json'];
        }

        /**
         * Convert JSON files in ES6 module.
         *
         * @param {FileDefinition} file The input file.
         * @param {FileAnalysis} result The previous code analysis.
         * @return {Promise<FileAnalysis>} The transformed code analysis.
         */
        async transform(file, result) {
            if (!result.ast) {
                // export the json.
                return Unchained.transform(file.url, {
                    code: `export default ${result.code}`,
                });
            }
            // a plugin already handled this file.
            return result;
        }
    }

    // register the plugin with `json` name.
    Unchained.registerPlugin('json', JSONPlugin);
})(self.Unchained);

/**
 * Unchained JSX plugin.
 * Handle JSX syntax and .jsx files import.
 */
((Unchained) => {
    /**
     * custom babel plugin.
     * @param {Object} config Plugin configuration.
     * @param {Object} config.types The AST types factory.
     */
    function wrapJSX({ types }) {
        return {
            visitor: {
                // intercept top-level statements.
                Program(path) {
                    // force export default of the jsx.
                    const decl = types.exportDefaultDeclaration(
                        types.functionExpression(null, [types.identifier('jsx')], types.blockStatement([
                            types.returnStatement(path.node.body[0].expression),
                        ]))
                    );
                    path.node.body = [decl];
                },
            },
        };
    }

    /**
     * @class JSXPlugin
     * @extends Unchained.Plugin
     *
     * @param {String} config.pragma The vdom factory.
     */
    class JSXPlugin extends Unchained.Plugin {
        /**
         * @inheritdoc
         */
        get types() {
            return ['application/javascript', 'text/javascript', 'text/jsx'];
        }

        /**
         * @inheritdoc
         */
        test(file) {
            // ultra-base check for `<TAG>` presence in the file content.
            return file.content.match(/<[\w-_]+[\s>]/) && super.test(file);
        }

        /**
         * Convert the JSX syntax.
         *
         * @param {FileDefinition} file The input file.
         * @param {FileAnalysis} result The previous code analysis.
         * @return {Promise<FileAnalysis>} The transformed code analysis.
         */
        async transform(file, result) {
            let plugins = [];
            if (file.type.includes('text/jsx')) {
                // handle .jsx files with custom babel plugin.
                plugins.push('syntax-jsx', wrapJSX);
            }
            // add the official babel jsx plugin with the configuration.
            plugins.push(['transform-react-jsx', this.config]);
            // transform the code.
            return Unchained.transform(file.url, result, {
                plugins,
            });
        }
    }

    // register the plugin with `jsx` name.
    Unchained.registerPlugin('jsx', JSXPlugin);
})(self.Unchained);

/**
 * Unchained Resolve plugin.
 * Resolve NPM dependencies.
 */
((Unchained) => {
    /**
     * Store already resolved modules.
     * @type {Object}
     */
    const CACHE = {};

    /**
     * Try to resolve a NPM dependency.
     *
     * @param {String} from The parent file url.
     * @param {String} to The required import.
     * @return {Promise<String>} The resolved import.
     */
    async function browserResolve(from, to) {
        /**
         * Check if a file exists via network request.
         *
         * @param {String} file The file url.
         * @param {String} extension The extension to automatically add if not provided.
         * @return {Promise<String>} Resolves with the file url if it exists.
         */
        async function isFile(file, extension = 'js') {
            let origFile = file;
            if (extension && !extname(file)) {
                // auto add extension to the request.
                file = `${file}.${extension}`;
            }
            // exec a HEAD request for the file.
            let res = await fetch(`/${file}`, { method: 'HEAD' });
            // check the request response.
            if (res && res.ok && res.headers.get('Content-Type')) {
                // it is a file!
                return file;
            }
            if (origFile !== file) {
                // try to load the file without the added extension.
                return await isFile(origFile, false);
            }
            // file not found.
            return null;
        }

        /**
         * Try to load a NPM module.
         *
         * @param {String} module The module name.
         * @return {Promise<String>} Resolves with the main module entry if found.
         */
        async function loadAsPackage(module) {
            // resolve the package.json path
            let packagePath = join(module, 'package.json');
            // fetch the package.json
            let res = await fetch(`/${packagePath}`);
            if (res.ok) {
                // package.json found, parse the JSON.
                let pkg = await res.json();
                if (pkg) {
                    // resolve the main entry.
                    return join(module, pkg.module || pkg.main || 'index.js');
                }
            }
            // module not found.
            return null;
        }

        /**
         * Join paths.
         *
         * @example
         * join('path', 'to') -> 'path/to'
         *
         * @param {...String} paths A list of paths to join.
         * @return {String}
         */
        function join(...paths) {
            return paths.map(
                (str) =>
                    // remove / at the start and at the end of the partial path.
                    str.replace(/^\/*/, '').replace(/\/*$/, '')
            )
            // join the parts.
            .join('/');
        }

        /**
         * Get the filaname of a path.
         *
         * @example
         * basename('/path/to/file.js') -> 'file.js'
         *
         * @param {String} path The file path.
         * @return {String}
         */
        function basename(path) {
            return path.split('/').pop();
        }

        /**
         * Get the extension of a file.
         *
         * @example
         * extname('/path/to/file.js') -> 'js'
         * extname('/path/to/file') -> null
         *
         * @param {String} path The file path.
         * @return {String}
         */
        function extname(path) {
            // resolve path basename.
            path = basename(path);
            let exts = path.split('.');
            if (exts.length > 1) {
                // dot extensions found, return the last one.
                return exts.pop();
            }
            // dot extension not found.
            return null;
        }

        /**
         * Check if a path is relative.
         *
         * @example
         * isRelative('./path/to') -> true
         * isRelative('preact') -> false
         *
         * @param {*} path
         */
        function isRelative(path) {
            // check if the path starts with a . or a /
            return /^[./]/.test(path);
        }

        /**
         * Resolve relative paths.
         *
         * @param {String} from The initial path.
         * @param {String} to The final path.
         * @return {String} The resolved path.
         */
        function relative(from, to) {
            // split initial path into parts, remove empty parts and remove the last entry (we need to be relative to this).
            let stack = from.split('/').filter((part) => !!part).slice(0, -1);
            // split final path into parts and remove empty parts.
            let parts = to.split('/').filter((part) => !!part);
            // iterate target parts.
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === '.') {
                    // the target is relative to current dir.
                    // do nothing.
                } else if (parts[i] === '..') {
                    // the target is relative to a parent dir.
                    // move upper in the stack.
                    stack.pop();
                } else {
                    // add the current part to the stack.
                    stack.push(parts[i]);
                }
            }
            // join the final stack.
            return stack.join('/');
        }

        /**
         * Retrieve module information.
         *
         * @param {String} module The path to analyze.
         * @return {Object} Module info.
         */
        function moduleInfo(module) {
            // check if the module is scoped.
            let scoped = module[0] === '@';
            // split module path in parts.
            let parts = module.split('/');
            return {
                // retrieve the module name (if scoped, we need the first two parts).
                module: parts.slice(0, scoped ? 2 : 1).join('/'),
                // retrieve the requested pathname inside the module (if scope, we need to skip the first two parts).
                pathname: parts.slice(scoped ? 2 : 1).join('/'),
            };
        }

        let res;
        if (CACHE[to]) {
            // resolve using cache.
            res = CACHE[to];
        } else if (isRelative(to)) {
            // if the path is relative, resolve it and try.
            res = await isFile(relative(from, to));
        } else {
            // the requested path may be a module.
            // extract module info.
            let { module, pathname } = moduleInfo(to);
            if (!pathname) {
                // the requested path is the module name, try to load the package.
                res = await loadAsPackage(`node_modules/${module}`)
            } else {
                // the requested path is inside a module, try to load the requested file.
                res = await isFile(`node_modules/${module}/${pathname}`);
            }
            if (res) {
                // add the resource to the cache.
                CACHE[to] = res;
            }
        }
        // return the resolved path.
        return `/${res}`;
    }

    /**
     * @class ResolvePlugin
     * @extends Unchained.Plugin
     */
    class ResolvePlugin extends Unchained.Plugin {
        /**
         * Resolve the imported file.
         *
         * @param {String} from The path of the parent file.
         * @param {String} to The path of the improted file.
         * @return {Promise<String>} The resolved path.
         */
        async resolve(from, to) {
            // use browserResolve library.
            return await browserResolve(from, to);
        }
    }

    // register the plugin with `resolve` name.
    Unchained.registerPlugin('resolve', ResolvePlugin);
})(self.Unchained);

/**
 * Unchained Text plugin.
 * Handle text files import.
 */
((Unchained) => {
    /**
     * @class TextPlugin
     * @extends Unchained.Plugin
     */
    class TextPlugin extends Unchained.Plugin {
        /**
         * @inheritdoc
         */
        get types() {
            return ['text/'];
        }

        /**
         * Convert text files into ES6 module.
         *
         * @param {FileDefinition} file The input file.
         * @param {FileAnalysis} result The previous code analysis.
         * @return {Promise<FileAnalysis>} The transformed code analysis.
         */
        async transform(file, result) {
            if (!result.ast) {
                // escape ` character.
                let escaped = result.code.replace(/`/g, '\\`');
                // export the file as a string.
                return Unchained.transform(file.url, {
                    code: `export default \`${escaped}\``,
                });
            }
            // a plugin already handled this file.
            return result;
        }
    }

    // register the plugin with `text` name.
    Unchained.registerPlugin('text', TextPlugin);
})(self.Unchained);

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