import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En dev, le SPA tourne sur Vite et l'API FastAPI sur :8000 → on proxy les routes API.
// En prod (monolithe), FastAPI sert le build : même origine, pas de proxy.
const API_ROUTES = [
  '/analyze', '/me', '/profile', '/journey', '/narrate', '/immersive',
  '/library', '/artwork', '/photos', '/audio', '/immersive-audio', '/health',
]

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(API_ROUTES.map((p) => [p, 'http://localhost:8000'])),
  },
})
