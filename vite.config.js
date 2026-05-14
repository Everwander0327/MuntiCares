import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
