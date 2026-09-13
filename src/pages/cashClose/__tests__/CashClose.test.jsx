// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, escrituras, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }))
import { toast } from 'sonner'
import CashClose from '../CashClose'

const ts = (d = new Date()) => ({ toDate: () => d, seconds: Math.floor(d / 1000) })
const sesionAbierta = (over = {}) => ({ id: 'cr1', status: 'open', openingBalance: 20000, openingTime: ts(), movements: [], ...over })

beforeEach(() => {
  resetFirebaseMock()
  coleccionesFake.cash_registers = []
  coleccionesFake.sales = []
})

describe('Caja cerrada', () => {
  it('pide fondo inicial y abre la sesión', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CashClose /></MemoryRouter>)
    expect(await screen.findByText('Fondo Inicial')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir Caja' }))
    expect(toast.error).toHaveBeenCalledWith('Ingresa un monto válido')
    await user.type(screen.getByPlaceholderText('0'), '15000')
    await user.click(screen.getByRole('button', { name: 'Abrir Caja' }))
    await waitFor(() => expect(escrituras.adds).toHaveLength(1))
    expect(escrituras.adds[0]).toMatchObject({ coll: 'cash_registers', data: { status: 'open', openingBalance: 15000, userId: 'u1', movements: [] } })
    expect(await screen.findByText('Control de Caja')).toBeInTheDocument()
  })
})

describe('Caja abierta', () => {
  beforeEach(() => {
    coleccionesFake.cash_registers = [sesionAbierta()]
    coleccionesFake.sales = [
      { id: 's1', tipoPago: 'efectivo', totalVenta: 5000, fechaVenta: ts() },
      { id: 's2', tipoPago: 'tarjeta', totalVenta: 99999, fechaVenta: ts() },   // no cuenta en efectivo
    ]
  })

  it('resumen: fondo + ventas efectivo = esperado', async () => {
    render(<MemoryRouter><CashClose /></MemoryRouter>)
    await screen.findByText('Control de Caja')
    const stat = (label) => screen.getByText(label).parentElement
    expect(stat('Saldo Inicial')).toHaveTextContent('$20.000')
    expect(stat('Ventas Efectivo')).toHaveTextContent('$5.000')
    expect(stat('Total Esperado')).toHaveTextContent('$25.000')
  })

  it('registra un gasto de caja chica y lo suma a la sesión', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CashClose /></MemoryRouter>)
    await screen.findByText('Control de Caja')
    await user.click(screen.getByRole('button', { name: /Gasto\/Retiro/ }))
    const modal = screen.getByRole('dialog')
    await user.type(within(modal).getByPlaceholderText('0'), '3000')
    await user.type(within(modal).getByPlaceholderText(/Pago proveedor/), 'Pan')
    await user.click(within(modal).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(1))
    expect(escrituras.updates[0].ref).toBe('cash_registers/cr1')
    expect(escrituras.updates[0].data.movements[0]).toMatchObject({ type: 'expense', amount: 3000, description: 'Pan' })
    expect(await screen.findByText('Pan')).toBeInTheDocument()
    expect(screen.getByText('Total Esperado').parentElement).toHaveTextContent('$22.000')
  })

  it('no deja retirar más de lo que hay en caja', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CashClose /></MemoryRouter>)
    await screen.findByText('Control de Caja')
    await user.click(screen.getByRole('button', { name: /Gasto\/Retiro/ }))
    const modal = screen.getByRole('dialog')
    await user.type(within(modal).getByPlaceholderText('0'), '30000')
    await user.type(within(modal).getByPlaceholderText(/Pago proveedor/), 'Mucho')
    await user.click(within(modal).getByRole('button', { name: 'Guardar' }))
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/No hay saldo suficiente/))
    expect(escrituras.updates).toHaveLength(0)
  })

  it('cierre: muestra la diferencia, confirma y guarda el corte', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CashClose /></MemoryRouter>)
    await screen.findByText('Control de Caja')
    await user.click(screen.getByRole('button', { name: 'Realizar Cierre de Caja' }))   // sin monto: deshabilitado
    const cierre = screen.getByText('Cierre de Caja (Corte Z)').closest('.card-entra')
    await user.type(within(cierre).getByPlaceholderText('0'), '24000')
    expect(within(cierre).getByText('$-1.000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Realizar Cierre de Caja' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar Cierre' }))
    await waitFor(() => expect(escrituras.updates).toHaveLength(1))
    expect(escrituras.updates[0]).toMatchObject({
      ref: 'cash_registers/cr1',
      data: { status: 'closed', closingBalance: 24000, expectedBalance: 25000, cashSales: 5000, difference: -1000 },
    })
    expect(await screen.findByText('Fondo Inicial')).toBeInTheDocument()
  })
})
