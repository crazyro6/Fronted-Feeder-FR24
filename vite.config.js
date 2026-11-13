import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// En local no hay Worker: /api se pide a la API pública de roypara.com (sin CORS, lo pasa este proxy).
// Con RADAR_PI=<ip-de-la-pi>, solo aircraft.json sale de la Pi (red local); receiver.json sigue
// saliendo de la API pública, porque el de la Pi trae la posición exacta de la antena.
const pi = process.env.RADAR_PI

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // se sirve desde roypara.com/radar/
  server: {
    proxy: {
      ...(pi && {
        '/api/aircraft.json': {
          target: `http://${pi}`,
          changeOrigin: true,
          rewrite: () => '/adsbx/data/aircraft.json',
        },
      }),
      '/api': { target: 'https://roypara.com', changeOrigin: true },
    },
  },
})
