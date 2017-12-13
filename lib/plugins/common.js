((Unchained) => {
    const IMPORT_EXPORT_DECL_REGEX = /^(?:Import|Export(?:Named|Default|All))Declaration/;

    function commonRequire({ types }) {
        return {
            visitor: {
                CallExpression(path) {
                    const node = path.node;
                    if (node.callee.name !== 'require') {
                        return;
                    }
                    if (node.arguments.length !== 1 || node.arguments[0].type !== 'StringLiteral') {
                        return;
                    }
                    let program = path.hub.file.path;
                    let toImport = node.arguments[0].value;
                    let id = program.scope.generateUidIdentifierBasedOnNode(toImport);
                    let importDecl = types.importDeclaration(
                        [types.importDefaultSpecifier(id)],
                        types.stringLiteral(toImport)
                    );
                    program.node.body.unshift(importDecl);
                    path.replaceWith(id);
                },
            },
        };
    }

    function commonWrap({ types }) {
        return {
            visitor: {
                Program(path) {
                    for (const child of path.node.body) {
                        if (IMPORT_EXPORT_DECL_REGEX.test(child.type)) {
                            return;
                        }
                    }
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
                    const final = types.exportDefaultDeclaration(
                        types.memberExpression(id, types.identifier('exports'))
                    );
                    path.node.body = [decl, wrap, final];
                },
            },
        };
    }

    class CommonPlugin extends Unchained.Plugin {
        test(file) {
            return file.content.match(/module/) &&
                file.content.match(/exports/) &&
                super.test(file);
        }

        async transform(file, result) {
            let plugins = [commonWrap];
            if (result.code.match(/require\s*\(/)) {
                plugins.unshift(commonRequire);
            }
            return Unchained.transform(file.url, result, {
                plugins,
            });
        }
    }

    Unchained.registerPlugin('common', CommonPlugin);
})(self.Unchained);
