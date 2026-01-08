module.exports = {
  expo: {
    name: "Ollie",
    slug: "ollie",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "ollie",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.foundry360.ollie",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.foundry360.ollie",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-video",
      "expo-web-browser",
      "expo-maps",
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.foundry360.ollie"
        }
      ]
    ],
    extra: {
      router: {},
      eas: {
        projectId: "19b6fc14-58c5-4f3d-a0bb-aa6981d4722e"
      }
    },
    owner: "foundry360"
  }
};














