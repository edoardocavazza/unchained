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
