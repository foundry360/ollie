module.exports = {
  dependencies: {
    // Exclude Sentry from auto-linking on iOS due to RCT-Folly dependency issue
    // Sentry code will still work at runtime, but won't be linked during build
    'sentry-expo': {
      platforms: {
        ios: null, // disable iOS platform, auto-link will skip this
      },
    },
  },
};

