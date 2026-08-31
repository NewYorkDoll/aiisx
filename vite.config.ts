import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/rss.xml': { target: 'http://localhost:8787', rewrite: () => '/api/rss.xml' },
      '/sitemap.xml': { target: 'http://localhost:8787', rewrite: () => '/api/sitemap.xml' },
    },
  },
})
