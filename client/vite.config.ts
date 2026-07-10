import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Allow any Host header so public tunnels (ngrok/cloudflare) aren't blocked.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
