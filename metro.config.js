const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package.exports resolution — prevents Metro from picking up ESM
// entry points that contain webpack magic comments Hermes can't compile.
config.resolver.unstable_enablePackageExports = false;

// Also resolve @opentelemetry/* to empty modules as a belt-and-suspenders measure.
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
