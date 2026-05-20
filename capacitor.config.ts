import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.idledungeonlife.app",
  appName: "Idle Dungeon Life",
  webDir: "dist",
  // Server config is only used during development live-reload
  // Remove or comment out for production builds
  // server: {
  //   url: "http://192.168.x.x:5173",
  //   cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0d0d0d",
      showSpinner: false,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#0d0d0d",
    },
  },
  android: {
    // Prevent soft keyboard from resizing the game view
    windowSoftInputMode: "adjustNothing",
  },
  ios: {
    // Required for iPhone notch / Dynamic Island handling
    contentInset: "always",
  },
};

export default config;
