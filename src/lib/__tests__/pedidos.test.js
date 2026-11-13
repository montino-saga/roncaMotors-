import { describe, it, expect } from 'vitest'
import { agregarProducto, filtrarPedidos, resumenPedidos, saldoDe, totalItems, validarAbono } from '../pedidos'

const p = (id, estado, total, abonado, extra = {}) => ({ id, estado, total, abonado, nombreCliente: 'Ana', descripcion: '', productos: [], ...extra })

describe('pedidos', () => {
  it('total por ítems y saldo nunca negativo', () => {
    expect(totalItems([{ precio: 1000, cantidad: 2 }, { precio: 500, cantidad: 1 }])).toBe(2500)
    expect(saldoDe({ total: 10000, abonado: 4000 })).toBe(6000)
    expect(saldoDe({ total: 10000, abonado: 12000 })).toBe(0)
  })

  it('agregar el mismo producto suma cantidad; uno nuevo toma el precio local', () => {
    const prod = { idProducto: 'A1', nombreProducto: 'Filtro', precioVentaLocal: 4990 }
    let items = agregarProducto([], prod)
    expect(items).toEqual([{ idProducto: 'A1', nombreProducto: 'Filtro', cantidad: 1, precio: 4990 }])
    items = agregarProducto(items, prod)
    expect(items[0].cantidad).toBe(2)
    expect(agregarProducto(items, { idProducto: 'B2', nombreProducto: 'Aceite', precioProducto: 8000 })[1].precio).toBe(8000)
  })

  it('resumen solo cuenta pendientes', () => {
    const r = resumenPedidos([p('1', 'pendiente', 10000, 4000), p('2', 'pendiente', 5000, 0), p('3', 'entregado', 9000, 1000)])
    expect(r).toEqual({ pendientes: 2, porCobrar: 11000, abonado: 4000 })
  })

  it('filtra por estado y por cliente, descripción o producto', () => {
    const lista = [
      p('1', 'pendiente', 1, 0, { nombreCliente: 'Juan Pérez' }),
      p('2', 'entregado', 1, 0, { descripcion: 'Kit embrague' }),
      p('3', 'pendiente', 1, 0, { productos: [{ nombreProducto: 'Pastillas freno' }] }),
    ]
    expect(filtrarPedidos(lista, { estado: 'pendiente' }).map(x => x.id)).toEqual(['1', '3'])
    expect(filtrarPedidos(lista, { texto: 'juan' }).map(x => x.id)).toEqual(['1'])
    expect(filtrarPedidos(lista, { texto: 'EMBRAGUE' }).map(x => x.id)).toEqual(['2'])
    expect(filtrarPedidos(lista, { texto: 'freno' }).map(x => x.id)).toEqual(['3'])
  })

  it('abono: positivo y no mayor a lo que se debe', () => {
    expect(validarAbono('', 5000)).toBe('Ingresa un monto válido')
    expect(validarAbono('6000', 5000)).toBe('El abono supera lo que se debe')
    expect(validarAbono('5000', 5000)).toBeNull()
  })
})
