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
    sourcemap: false, // Prevents original source code from being visible in the browser
    minify: true,    // Ensures code is compressed and obfuscated
    rollupOptions: {
      output: {
        manualChunks: undefined, // Default behavior
      }
    }
  }
})
