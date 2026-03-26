import { defineConfig } from 'vite';

export default defineConfig({
  base: '/geodemo-brasil/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet'],
          charts: ['chart.js'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
