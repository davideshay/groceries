import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "./build",
    rollupOptions: { treeshake: true , output : {
      manualChunks : (id) => {
        if (id.includes('lodash-es')) return 'lodash-es';
        if (id.includes('pouchdb')) return 'pouchdb';
        if (id.includes('jszip')) return 'jszip';
        if (id.includes('locales')) return 'locales';
        if (id.includes('react')) return 'react';
        if (id.includes('i18next')) return 'i18next';
        if (id.includes('react-router')) return 'react-router';
        if (id.includes('modal')) return 'modal';
        if (id.includes('ion-input')) return 'ion-input';
        if (id.includes('popover')) return 'popover';
        if (id.includes('toast')) return 'toast';
        if (id.includes('alert')) return 'alert';
        if (id.includes('ion-searchbar')) return 'ion-searchbar';
        if (id.includes('overlays')) return 'overlays';
        if (id.includes('ion-select')) return 'ion-select';
        if (id.includes('ion-textarea')) return 'ion-textarea';
        if (id.includes('@ionic/core/components')) return 'ionic-core';
      }
    }},
  },
  plugins: [react(), VitePWA({ registerType: 'autoUpdate' })],
});
