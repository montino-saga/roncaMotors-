import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  try { localStorage.clear() } catch { /* node env */ }
})

if (typeof window !== 'undefined') {
  // jsdom no trae matchMedia (framer-motion useReducedMotion) ni scrollTo.
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  Element.prototype.scrollTo = Element.prototype.scrollTo || function () {}
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {}
  // La animación de salida de AnimatePresence no interesa en tests.
  window.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0))
  // Layout y recharts miden con ResizeObserver; en jsdom basta un doble inerte.
  window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} }
}
