// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// NativeWind v4 requires proper config merging
// Since we're using StyleSheet now, we can keep it simple

// Exclude Stripe from web builds (it uses native-only modules)
config.resolver = config.resolver || {};
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web, resolve @stripe/stripe-react-native to a web stub
  if (platform === 'web' && moduleName === '@stripe/stripe-react-native') {
    return {
      filePath: require.resolve('./lib/stripe-web-stub.js'),
      type: 'sourceFile',
    };
  }
  
  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

