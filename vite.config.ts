import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/recipes': 'http://localhost:8000',
      '/import': 'http://localhost:8000',
      '/meal-plans': 'http://localhost:8000',
      '/today': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
