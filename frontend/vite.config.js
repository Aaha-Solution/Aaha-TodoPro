import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_GATEWAY_URL || 'http://192.168.0.168:5000';


  return {
    plugins: [react()],
    assetsInclude: ['**/*.JPG', '**/*.jpg', '**/*.png', '**/*.PNG', '**/*.webp'],
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('preload-helper') || id.includes('commonjsHelpers')) {
              return 'vendor-react';
            }
            if (!id.includes('node_modules')) return;
            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/') || id.includes('\\react\\')) {
              return 'vendor-react';
            }
            if (id.includes('@reduxjs/toolkit') || id.includes('react-redux') || id.includes('redux')) {
              return 'vendor-redux';
            }
            if (id.includes('exceljs')) {
              return 'vendor-exceljs';
            }
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg') || id.includes('dompurify')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('crypto-js')) {
              return 'vendor-crypto';
            }
            if (id.includes('socket.io') || id.includes('engine.io')) {
              return 'vendor-socket';
            }
          },
        },
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
