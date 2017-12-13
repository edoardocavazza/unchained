((Unchained) => {
    function wrapJSX({ types }) {
        return {
            visitor: {
                Program(path) {
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

    class JSXPlugin extends Unchained.Plugin {
        get types() {
            return ['application/javascript', 'text/javascript', 'text/jsx'];
        }

        test(file) {
            return file.content.match(/<[\w-_]+[\s>]/) && super.test(file);
        }

        transform(file, result) {
            let plugins = [['transform-react-jsx', this.options]];
            if (file.type.includes('text/jsx')) {
                plugins.unshift('syntax-jsx', wrapJSX);
            }
            return Unchained.transform(file.url, result, {
                plugins,
            });
        }
    }

    Unchained.registerPlugin('jsx', JSXPlugin);
})(self.Unchained);
