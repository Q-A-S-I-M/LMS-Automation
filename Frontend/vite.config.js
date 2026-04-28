import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy agent-chatbot so the browser stays on :5173 and session cookies work (same-site).
    proxy: {
      '/chat-api': {
        target: 'http://localhost:7000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chat-api/, ''),
      },
    },
  },
})
