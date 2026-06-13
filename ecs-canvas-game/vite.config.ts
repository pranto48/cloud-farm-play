import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  envDir: '../',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
});
