import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import cabecalhosSeguranca from './cabecalhos-seguranca.json' with { type: 'json' }
import { seo } from './seo.ts'

// Em desenvolvimento, /api/* vai para o Flask (porta 5000) sem o prefixo.
// Assim o navegador fala com uma origem só e não precisamos de CORS no back-end.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), seo(loadEnv(mode, import.meta.dirname).VITE_SITE_URL)],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { proxy: proxyApi() },
  // `npm run preview` serve o build com os mesmos cabeçalhos de produção (CSP etc.),
  // para pegar no PC qualquer coisa que a política bloquearia no ar.
  preview: { proxy: proxyApi(), headers: cabecalhosSeguranca },
}))

function proxyApi() {
  return {
    '/api': {
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
      rewrite: (caminho: string) => caminho.replace(/^\/api/, ''),
    },
  }
}
