((Unchained) => {
    class JSONPlugin extends Unchained.Plugin {
        get types() {
            return ['application/json', 'text/json'];
        }

        transform(file, result) {
            if (!result.ast) {
                return Unchained.transform(file.url, {
                    code: `export default ${result.code}`,
                });
            }
            return result;
        }
    }

    Unchained.registerPlugin('json', JSONPlugin);
})(self.Unchained);
