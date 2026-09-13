// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { firestoreMock, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
const logout = vi.fn(), setMode = vi.fn()
let resolved = 'dark'
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'admin@taller.cl' }, logout }) }))
vi.mock('../../context/AppearanceContext', () => ({ useAppearance: () => ({ resolved, setMode }) }))
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ settings: { businessName: 'Taller Norte', logo: '' }, loading: false }) }))
let escritorio = true
vi.mock('../../hooks/useMediaQuery', () => ({ useMediaQuery: () => escritorio }))
vi.mock('../CommandPalette', () => ({ CommandPalette: ({ open }) => open ? <div role="dialog">paleta</div> : null }))
import { Layout } from '../Layout'

const Ruta = () => <p>ruta: {useLocation().pathname}</p>
const montar = (ruta = '/ventas') => render(
  <MemoryRouter initialEntries={[ruta]}>
    <Layout><Routes><Route path="*" element={<Ruta />} /></Routes></Layout>
  </MemoryRouter>
)

beforeEach(() => { resetFirebaseMock(); escritorio = true; resolved = 'dark' })

describe('Layout', () => {
  it('nav completa con secciones, marca y usuario; la ruta activa marcada', () => {
    montar('/gastos')
    for (const l of ['Cierre de Caja', 'Punto de Venta', 'Clientes', 'Pedidos Web', 'Gastos', 'Productos', 'Crear Producto', 'Dashboard', 'Análisis', 'Historial', 'Configuración']) {
      expect(screen.getByRole('link', { name: new RegExp(l) })).toBeInTheDocument()
    }
    expect(screen.getByText('Taller Norte')).toBeInTheDocument()
    expect(screen.getByText('admin@taller.cl')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Gastos/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('ruta: /gastos')).toBeInTheDocument()
  })

  it('navegar por el menú cambia la vista', async () => {
    const user = userEvent.setup()
    montar('/ventas')
    await user.click(screen.getByRole('link', { name: /Análisis/ }))
    expect(screen.getByText('ruta: /analisis')).toBeInTheDocument()
  })

  it('Ctrl+K y el botón Buscar abren la paleta', async () => {
    const user = userEvent.setup()
    montar()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('dialog')).toHaveTextContent('paleta')
  })

  it('plegar menú persiste en localStorage', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByTitle('Plegar menú'))
    expect(JSON.parse(localStorage.getItem('roncamotors_nav_collapsed'))).toBe(true)
    expect(screen.getByTitle('Expandir menú')).toBeInTheDocument()
  })

  it('tema y cerrar sesión', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }))
    expect(setMode).toHaveBeenCalledWith('light')
    await user.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(logout).toHaveBeenCalled()
  })

  it('móvil: barra superior con menú, buscador y acción rápida de la vista', async () => {
    escritorio = false
    const user = userEvent.setup()
    montar('/productos')
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Crear producto' })).toHaveAttribute('href', '/crear')
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')
  })
})
