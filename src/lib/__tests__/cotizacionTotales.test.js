import { describe, it, expect } from 'vitest'
import { totalesCotizacion } from '../cotizacionTotales'
import { precioCobrado, precioLista } from '../descuentos'

const cart = [
  { idProducto: 'A', nombreProducto: 'Coca cola', precioVentaLocal: 1500, cantidad: 2, precioDescuento: 1000 },
  { idProducto: 'B', nombreProducto: 'Aceite', precioVentaLocal: 10000, cantidad: 1 },
  { idProducto: 'C', nombreProducto: 'Libro', precioVentaLocal: 5000, cantidad: 1, afectoIva: false },
]

describe('totalesCotizacion', () => {
  it('sin descuentos: subtotal = total, neto + iva = total', () => {
    const sinDcto = cart.map(({ precioDescuento: _o, ...r }) => r)
    const t = totalesCotizacion(sinDcto, precioCobrado, precioLista)
    expect(t.subtotalLista).toBe(3000 + 10000 + 5000)
    expect(t.descuentos).toBe(0)
    expect(t.total).toBe(18000)
    expect(t.neto + t.iva).toBe(t.total)
    expect(t.exentos).toBe(1)
    expect(t.unidades).toBe(4)
  })

  it('descuento por ítem aparece en la fila y en el resumen', () => {
    const t = totalesCotizacion(cart, precioCobrado, precioLista)
    expect(t.filas[0]).toMatchObject({ unitLista: 1500, unit: 1000, dctoUnit: 500, dcto: 1000, subtotal: 2000 })
    expect(t.filas[1].dctoUnit).toBe(0)
    expect(t.subtotalLista).toBe(18000)
    expect(t.descuentoItems).toBe(1000)
    expect(t.total).toBe(17000)
  })

  it('descuento al total se acota y prorratea el IVA', () => {
    const t = totalesCotizacion(cart, precioCobrado, precioLista, 2000)
    expect(t.descuentoTotal).toBe(2000)
    expect(t.descuentos).toBe(3000)
    expect(t.total).toBe(15000)
    expect(t.neto + t.iva).toBe(15000)
    // el exento (5.000) no genera IVA: neto afecto = 12.000/1,19 ≈ 10.084 → prorrateado ×(15/17)
    expect(t.iva).toBeGreaterThan(0)
    expect(t.iva).toBeLessThan(Math.round(15000 - 15000 / 1.19))
  })

  it('descuento al total mayor al cobrado → total 0', () => {
    const t = totalesCotizacion(cart, precioCobrado, precioLista, 999999)
    expect(t.total).toBe(0)
    expect(t.iva).toBe(0)
    expect(t.neto).toBe(0)
  })

  it('precioListaDe por defecto = precioDe (sin columna de descuento)', () => {
    const t = totalesCotizacion(cart, precioCobrado)
    expect(t.descuentoItems).toBe(0)
    expect(t.subtotalLista).toBe(17000)
  })

  it('carrito vacío', () => {
    const t = totalesCotizacion([], precioCobrado, precioLista, 500)
    expect(t).toMatchObject({ total: 0, neto: 0, iva: 0, descuentos: 0, unidades: 0 })
  })
})
