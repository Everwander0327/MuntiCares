/* eslint-env node */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(process.env.VITE_HTTPS === 'true' ? [basicSsl()] : []),
  ],
  server: {
    ...(process.env.VITE_HTTPS === 'true' ? { https: true } : {}),
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          vendorUi: ['framer-motion', 'lucide-react', 'react-hot-toast'],
          vendorData: ['@supabase/supabase-js', '@hookform/resolvers', 'react-hook-form', 'zod'],
          vendorMedical: ['jspdf'],
          vendorJitsi: ['@jitsi/react-sdk'],
        },
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
