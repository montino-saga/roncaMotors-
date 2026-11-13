// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { firestoreMock, escrituras, coleccionesFake, emitirCatalogo, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('../SalesAnalytics', () => ({ SalesAnalytics: () => <div>analytics</div> }))

import SalesHistory from '../SalesHistory'

const ts = (d) => ({ toDate: () => d, seconds: Math.floor(d / 1000) })
const hoy = new Date()
const VENTAS = [
  {
    id: 'zB0SLHpN', fechaVenta: ts(hoy), tipoPago: 'efectivo', subtotal: 4200, descuentoTotal: 700, totalVenta: 3500, totalGanancia: 900,
    productos: [
      { idProducto: 'ABC123', nombreProducto: 'Monster Blanco', cantidad: 2, precioVentaLocal: 1000, precioLista: 1500, descuento: 500, precioOriginal: 700 },
      { idProducto: '7801', nombreProducto: 'pepi', cantidad: 1, precioVentaLocal: 1200, precioLista: 1200, descuento: 0, precioOriginal: 800 },
    ],
  },
  { id: 'viejaSinDcto', fechaVenta: ts(hoy), tipoPago: 'tarjeta', totalVenta: 5000, totalGanancia: 1000,
    productos: [{ idProducto: 'X', nombreProducto: 'Antigua', cantidad: 1, precioVentaLocal: 5000, precioOriginal: 4000 }] },
]

beforeEach(() => {
  resetFirebaseMock()
  localStorage.setItem('roncamotors_sales_view', JSON.stringify('list'))
  coleccionesFake.sales = VENTAS
  emitirCatalogo([{ id: 'd1', idProducto: 'ABC123', nombreProducto: 'Monster Blanco', cantidadProducto: 8 }])
})

describe('Historial de ventas', () => {
  it('columna Descuento: badge con la suma, guion si no hay', async () => {
    render(<SalesHistory />)
    const filas = await screen.findAllByRole('row')
    const conDcto = filas.find((r) => r.textContent.includes('$3.500'))
    const sinDcto = filas.find((r) => r.textContent.includes('$5.000'))
    expect(within(conDcto).getByText(/−\$1\.700/)).toBeInTheDocument()   // 2×500 + 700
    expect(within(sinDcto).getByText('—')).toBeInTheDocument()
  })

  it('detalle: lista tachada, %, subtotal, descuentos y total', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    const filas = await screen.findAllByRole('row')
    const fila = filas.find((r) => r.textContent.includes('$3.500'))
    await user.click(within(fila).getByTitle('Editar Tipo de Pago / Ver Detalle'))
    const dlg = await screen.findByRole('dialog', { name: /Detalle de Venta #zB0SLHpN/ })
    expect(within(dlg).getByText('$1.500')).toHaveClass('line-through')
    expect(within(dlg).getByText('−33%')).toBeInTheDocument()
    expect(within(dlg).getByText('Descuentos por producto').parentElement).toHaveTextContent('−$1.000')
    expect(within(dlg).getByText('Subtotal').parentElement).toHaveTextContent('$4.200')
    expect(within(dlg).getByText('Descuento al total').parentElement).toHaveTextContent('−$700')
    expect(within(dlg).getByText('Total Pagado').parentElement).toHaveTextContent('$3.500')
  })

  it('venta antigua sin descuentos no muestra el desglose', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    const filas = await screen.findAllByRole('row')
    const fila = filas.find((r) => r.textContent.includes('$5.000'))
    await user.click(within(fila).getByTitle('Editar Tipo de Pago / Ver Detalle'))
    const dlg = await screen.findByRole('dialog')
    expect(within(dlg).queryByText('Subtotal')).not.toBeInTheDocument()
    expect(within(dlg).getByText('Total Pagado').parentElement).toHaveTextContent('$5.000')
  })

  it('eliminar venta restaura stock con increment (0 lecturas: catálogo en memoria)', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    const filas = await screen.findAllByRole('row')
    const fila = filas.find((r) => r.textContent.includes('$3.500'))
    firestoreMock.getDocs.mockClear()
    await user.click(within(fila).getByTitle('Eliminar Venta'))
    const dlg = await screen.findByRole('dialog', { name: /Eliminar/i })
    await user.click(within(dlg).getByRole('button', { name: /Eliminar/ }))
    await waitFor(() => expect(escrituras.deletes).toContain('sales/zB0SLHpN'))
    expect(escrituras.updates).toContainEqual({ ref: 'productos/d1', data: { cantidadProducto: { __increment: 2 } } })
    // '7801' no está en el catálogo → 1 consulta al servidor; ABC123 ninguna.
    expect(firestoreMock.getDocs.mock.calls.filter(([q]) => q?.path === 'productos')).toHaveLength(1)
  })

  it('con códigos repetidos, el stock vuelve al producto vendido (docProducto), no al primero con ese código', async () => {
    emitirCatalogo([
      { id: 'coca', idProducto: '1', nombreProducto: 'coca cola', cantidadProducto: 5 },
      { id: 'monster', idProducto: '1', nombreProducto: 'Monster Blanco', cantidadProducto: 9 },
    ])
    coleccionesFake.sales = [{ id: 'vM', fechaVenta: ts(hoy), tipoPago: 'tarjeta', totalVenta: 2000, totalGanancia: 500,
      productos: [{ idProducto: '1', docProducto: 'monster', nombreProducto: 'Monster Blanco', cantidad: 1, precioVentaLocal: 2000, precioOriginal: 1500 }] }]
    const user = userEvent.setup()
    render(<SalesHistory />)
    const fila = (await screen.findAllByRole('row')).find((r) => r.textContent.includes('$2.000'))
    await user.click(within(fila).getByTitle('Eliminar Venta'))
    const dlg = await screen.findByRole('dialog', { name: /Eliminar/i })
    await user.click(within(dlg).getByRole('button', { name: /Eliminar/ }))
    await waitFor(() => expect(escrituras.deletes).toContain('sales/vM'))
    expect(escrituras.updates).toEqual([{ ref: 'productos/monster', data: { cantidadProducto: { __increment: 1 } } }])
  })

  it('rango personalizado: desde/hasta consultan ese período completo', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    await screen.findAllByRole('row')
    await user.selectOptions(screen.getByDisplayValue('Día específico'), 'custom')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-30' } })
    await waitFor(() => {
      const llamadas = firestoreMock.where.mock.calls.filter(([campo]) => campo === 'fechaVenta')
      const desde = llamadas.findLast(([, op]) => op === '>=')[2].toDate()
      const hasta = llamadas.findLast(([, op]) => op === '<=')[2].toDate()
      expect(desde).toEqual(new Date(2026, 8, 1))
      expect(hasta).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999))
    })
  })
})
