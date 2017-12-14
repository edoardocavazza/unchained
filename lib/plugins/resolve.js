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
