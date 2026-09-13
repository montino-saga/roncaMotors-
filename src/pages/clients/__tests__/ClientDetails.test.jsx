// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { firestoreMock, escrituras, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }))
import { toast } from 'sonner'
import ClientDetails from '../ClientDetails'

const CLIENTE = { name: 'Renato', phone: '987654321', rut: '12.345.678-5', currentDebt: 50000 }
const ts = (iso) => ({ toDate: () => new Date(iso), seconds: 0 })

const montar = () => render(
  <MemoryRouter initialEntries={['/clientes/c1']}>
    <Routes><Route path="/clientes/:id" element={<ClientDetails />} /></Routes>
  </MemoryRouter>
)

beforeEach(() => {
  resetFirebaseMock()
  firestoreMock.getDoc.mockResolvedValue({ exists: () => true, id: 'c1', data: () => CLIENTE })
  coleccionesFake['clients/c1/movements'] = [
    { id: 'm1', type: 'debt', amount: 50000, date: ts('2026-09-01T10:00'), note: 'Venta fiada', productos: [{ nombreProducto: 'Kit arrastre', cantidad: 1 }] },
  ]
})

describe('Detalle de cliente', () => {
  it('muestra datos y deuda actual', async () => {
    montar()
    expect(await screen.findByText('Renato')).toBeInTheDocument()
    expect(screen.getByText('Deuda Actual').parentElement).toHaveTextContent('$50.000')
  })

  it('abono: batch con venta-abono, movimiento y deuda descontada; UI optimista', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('Renato')
    await user.click(screen.getByRole('button', { name: /ABONAR/ }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByRole('button', { name: 'Confirmar Abono' })).toBeDisabled()
    await user.type(within(modal).getByPlaceholderText('Ej: 5000'), '20000')
    await user.click(within(modal).getByText('Tarjeta'))
    await user.click(within(modal).getByRole('button', { name: 'Confirmar Abono' }))

    await waitFor(() => expect(escrituras.updates.some(u => u.ref === 'clients/c1')).toBe(true))
    const venta = escrituras.sets.find(s => s.ref.startsWith('sales/'))
    expect(venta.data).toMatchObject({ isAbono: true, tipoPago: 'tarjeta', totalVenta: 20000, totalGanancia: 0, idCliente: 'c1' })
    const mov = escrituras.sets.find(s => s.ref.startsWith('clients/c1/movements/'))
    expect(mov.data).toMatchObject({ type: 'payment', amount: 20000, paymentMethod: 'tarjeta' })
    expect(escrituras.updates.find(u => u.ref === 'clients/c1').data.currentDebt).toBe(30000)
    expect(screen.getByText('Deuda Actual').parentElement).toHaveTextContent('$30.000')
    expect(toast.success).toHaveBeenCalledWith('Abono registrado correctamente', expect.anything())
  })

  it('cliente inexistente: avisa y vuelve', async () => {
    firestoreMock.getDoc.mockResolvedValue({ exists: () => false })
    montar()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Cliente no encontrado'))
    expect(navigate).toHaveBeenCalledWith('/clientes')
  })
})
