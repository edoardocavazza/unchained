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
