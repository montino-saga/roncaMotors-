import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { 'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwaRegisterStub.js', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{js,jsx}', 'functions/**/*.test.js'],
    environment: 'node',
    // Los tests de componentes (.test.jsx) corren en jsdom.
    environmentMatchGlobs: [['src/**/*.test.jsx', 'jsdom']],
    setupFiles: ['src/test/setup.js'],
  },
})
