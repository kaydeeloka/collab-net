import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':           resolve(__dirname, 'src'),
      '@lib':        resolve(__dirname, 'src/lib'),
      '@context':    resolve(__dirname, 'src/contexts'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages':      resolve(__dirname, 'src/pages'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-xlsx':    ['xlsx'],
          'vendor-jszip':   ['jszip'],
          'vendor-qrcode':  ['qrcode'],
        },
      },
    },
  },
})
