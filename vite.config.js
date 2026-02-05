/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/NEM': {
        target: 'https://dashboards.public.aemo.com.au',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  test: {
    environment: 'node',
  },
});
