const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// OpenTelemetry packages use dynamic import() with webpack magic comments
// (e.g. /* webpackIgnore: true */) that Metro cannot parse. Since OTel is not
// needed in React Native, resolve all @opentelemetry/* imports to empty modules.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@opentelemetry/')) {
    return { type: 'empty' };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
