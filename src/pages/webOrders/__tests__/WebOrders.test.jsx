// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { toast } from 'sonner'
import WebOrders from '../WebOrders'

const pedido = (id, over = {}) => ({
  id, fechaVenta: { toDate: () => new Date('2026-09-10T15:30') }, totalVenta: 25000, tipoPago: 'efectivo', estado: 'pendiente',
  cliente: { nombre: 'Ana Web', email: 'ana@web.cl', telefono: '+56911111111' },
  productos: [{ nombreProducto: 'Casco', cantidad: 1, precioVentaWeb: 25000 }], ...over,
})

beforeEach(() => {
  resetFirebaseMock()
  coleccionesFake.salesWeb = [pedido('abcdef12'), pedido('zzzz9999', { estado: 'completado', cliente: null, totalVenta: 1000 })]
})

describe('Pedidos web', () => {
  it('lista en tiempo real con cliente, estado y total', async () => {
    render(<MemoryRouter><WebOrders /></MemoryRouter>)
    expect(await screen.findByText('Ana Web')).toBeInTheDocument()
    expect(screen.getByText('Cliente Web')).toBeInTheDocument()
    expect(screen.getByText('completado')).toBeInTheDocument()
    expect(screen.getByText('$25.000')).toBeInTheDocument()
  })

  it('abre el detalle con datos del cliente y productos', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><WebOrders /></MemoryRouter>)
    const fila = (await screen.findByText('Ana Web')).closest('tr')
    await user.click(within(fila).getByTitle('Ver Detalle'))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText(/Detalle de Pedido Web #abcdef12/)).toBeInTheDocument()
    expect(within(modal).getByText('ana@web.cl')).toBeInTheDocument()
    expect(within(modal).getByText('Casco')).toBeInTheDocument()
  })

  it('error del listener avisa con toast', async () => {
    firestoreMock.onSnapshot.mockImplementationOnce((_q, _ok, err) => { err(new Error('boom')); return () => {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<MemoryRouter><WebOrders /></MemoryRouter>)
    await act(async () => {})
    expect(toast.error).toHaveBeenCalledWith('No se pudieron cargar los pedidos web')
  })
})
