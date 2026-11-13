// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, coleccionesFake, emitirCatalogo, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ settings: { primaryColor: '#3b82f6' } }) }))
vi.mock('../../../context/AppearanceContext', () => ({ useAppearance: () => ({ resolved: 'dark' }) }))
import Dashboard from '../Dashboard'

const hoy = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d }
const ts = (d) => ({ toDate: () => d })
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const venta = (over = {}) => ({
  id: Math.random().toString(36), fechaVenta: { toDate: () => hoy(10) }, totalVenta: 10000, totalGanancia: 2500, tipoPago: 'efectivo',
  productos: [{ nombreProducto: 'Cadena', cantidad: 2 }], ...over,
})

beforeEach(() => {
  resetFirebaseMock()
  coleccionesFake.sales = [venta(), venta({ tipoPago: 'fiado' }), venta({ tipoPago: 'abono', totalVenta: 5000 })]
  coleccionesFake.clients = [
    { id: 'c1', name: 'Ana', currentDebt: 8000, patente: 'ABCD-12', createdAt: ts(hoy(9)) },
    { id: 'c2', name: 'Beto', currentDebt: 2000, createdAt: ts(hoy(9)) },
    { id: 'c3', name: 'Caro', currentDebt: 0, createdAt: ts(hoy(9)) },
  ]
  coleccionesFake.gastos = [
    { id: 'g1', monto: 30000, categoria: 'arriendo', descripcion: 'Local', fecha: ts(hoy(9)) },
    { id: 'g2', monto: 10000, categoria: 'insumos', descripcion: 'Guantes', fecha: ts(hoy(9)) },
  ]
  emitirCatalogo([
    { id: 'p1', idProducto: 'A1', nombreProducto: 'Cadena', categoriaProducto: 'Transmisión', cantidadProducto: 2, precioOriginal: 1000, precioVentaLocal: 2000 },
    { id: 'p2', idProducto: 'A2', nombreProducto: 'Aceite', categoriaProducto: 'Lubricantes', cantidadProducto: 50, precioOriginal: 2000, precioVentaLocal: 4000 },
  ])
})

describe('Dashboard (bento)', () => {
  it('KPIs financieros y operativos', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const kpi = async (label) => (await screen.findByText(label)).closest('.card-entra')
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
    // El abono se rotula como abono, no como una venta de "1 items".
    expect(screen.getAllByText('1 items').length).toBe(2)
    expect(screen.getByText(/^Abono/)).toBeInTheDocument()
    expect(screen.getByText('fiado')).toBeInTheDocument()
  })
})

describe('Dashboard (pestañas)', () => {
  const kpi = async (label) => (await screen.findByText(label)).closest('.card-entra')

  it('las fechas personalizadas no aceptan futuro y solo consultan al aplicar', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    await user.selectOptions(await screen.findByRole('combobox'), 'custom')
    const desde = screen.getByLabelText('Desde')
    expect(desde).toHaveAttribute('max', hoyISO())
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('max', hoyISO())

    // Rango a medio escribir: el botón no deja disparar la consulta.
    await user.type(desde, hoyISO())
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
  })

  it('productos: inventario del catálogo', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await user.click(await screen.findByRole('tab', { name: 'Productos' }))

    expect(await kpi('Unidades en Stock')).toHaveTextContent('52')
    expect(await kpi('Inventario a Costo')).toHaveTextContent('$102.000')   // 2·1000 + 50·2000
    expect(await kpi('Inventario a Venta')).toHaveTextContent('$204.000')
    expect(screen.getByText('Sin Stock').nextSibling).toHaveTextContent('0 prod.')
    expect(screen.getByText('Stock Bajo').nextSibling).toHaveTextContent('1 prod.')
  })

  it('gastos: total del rango y balance contra ingresos', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await user.click(await screen.findByRole('tab', { name: 'Gastos' }))

    expect(await kpi('Gastos del Período')).toHaveTextContent('$40.000')
    expect(await kpi('Balance')).toHaveTextContent('−$25.000')              // 15.000 − 40.000
    expect(await kpi('Mayor Categoría')).toHaveTextContent('Arriendo')
    expect(screen.getByText('Local')).toBeInTheDocument()
  })

  it('clientes: deuda y morosidad', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    await user.click(await screen.findByRole('tab', { name: 'Clientes' }))

    expect(screen.getByText('Con Deuda').closest('.card-entra')).toHaveTextContent('2')
    expect(await kpi('Deuda Total')).toHaveTextContent('$10.000')
    expect(await kpi('Deuda Promedio')).toHaveTextContent('$5.000')
    expect(screen.getByText('Morosidad').nextSibling).toHaveTextContent('67%')
  })
})
