import { defineConfig } from 'vite';

export default defineConfig({
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
  server: {
    proxy: {
      '/api/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        rewrite: () => '/NORAD/elements/gp.php?GROUP=active&FORMAT=TLE',
      },
    },
  },
});
