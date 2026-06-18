import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg"],
      manifest: {
        lang: "sk",
        name: "Lean Bulk Tracker",
        short_name: "Bulk Tracker",
        description: "Osobný lean-bulk dashboard a tréningový log",
        theme_color: "#121816",
        background_color: "#f4f7f5",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    css: true
  }
});
