((Unchained) => {
    const CACHE = {};

    async function BrowserResolve(from, to, options = {}) {
        async function isFile(file, autoExtension = 'js') {
            let origFile = file;
            if (autoExtension && !extname(file)) {
                file = `${file}.${autoExtension}`;
            }
            let res = await fetch(`/${file}`, { method: 'HEAD' });
            if (res && res.ok && res.headers.get('Content-Type')) {
                return file;
            }
            if (origFile !== file) {
                return isFile(origFile, false);
            }
            return null;
        }

        async function loadAsPackage(module) {
            let packagePath = join(module, 'package.json');
            let res = await fetch(`/${packagePath}`);
            if (res.ok) {
                let pkg = await res.json();
                let main = join(module, pkg.module || pkg.main || 'index.js');
                return await isFile(main);
            }
            return null;
        }

        async function loadNpmModules(module, start) {
            let splitted = module.split('/');
            let modName = splitted.slice(0, module[0] === '@' ? 2 : 1).join('/');
            let pathName = splitted.slice(module[0] === '@' ? 2 : 1).join('/');
            let res = null;
            if (!pathName) {
                res = await loadAsPackage(`node_modules/${modName}`)
            } else {
                res = await isFile(`node_modules/${modName}/${pathName}`);
            }
            if (res) {
                CACHE[module] = res;
            }
            return res;
        }

        function nodeModulesPaths(start) {
            start = start.replace(/^\/*/, '');
            let parts = start
                .split('/')
                .filter((part) => part !== 'node_modules');
            return parts
                .map((part, index) =>
                    join(...parts.slice(0, index), 'node_modules')
                )
                .reverse();
        }

        function join(...args) {
            return args.map((str) => str.replace(/^\/*/, '').replace(/\/*$/, '')).join('/');
        }

        function basename(path) {
            return path.split('/').pop();
        }

        function extname(path) {
            let exts = basename(path).split('.');
            if (exts.length > 1) {
                return exts.pop();
            }
            return null;
        }

        function dirname(path) {
            return path.split('/').slice(0, -1).join('/');
        }

        function isRelative(path) {
            return /^[./]/.test(path);
        }

        function relative(from, to) {
            let stack = from.split('/').filter((part) => !!part).slice(0, -1);
            let parts = to.split('/').filter((part) => !!part);
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === '.') {
                    continue;
                }
                if (parts[i] === '..') {
                    stack.pop();
                } else {
                    stack.push(parts[i]);
                }
            }
            return stack.join('/');
        }

        if (CACHE[to]) {
            return CACHE[to];
        }

        if (isRelative(to)) {
            let resolved = relative(from, to);
            return await isFile(resolved);
        }
        return await loadNpmModules(to, dirname(from) || '/', true);
    }

    class ResolvePlugin extends Unchained.Plugin {
        async resolve(from, to) {
            let resolved = await BrowserResolve(from, to);
            if (resolved) {
                return `/${resolved}`;
            }
            return null;
        }
    }

    Unchained.registerPlugin('resolve', ResolvePlugin);
})(self.Unchained);
