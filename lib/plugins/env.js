((Unchained) => {
    const envPlugin = function({ types }) {
        return {
            visitor: {
                MemberExpression(path) {
                    if (path.get('object').matchesPattern('process.env')) {
                        const key = path.toComputedKey();
                        if (types.isStringLiteral(key)) {
                            path.replaceWith(types.valueToNode(null));
                        }
                    }
                },
            },
        };
    };

    class ENVPlugin extends Unchained.Plugin {
        test(file) {
            return file.content.match(/process\.env/) && super.test(file);
        }

        async transform(file, result) {
            return Unchained.transform(file.url, result, {
                plugins: [envPlugin],
            });
        }
    }

    Unchained.registerPlugin('env', ENVPlugin);
})(self.Unchained);
