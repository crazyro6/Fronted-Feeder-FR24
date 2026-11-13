import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', 
  server: {
    proxy: {
      // Cuando hagamos fetch a '/adsbx', Vite lo mandará a tu Raspberry
      '/adsbx': {
        target: 'http://192.168.1.134', // IP Raspberry Pi
        changeOrigin: true,
      }
    }
  }
})