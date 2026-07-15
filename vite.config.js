import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['Chrome >= 61', 'Android >= 8'],
      modernTargets: ['Chrome >= 61', 'Android >= 8'],
      renderLegacyChunks: true,
      modernPolyfills: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2015',
    cssTarget: 'chrome61'
  }
});
