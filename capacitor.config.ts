import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.virtuoso.practicejournal",
  appName: "Virtuoso",
  webDir: "dist",
  server: {
    // Use https scheme on Android for modern WebView features (IndexedDB, etc.)
    androidScheme: "https",
  },
  android: {
    minWebViewVersion: 60,
    edgeToEdge: true,
  },
};

export default config;
