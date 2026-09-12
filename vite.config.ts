import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

// ✅ Hostinger-optimized Vite configuration
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // ✅ Optimized for Hostinger Node.js apps
    outDir: 'dist',
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendors': ['react', 'react-dom'],
          'router': ['@tanstack/react-router'],
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    // ✅ For local development
    port: 5173,
    strictPort: false,
    middlewareMode: false,
  },
  ssr: {
    // ✅ Server-side rendering config
    external: ['fs', 'path', 'util'],
  },
})
