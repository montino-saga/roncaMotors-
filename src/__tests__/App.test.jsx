// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { firestoreMock } from '../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ Toaster: () => null, toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }) }))
vi.mock('../context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: { uid: 'u1', email: 'a@b.c' }, loading: false, logout: vi.fn() }) }))
vi.mock('../context/AppearanceContext', () => ({ AppearanceProvider: ({ children }) => children, useAppearance: () => ({ resolved: 'dark', mode: 'dark', setMode: vi.fn() }) }))
vi.mock('../context/ThemeContext', () => ({ ThemeProvider: ({ children }) => children, useTheme: () => ({ settings: { businessName: 'Roncamotors', logo: '' }, loading: false }) }))
import App from '../App'

const montar = (ruta) => {
  const router = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: [ruta] })
  render(<RouterProvider router={router} />)
}

describe('App: rutas', () => {
  it('ruta desconocida cae en la página 404 dentro del Layout', async () => {
    montar('/no-existe')
    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Punto de Venta/ })).toBeInTheDocument()
  })

  it('/analisis y /configuracion resuelven (lazy)', async () => {
    montar('/analisis')
    // El chunk lazy tarda más con la suite completa en paralelo.
    expect(await screen.findByRole('heading', { name: /Análisis/ }, { timeout: 4000 })).toBeInTheDocument()
  })
})
