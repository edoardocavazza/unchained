((Unchained) => {
    class TextPlugin extends Unchained.Plugin {
        get types() {
            return ['text/'];
        }

        async transform(file, result) {
            if (!result.ast) {
                let escaped = result.code.replace(/`/g, '\\`');
                return Unchained.transform(file.url, {
                    code: `export default \`${escaped}\``,
                });
            }
            return result;
        }
    }

    Unchained.registerPlugin('text', TextPlugin);
})(self.Unchained);
