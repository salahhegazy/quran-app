import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0
  },
  server: {
    port: 3000,
    host: true
  }
});
