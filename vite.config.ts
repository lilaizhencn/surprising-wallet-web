/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/custody': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/')
            || id.includes('/react-router-dom/')) return 'vendor-react';
          if (id.includes('/antd/') || id.includes('/@ant-design/')
            || id.includes('/@rc-component/') || id.includes('/rc-')) return 'vendor-ui';
          if (id.includes('/@web3icons/')) return 'vendor-web3';
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    restoreMocks: true,
  },
});
