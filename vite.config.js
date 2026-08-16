import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'chrome61',
    cssTarget: 'chrome61',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        join: resolve(import.meta.dirname, 'join.html'),
      },
    }
  }
});
