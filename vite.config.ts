import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      visualizer({
        open: false,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true
      })
    ],
    base: './',
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'lunar': ['lunar-javascript'],
            'recharts': ['recharts'],
            'lucide': ['lucide-react'],
            'react-vendor': ['react', 'react-dom']
          }
        }
      },
      chunkSizeWarningLimit: 600
    },
  };
});