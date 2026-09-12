// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, escrituras, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }))

import Clients from '../Clients'

const CLIENTES = [
  { id: 'c1', name: 'Marcos', phone: '123456789', rut: '12.345.678-9', email: 'marcos@gmail.com', currentDebt: 0 },
  { id: 'c2', name: 'Renato', phone: '213', currentDebt: 336468 },
  { id: 'c3', name: 'Santiago', phone: '', currentDebt: -1600 },
]

beforeEach(() => {
  resetFirebaseMock()
  coleccionesFake.clients = CLIENTES
})

describe('Clientes', () => {
  it('cards informativas', async () => {
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await screen.findByText('Marcos')
    const stat = (label) => within(screen.getByText(label).closest('div').parentElement).getByText((_, el) => el.classList.contains('font-mono'))
    expect(stat('Clientes')).toHaveTextContent('3')
    expect(stat('Con deuda')).toHaveTextContent('1')
    expect(stat('Deuda total')).toHaveTextContent('$336.468')
    expect(stat('Saldo a favor')).toHaveTextContent('$1.600')
  })

  it('busca por nombre, teléfono, RUT (sin puntos) y correo', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await screen.findByText('Marcos')
    const buscar = screen.getByPlaceholderText(/Buscar por nombre/)
    for (const [q, esperado] of [['ren', ['Renato']], ['213', ['Renato']], ['12345678', ['Marcos']], ['gmail', ['Marcos']]]) {
      await user.clear(buscar)
      await user.type(buscar, q)
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(esperado)
    }
  })

  it('click en un cliente navega a su detalle', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await user.click(await screen.findByText('Renato'))
    expect(navigate).toHaveBeenCalledWith('/clientes/c2')
  })

  it('nuevo cliente: teléfono numérico, RUT formateado, correo y foco estable', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /Nuevo/ }))
    const dlg = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })

    const nombre = within(dlg).getByPlaceholderText('Ej: Juan Pérez')
    const tel = within(dlg).getByPlaceholderText('Ej: +56 9 1234 5678')
    const rut = within(dlg).getByPlaceholderText('12.345.678-9')
    const mail = within(dlg).getByPlaceholderText('cliente@correo.cl')

    expect(nombre).toHaveFocus()
    await user.type(nombre, 'Ana')
    await user.type(tel, '+56 9abc 1234')
    expect(tel).toHaveValue('+56 9 1234')
    expect(tel).toHaveFocus()             // regresión: el foco no vuelve al nombre
    await user.type(rut, '15000005k')
    await user.tab()
    expect(rut).toHaveValue('15.000.005-K')
    await user.type(mail, 'ana@x.cl')

    await user.click(within(dlg).getByRole('button', { name: 'Crear Cliente' }))
    await waitFor(() => expect(escrituras.adds).toHaveLength(1))
    expect(escrituras.adds[0].data).toMatchObject({ name: 'Ana', phone: '+56 9 1234', rut: '15.000.005-K', email: 'ana@x.cl', currentDebt: 0 })
  })

  it('no crea sin nombre; Cancelar cierra', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Clients /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /Nuevo/ }))
    const dlg = await screen.findByRole('dialog', { name: 'Nuevo Cliente' })
    expect(within(dlg).getByRole('button', { name: 'Crear Cliente' })).toBeDisabled()
    await user.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(escrituras.adds).toHaveLength(0)
  })
})
