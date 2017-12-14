/**
 * Unchained Babel plugin.
 * Transpiled code using babel.
 */
((Unchained) => {
    /**
     * @class BabelPlugin
     * @extends Unchained.Plugin
     */
    class BabelPlugin extends Unchained.Plugin {
        /**
         * @inheritdoc
         */
        get types() {
            return ['application/javascript', 'text/javascript'];
        }

        /**
         * @inheritdoc
         */
        test(file) {
            // check config.
            return (this.config.plugins || this.config.presets) && super.test(file);
        }

        /**
         * Transpile the code.
         *
         * @param {FileDefinition} file The input file.
         * @param {FileAnalysis} result The previous code analysis.
         * @return {Promise<FileAnalysis>} The transformed code analysis.
         */
        async transform(file, result) {
            // transform the code.
            return Unchained.transform(file.url, result, this.config);
        }
    }

    // register the plugin with `babel` name.
    Unchained.registerPlugin('babel', BabelPlugin);
})(self.Unchained);
