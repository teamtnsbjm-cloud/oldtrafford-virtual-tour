import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative asset paths so the build works on any static host / sub-path
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // split the 3D engine into its own long-cached chunk
        manualChunks: (id) => (id.includes('node_modules/three') || id.includes('@react-three') ? 'engine' : undefined),
      },
    },
  },
})
