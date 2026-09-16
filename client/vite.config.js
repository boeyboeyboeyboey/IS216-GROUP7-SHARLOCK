import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  // Read local connection settings in the build process only. Never expose server
  // environment values with `define` or a client-side environment prefix.
  const env = loadEnv(mode, fileURLToPath(new URL('../server', import.meta.url)), '')
  const origin = new URL(process.env.CLIENT_ORIGIN || env.CLIENT_ORIGIN || 'http://localhost:5173')
  const apiPort = process.env.PORT || env.PORT || '3000'

  return {
    plugins: [vue()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: origin.hostname === '[::1]' ? '::1' : origin.hostname,
      port: Number(origin.port || 80),
      strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${apiPort}` } },
    },
  }
})
