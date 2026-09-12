// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, coleccionesFake, emitirCatalogo, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ settings: { primaryColor: '#3b82f6' } }) }))
vi.mock('../../../context/AppearanceContext', () => ({ useAppearance: () => ({ resolved: 'dark' }) }))
import Dashboard from '../Dashboard'

const hoy = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d }
const venta = (over = {}) => ({
  id: Math.random().toString(36), fechaVenta: { toDate: () => hoy(10) }, totalVenta: 10000, totalGanancia: 2500, tipoPago: 'efectivo',
  productos: [{ nombreProducto: 'Cadena', cantidad: 2 }], ...over,
})

beforeEach(() => {
  resetFirebaseMock()
  coleccionesFake.sales = [venta(), venta({ tipoPago: 'fiado' }), venta({ tipoPago: 'abono', totalVenta: 5000 })]
  coleccionesFake.clients = [{ id: 'c1', currentDebt: 8000 }, { id: 'c2', currentDebt: 2000 }]
  emitirCatalogo([{ id: 'p1', cantidadProducto: 2 }, { id: 'p2', cantidadProducto: 50 }])
})

describe('Dashboard (bento)', () => {
  it('KPIs financieros y operativos', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const kpi = async (label) => (await screen.findByText(label)).parentElement
    expect(await kpi('Ingresos Reales')).toHaveTextContent('$15.000')     // efectivo + abono
    expect(await kpi('Ventas Fiadas')).toHaveTextContent('$10.000')
    expect(await kpi('Deuda Clientes')).toHaveTextContent('$10.000')
    expect(await kpi('Ganancia Estimada')).toHaveTextContent('$5.000')    // abono no suma
    expect(screen.getByText('Pedidos').nextSibling).toHaveTextContent('2')
    expect(screen.getByText('Stock Bajo').nextSibling).toHaveTextContent('1 prod.')
  })

  it('productos top y últimas ventas', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(await screen.findByText('Cadena')).toBeInTheDocument()
    expect(screen.getAllByText('1 items').length).toBe(3)
    expect(screen.getByText('fiado')).toBeInTheDocument()
  })
})
