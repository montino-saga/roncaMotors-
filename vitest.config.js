import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'node',
    // Los tests de componentes (.test.jsx) corren en jsdom.
    environmentMatchGlobs: [['src/**/*.test.jsx', 'jsdom']],
    setupFiles: ['src/test/setup.js'],
  },
})
