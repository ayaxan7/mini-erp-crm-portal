import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:4000',
      '/auth': 'http://localhost:4000',
      '/customers': 'http://localhost:4000',
      '/products': 'http://localhost:4000',
      '/stock': 'http://localhost:4000',
      '/challans': 'http://localhost:4000',
      '/dashboard': 'http://localhost:4000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});