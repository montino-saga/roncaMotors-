// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { firestoreMock, escrituras, coleccionesFake, resetFirebaseMock, emitirCatalogo } from '../../../test/firebaseMock'

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

  it('abono mayor a la deuda: avisa y no deja confirmar; "Pagar todo" carga la deuda', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('Renato')
    await user.click(screen.getByRole('button', { name: /ABONAR/ }))
    const modal = await screen.findByRole('dialog')
    await user.type(within(modal).getByLabelText('Monto del Abono'), '60000')
    expect(within(modal).getByText(/Supera la deuda/)).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Confirmar Abono' })).toBeDisabled()
    await user.click(within(modal).getByRole('button', { name: 'Pagar todo' }))
    expect(within(modal).getByLabelText('Monto del Abono')).toHaveValue(50000)
    expect(within(modal).getByRole('button', { name: 'Confirmar Abono' })).toBeEnabled()
    expect(escrituras.sets).toHaveLength(0)
  })

  it('sin deuda, ABONAR queda deshabilitado', async () => {
    firestoreMock.getDoc.mockResolvedValue({ exists: () => true, id: 'c1', data: () => ({ ...CLIENTE, currentDebt: 0 }) })
    montar()
    await screen.findByText('Renato')
    expect(screen.getByRole('button', { name: /ABONAR/ })).toBeDisabled()
  })

  it('abono: batch con venta-abono, movimiento y deuda descontada; UI optimista', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('Renato')
    await user.click(screen.getByRole('button', { name: /ABONAR/ }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByRole('button', { name: 'Confirmar Abono' })).toBeDisabled()
    expect(modal).toHaveTextContent('Renato debe$50.000')
    await user.type(within(modal).getByLabelText('Monto del Abono'), '20000')
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

  it('devolución parcial de un fiado con descuento: movimiento, venta y deuda bajan en proporción', async () => {
    emitirCatalogo([{ id: 'pA', idProducto: 'A', nombreProducto: 'Coca', cantidadProducto: 5 }])
    coleccionesFake['clients/c1/movements'] = [{
      id: 'm2', type: 'purchase', amount: 3240, descuentoTotal: 360, saleId: 's1', date: ts('2026-11-10T10:00'),
      products: [{ idProducto: 'A', nombreProducto: 'Coca', cantidad: 2, precio: 1200 }, { idProducto: 'B', nombreProducto: 'Pepi', cantidad: 1, precio: 1200 }],
    }]
    const VENTA = { totalVenta: 3240, subtotal: 3600, descuentoTotal: 360, totalGanancia: 1000,
      productos: [{ idProducto: 'A', cantidad: 2, precioVentaLocal: 1200, precioOriginal: 800 }, { idProducto: 'B', cantidad: 1, precioVentaLocal: 1200, precioOriginal: 800 }] }
    firestoreMock.getDoc.mockImplementation(async (r) => r.path === 'sales/s1'
      ? { exists: () => true, id: 's1', data: () => VENTA }
      : { exists: () => true, id: 'c1', data: () => CLIENTE })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByText(/2 productos|3 productos/))
    await user.click(await screen.findByRole('button', { name: 'Devolver Coca' }))
    const modal = await screen.findByRole('dialog')
    await user.click(within(modal).getByRole('button', { name: /Confirmar Devolución/ }))

    // Subtotal 3.600 → 2.400; descuento 10%: 360 → 240; total 3.240 → 2.160 (baja 1.080).
    await waitFor(() => expect(escrituras.updates.some(u => u.ref === 'clients/c1')).toBe(true))
    expect(escrituras.updates).toContainEqual({ ref: 'productos/pA', data: { cantidadProducto: { __increment: 1 } } })
    const mov = escrituras.updates.find(u => u.ref === 'clients/c1/movements/m2')
    expect(mov.data).toMatchObject({ amount: 2160, descuentoTotal: 240 })
    expect(mov.data.products[0]).toMatchObject({ idProducto: 'A', cantidad: 1 })
    const venta = escrituras.updates.find(u => u.ref === 'sales/s1')
    expect(venta.data).toMatchObject({ subtotal: 2400, descuentoTotal: 240, totalVenta: 2160 })
    expect(venta.data.productos[0].cantidad).toBe(1)
    expect(escrituras.updates.find(u => u.ref === 'clients/c1').data.currentDebt).toBe(50000 - 1080)
    firestoreMock.getDoc.mockReset()
  })
})
