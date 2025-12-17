module.exports = function(api) {
  api.cache(true);
  const nativewindBabel = require('react-native-css-interop/babel');
  const nativewindConfig = nativewindBabel();
  // Filter out null plugins and ensure all plugins are valid
  // Note: babel-preset-expo automatically adds react-native-reanimated/plugin
  // so we don't need to add it manually
  const plugins = (nativewindConfig.plugins || []).filter(plugin => plugin !== null);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: plugins
  };
};

