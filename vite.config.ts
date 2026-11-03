import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    // Assets are already optimised WebP; never inline them as base64.
    assetsInlineLimit: 0,
  },
});
