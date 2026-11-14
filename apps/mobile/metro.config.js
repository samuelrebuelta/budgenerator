// Metro in the pnpm monorepo. Expo's default config already watches the workspace root and
// resolves `node_modules` from the app and the root, and honours package `exports`, so
// `@bg/domain` and `@bg/ui-tokens` load straight from their TypeScript sources.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The workspace packages follow NodeNext style (`./budgetMath.js` pointing at `budgetMath.ts`).
// Metro does not map that extension, so retry relative `.js` imports as TypeScript.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName, platform);
    } catch {
      return resolve(context, moduleName.replace(/\.js$/, ''), platform);
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
