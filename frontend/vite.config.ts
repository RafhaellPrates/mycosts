import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Em producao o Express serve front e API na mesma origem. Em dev o
    // front roda aqui e repassa /api para o back, mantendo a mesma origem.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
