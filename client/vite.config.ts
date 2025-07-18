import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import { visualizer } from 'rollup-plugin-visualizer';
// import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: true,
    outDir: "./build",
    rollupOptions: { treeshake: true , output : {
      manualChunks(id) {
        if (id.includes("env-config.js")) {
          return "env-config.js"
        } else if (id.includes('node_modules')) {
            return 'vendor';
          }
      },
      chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === "env-config.js") {
            return "env-config.js";
          }
          return "[name]-[hash].js";
      }
    }},
  },
  plugins: [
    react(), 
    // visualizer({
    //   open: true, // Open the report in your browser
    //   filename: 'stats.html', // Save the report to a file
    // }),
    // VitePWA({ registerType: 'autoUpdate' })
  ],
});

