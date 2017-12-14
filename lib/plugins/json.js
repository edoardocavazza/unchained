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
