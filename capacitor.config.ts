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
    // Target API 34 (Android 14) — matches default from `cap add android`
    minWebViewVersion: 60,
  },
};

export default config;
