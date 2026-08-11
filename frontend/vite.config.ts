import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': proxyTarget,
      '/auth': proxyTarget,
      '/customers': proxyTarget,
      '/products': proxyTarget,
      '/stock': proxyTarget,
      '/challans': proxyTarget,
      '/dashboard': proxyTarget,
      '/uploads': proxyTarget,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
