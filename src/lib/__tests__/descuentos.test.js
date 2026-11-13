import { describe, it, expect } from 'vitest'
import {
  precioLista, precioCobrado, calcularDescuento, aplicarDescuentoItem, quitarDescuentoItem,
  subtotalCarrito, descuentoTotalAcotado, totalesCarrito, descuentoItemsVenta, ventaConDescuento,
} from '../descuentos'

const item = (over = {}) => ({ idProducto: 'A', precioVentaLocal: 1500, precioOriginal: 1000, cantidad: 2, ...over })

describe('precios del ítem', () => {
  it('precioLista usa precioVentaLocal y cae a precioProducto (legacy)', () => {
    expect(precioLista({ precioVentaLocal: 1500 })).toBe(1500)
    expect(precioLista({ precioProducto: 900 })).toBe(900)
    expect(precioLista({})).toBe(0)
    expect(precioLista(null)).toBe(0)
  })
  it('precioCobrado prioriza el descuento', () => {
    expect(precioCobrado(item())).toBe(1500)
    expect(precioCobrado(item({ precioDescuento: 1000 }))).toBe(1000)
    expect(precioCobrado(item({ precioDescuento: 0 }))).toBe(0)
  })
})

describe('calcularDescuento', () => {
  it('porcentaje', () => {
    expect(calcularDescuento(1500, 'pct', 10)).toBe(1350)
    expect(calcularDescuento(1500, 'pct', '0')).toBe(1500)
    expect(calcularDescuento(1500, 'pct', 100)).toBe(0)
    expect(calcularDescuento(999, 'pct', 33)).toBe(669) // redondea a peso
  })
  it('precio final (el caso "vendo 1.500 y lo dejo a 1.000")', () => {
    expect(calcularDescuento(1500, 'precio', 1000)).toBe(1000)
    expect(calcularDescuento(1500, 'precio', '1500')).toBe(1500)
  })
  it('inválidos → null', () => {
    expect(calcularDescuento(1500, 'pct', '')).toBeNull()
    expect(calcularDescuento(1500, 'pct', null)).toBeNull()
    expect(calcularDescuento(1500, 'pct', 'x')).toBeNull()
    expect(calcularDescuento(1500, 'pct', -1)).toBeNull()
    expect(calcularDescuento(1500, 'pct', 101)).toBeNull()
    expect(calcularDescuento(1500, 'precio', 1501)).toBeNull()
    expect(calcularDescuento(1500, 'precio', -1)).toBeNull()
  })
})

describe('aplicar / quitar descuento en ítem', () => {
  it('pone precioDescuento cuando rebaja', () => {
    expect(aplicarDescuentoItem(item(), 1000)).toMatchObject({ precioDescuento: 1000 })
  })
  it('un precio igual o mayor al de lista no deja descuento', () => {
    expect(aplicarDescuentoItem(item({ precioDescuento: 900 }), 1500)).not.toHaveProperty('precioDescuento')
    expect(aplicarDescuentoItem(item(), 2000)).not.toHaveProperty('precioDescuento')
    expect(aplicarDescuentoItem(item(), null)).not.toHaveProperty('precioDescuento')
  })
  it('quitar devuelve el mismo objeto si no había descuento', () => {
    const it0 = item()
    expect(quitarDescuentoItem(it0)).toBe(it0)
    expect(quitarDescuentoItem(item({ precioDescuento: 1 }))).not.toHaveProperty('precioDescuento')
  })
  it('no muta el original', () => {
    const it0 = item()
    aplicarDescuentoItem(it0, 1000)
    expect(it0).not.toHaveProperty('precioDescuento')
  })
})

describe('totales del carrito', () => {
  const cart = [item(), item({ idProducto: 'B', precioVentaLocal: 1200, precioOriginal: 800, cantidad: 1, precioDescuento: 1000 })]

  it('subtotal usa el precio cobrado', () => {
    expect(subtotalCarrito(cart)).toBe(1500 * 2 + 1000)
    expect(subtotalCarrito([])).toBe(0)
  })

  it('descuento al total se acota a [0, subtotal] y a 0 sin carrito', () => {
    expect(descuentoTotalAcotado(cart, 500)).toBe(500)
    expect(descuentoTotalAcotado(cart, 99999)).toBe(4000)
    expect(descuentoTotalAcotado(cart, -5)).toBe(0)
    expect(descuentoTotalAcotado(cart, 'x')).toBe(0)
    expect(descuentoTotalAcotado([], 500)).toBe(0)
  })

  it('totalesCarrito = lo que se guarda en la venta', () => {
    const t = totalesCarrito(cart, 500)
    expect(t).toEqual({ subtotal: 4000, descuentoTotal: 500, total: 3500, ganancia: (1500 - 1000) * 2 + (1000 - 800) - 500 })
  })

  it('sin descuento al total', () => {
    const t = totalesCarrito(cart)
    expect(t.total).toBe(4000)
    expect(t.descuentoTotal).toBe(0)
  })

  it('el total nunca es negativo', () => {
    expect(totalesCarrito(cart, 1e9).total).toBe(0)
  })
})

describe('venta guardada', () => {
  it('suma descuentos por ítem × cantidad', () => {
    const sale = { productos: [{ descuento: 500, cantidad: 2 }, { descuento: 0, cantidad: 3 }, { cantidad: 1 }] }
    expect(descuentoItemsVenta(sale)).toBe(1000)
    expect(descuentoItemsVenta({})).toBe(0)
    expect(descuentoItemsVenta(null)).toBe(0)
  })
  it('ventaConDescuento detecta ambos tipos y respeta ventas antiguas', () => {
    expect(ventaConDescuento({ productos: [], descuentoTotal: 700 })).toBe(true)
    expect(ventaConDescuento({ productos: [{ descuento: 10, cantidad: 1 }] })).toBe(true)
    expect(ventaConDescuento({ productos: [{ cantidad: 1 }] })).toBe(false)
    expect(ventaConDescuento({ productos: [], descuentoTotal: 0 })).toBe(false)
  })
})

describe('descuentoProporcional', () => {
  it('mantiene el porcentaje sobre lo que queda tras devolver', async () => {
    const { descuentoProporcional } = await import('../descuentos')
    expect(descuentoProporcional(360, 3600, 2400)).toBe(240)   // 10% de lo que queda
    expect(descuentoProporcional(360, 3600, 0)).toBe(0)
    expect(descuentoProporcional(0, 3600, 2400)).toBe(0)
    expect(descuentoProporcional(500, 1000, 300)).toBe(150)
  })
})
