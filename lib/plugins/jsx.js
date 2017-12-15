/**
 * Unchained JSX plugin.
 * Handle .jsx files import.
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
            return ['text/jsx'];
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
            // transform the code.
            return Unchained.transform(file.url, result, {
                plugins: [
                    'syntax-jsx',
                    wrapJSX,
                    ['transform-react-jsx', this.config],
                ],
            });
        }
    }

    // register the plugin with `jsx` name.
    Unchained.registerPlugin('jsx', JSXPlugin);
})(self.Unchained);
