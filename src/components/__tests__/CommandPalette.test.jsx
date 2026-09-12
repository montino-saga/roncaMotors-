// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Package } from 'lucide-react'
import { firestoreMock, coleccionesFake, emitirCatalogo, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }))
const setMode = vi.fn()
vi.mock('../../context/AppearanceContext', () => ({ useAppearance: () => ({ resolved: 'dark', setMode }) }))

import { CommandPalette } from '../CommandPalette'
import { invalidarClientes } from '../../lib/clientes'

const NAV = [
  { href: '/ventas', label: 'Punto de Venta', icon: Package },
  { href: '/productos', label: 'Productos', icon: Package },
]

const abrir = (onClose = vi.fn()) => {
  render(<MemoryRouter><CommandPalette open onClose={onClose} navItems={NAV} /></MemoryRouter>)
  return onClose
}

beforeEach(() => {
  resetFirebaseMock()
  invalidarClientes()
  coleccionesFake.clients = [{ id: 'c1', name: 'Marcos', rut: '12.345.678-9' }]
  emitirCatalogo([{ id: 'd1', idProducto: 'ABC123', nombreProducto: 'Monster Blanco', marcaProducto: 'Monster', precioVentaLocal: 1500 }])
})

describe('Paleta de comandos', () => {
  it('sin texto lista las vistas y la acción de tema', () => {
    abrir()
    expect(screen.getByRole('option', { name: /Punto de Venta/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /modo claro/i })).toBeInTheDocument()
  })

  it('encuentra productos del catálogo y navega a editar con Enter', async () => {
    const user = userEvent.setup()
    const onClose = abrir()
    await user.type(screen.getByRole('combobox'), 'mon')
    const op = await screen.findByRole('option', { name: /Monster Blanco/ })
    expect(op).toHaveTextContent('$1.500')
    expect(op).toHaveAttribute('aria-selected', 'true')   // primer resultado: las vistas no coinciden
    await user.keyboard('{Enter}')
    expect(onClose).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/editar/d1')
  })

  it('encuentra clientes por nombre o rut', async () => {
    const user = userEvent.setup()
    abrir()
    await user.type(screen.getByRole('combobox'), '12.345')
    await waitFor(() => expect(screen.getByRole('option', { name: /Marcos/ })).toBeInTheDocument())
  })

  it('flechas + Enter recorren la lista', async () => {
    const user = userEvent.setup()
    const onClose = abrir()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus())   // el foco llega tras la animación
    await user.keyboard('{ArrowDown}{Enter}')
    expect(navigate).toHaveBeenCalledWith('/productos')
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape cierra', async () => {
    const user = userEvent.setup()
    const onClose = abrir()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus())
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
