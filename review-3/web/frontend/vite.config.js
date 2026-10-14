import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The browser calls /api/*; Vite forwards it to the Flask backend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:5050'
  const proxy = { '/api': { target, changeOrigin: true } }
  return {
    // '/' locally; '/DBMS_PBL/' on GitHub Pages (set by the deploy workflow via VITE_BASE)
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'scroll'
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'motion'
            if (id.includes('node_modules/react')) return 'react'
          },
        },
      },
    },
  }
})
