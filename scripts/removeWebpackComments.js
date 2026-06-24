// Babel plugin that strips webpack magic comments (e.g. /* webpackIgnore: true */)
// from dynamic import() calls. Hermes (React Native's JS engine) cannot compile
// these comments and throws "Invalid expression encountered" in production builds.
module.exports = function removeWebpackComments() {
  function clearWebpackComments(node) {
    if (!node) return;
    const filter = (arr) =>
      Array.isArray(arr) ? arr.filter((c) => !c.value.includes('webpack')) : arr;
    node.leadingComments = filter(node.leadingComments);
    node.innerComments = filter(node.innerComments);
    node.trailingComments = filter(node.trailingComments);
  }

  return {
    visitor: {
      // Babel 7+: dynamic import() is an ImportExpression
      ImportExpression(path) {
        clearWebpackComments(path.node);
        clearWebpackComments(path.node.source);
      },
      // Older Babel: dynamic import() is a CallExpression with callee.type === 'Import'
      CallExpression(path) {
        if (path.node.callee.type === 'Import') {
          clearWebpackComments(path.node);
          path.node.arguments?.forEach(clearWebpackComments);
        }
      },
    },
  };
};
