import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', 
  server: {
    proxy: {
      // Cuando hagamos fetch a '/dump1090', Vite lo mandará a tu Raspberry
      '/dump1090': {
        target: 'http://192.168.2.29', // IP Raspberry Pi
        changeOrigin: true,
      }
    }
  }
})