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
