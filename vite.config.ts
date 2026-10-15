import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Keep our hand-crafted manifest.json in public/; only generate the SW
      manifest: false,
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}"],
        // App is local-first (IndexedDB) — cache everything for offline use
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router") || id.includes("scheduler") || id.match(/node_modules\/react(-dom)?\//)) return "vendor-react";
          if (id.includes("@radix-ui") || id.includes("vaul") || id.includes("cmdk") || id.includes("sonner")) return "vendor-ui";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("dexie")) return "vendor-dexie";
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) return "vendor-forms";
          return undefined;
        },
      },
    },
  },
}));
