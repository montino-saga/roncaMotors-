// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../context/AppearanceContext', () => ({ useAppearance: () => ({ resolved: 'dark' }) }))
import { SalesAnalytics } from '../SalesAnalytics'

const venta = (over = {}) => ({ id: Math.random().toString(36), fechaVenta: { toDate: () => new Date('2026-09-10T10:00') }, totalVenta: 10000, totalGanancia: 4000, tipoPago: 'efectivo', productos: [{ nombreProducto: 'A', cantidad: 1 }], ...over })

describe('SalesAnalytics', () => {
  it('KPIs: totales, ganancia, ticket, cobrado vs fiado y mezcla de pago', () => {
    render(<SalesAnalytics dateRange="week" sales={[venta(), venta({ tipoPago: 'tarjeta' }), venta({ tipoPago: 'fiado', totalVenta: 20000, totalGanancia: 5000 })]} />)
    const kpi = (label) => screen.getByText(label).closest('.card-entra')
    expect(kpi('Ventas Totales')).toHaveTextContent('$40.000')
    expect(kpi('Ventas Totales')).toHaveTextContent('3 transacciones')
    expect(kpi('Ventas Totales')).toHaveTextContent('cobrado $20.000 · fiado $20.000')
    expect(kpi('Ganancia Neta')).toHaveTextContent('$13.000')
    expect(kpi('Ticket Promedio')).toHaveTextContent('$13.333')
    expect(kpi('Ticket Promedio')).toHaveTextContent('Efectivo: 33%')
    expect(kpi('Ticket Promedio')).toHaveTextContent('Tarjeta: 33%')
  })

  it('sin ventas: ceros sin NaN', () => {
    render(<SalesAnalytics dateRange="week" sales={[]} />)
    expect(screen.getByText('Ventas Totales').closest('.card-entra')).toHaveTextContent('$0')
    expect(document.body.textContent).not.toMatch(/NaN/)
  })
})
