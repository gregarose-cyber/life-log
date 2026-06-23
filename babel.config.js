module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip webpack magic comments (e.g. /* webpackIgnore: true */) from
      // dynamic imports — Metro does not support them and throws a parse error.
      function stripWebpackComments() {
        return {
          visitor: {
            CallExpression(path) {
              if (path.node.callee.type === 'Import') {
                path.node.arguments.forEach((arg) => {
                  if (arg.leadingComments) arg.leadingComments = [];
                  if (arg.innerComments) arg.innerComments = [];
                  if (arg.trailingComments) arg.trailingComments = [];
                });
              }
            },
          },
        };
      },
    ],
  };
};
