// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ settings: { primaryColor: '#3b82f6' } }) }))
vi.mock('../../../context/AppearanceContext', () => ({ useAppearance: () => ({ resolved: 'dark' }) }))
import { toast } from 'sonner'
import Analisis from '../Analisis'

const hace = (dias, hora = 11) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(hora, 0, 0, 0); return d }
const venta = (fecha, over = {}) => ({
  id: `${fecha.getTime()}-${Math.random()}`, fechaVenta: { toDate: () => fecha }, totalVenta: 10000, totalGanancia: 3000, tipoPago: 'efectivo',
  productos: [{ nombreProducto: 'A', cantidad: 1, precioVentaLocal: 10000, precioOriginal: 7000 }], ...over,
})

beforeEach(() => {
  resetFirebaseMock()
  // Actual (últimos 7 días): 3 ventas; previo (7 días antes): 1 venta → +200%
  coleccionesFake.sales = [venta(hace(0)), venta(hace(1)), venta(hace(2), { tipoPago: 'fiado' }), venta(hace(9))]
  coleccionesFake.clients = []
  localStorage.setItem('roncamotors_analisis_dias', '7')
})

describe('Análisis', () => {
  it('KPIs con delta contra el período previo', async () => {
    render(<MemoryRouter><Analisis /></MemoryRouter>)
    expect(await screen.findByText('$30.000')).toBeInTheDocument()   // ventas actuales
    expect(screen.getByText('$9.000')).toBeInTheDocument()            // ganancia
    expect(screen.getAllByText('+200%').length).toBeGreaterThan(0)    // ventas y pedidos
  })

  it('insights: subida y fiado', async () => {
    render(<MemoryRouter><Analisis /></MemoryRouter>)
    expect(await screen.findByText(/Ventas suben 200%/)).toBeInTheDocument()
    expect(screen.getByText(/33% de lo vendido salió fiado/)).toBeInTheDocument()
  })

  it('heatmap: celdas con título día/hora/pedidos', async () => {
    render(<MemoryRouter><Analisis /></MemoryRouter>)
    await screen.findByText('$30.000')
    const calientes = document.querySelectorAll('[title*=" 11:00 · 1 pedidos"]')
    expect(calientes.length).toBe(3)
  })

  it('cambia de rango y persiste', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Analisis /></MemoryRouter>)
    await screen.findByText('$30.000')
    await user.click(screen.getByRole('radio', { name: '30 días' }))
    expect(screen.getByRole('radio', { name: '30 días' })).toHaveAttribute('aria-checked', 'true')
    expect(JSON.parse(localStorage.getItem('roncamotors_analisis_dias'))).toBe(30)
    expect(await screen.findByText('$40.000')).toBeInTheDocument()   // las 4 caen en 30 días
  })

  it('error de carga avisa con toast', async () => {
    firestoreMock.getDocs.mockRejectedValueOnce(new Error('sin permisos'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<MemoryRouter><Analisis /></MemoryRouter>)
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('No se pudieron cargar los datos de análisis'))
  })
})
