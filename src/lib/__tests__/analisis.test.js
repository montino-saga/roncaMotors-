import { describe, it, expect } from 'vitest'
import { serieDiaria, serieConFantasma, kpis, mapaCalor, insights, variacion } from '../analisis'

const venta = (fecha, over = {}) => ({
  fechaVenta: { toDate: () => new Date(fecha) }, totalVenta: 1000, totalGanancia: 300, tipoPago: 'efectivo',
  productos: [{ nombreProducto: 'A', cantidad: 1, precioVentaLocal: 1000, precioOriginal: 700 }], ...over,
})

describe('serieDiaria', () => {
  it('rellena con ceros y acumula por día', () => {
    const s = serieDiaria([venta('2026-09-01T10:00'), venta('2026-09-01T15:00'), venta('2026-09-03T09:00')], new Date('2026-09-01T00:00'), 3)
    expect(s.map(p => p.ventas)).toEqual([2000, 0, 1000])
    expect(s.map(p => p.pedidos)).toEqual([2, 0, 1])
  })
  it('cambio de hora (Chile, sep 2026): medianoche inexistente no descuadra los días', () => {
    // 2026-09-06 00:00 no existe en America/Santiago; setHours(0) cae en 01:00.
    const s = serieDiaria([venta('2026-09-06T11:00'), venta('2026-09-08T11:00')], new Date('2026-09-05T00:00'), 4)
    expect(s.map(p => p.ventas)).toEqual([0, 1000, 0, 1000])
  })
  it('ignora abonos y fechas fuera de rango', () => {
    const s = serieDiaria([venta('2026-09-01T10:00', { tipoPago: 'abono' }), venta('2026-08-31T23:00')], new Date('2026-09-01T00:00'), 2)
    expect(s.map(p => p.ventas)).toEqual([0, 0])
  })
})

describe('serieConFantasma / kpis', () => {
  const actual = serieDiaria([venta('2026-09-02T10:00'), venta('2026-09-02T11:00')], new Date('2026-09-02T00:00'), 2)
  const previo = serieDiaria([venta('2026-08-31T10:00')], new Date('2026-08-31T00:00'), 2)
  it('alinea por índice de día', () => {
    const f = serieConFantasma(actual, previo)
    expect(f[0]).toMatchObject({ ventas: 2000, previo: 1000 })
    expect(f[1]).toMatchObject({ ventas: 0, previo: 0 })
  })
  it('kpis con delta y serie', () => {
    const k = kpis(actual, previo)
    expect(k.find(x => x.clave === 'ventas')).toMatchObject({ valor: 2000, delta: 100, serie: [2000, 0] })
    expect(k.find(x => x.clave === 'ticket').valor).toBe(1000)
  })
  it('variacion sin base es null', () => expect(variacion(5, 0)).toBeNull())
})

describe('mapaCalor', () => {
  it('cuenta por día de semana y hora', () => {
    // 2026-09-05 es sábado
    const m = mapaCalor([venta('2026-09-05T11:30'), venta('2026-09-05T11:45'), venta('2026-09-05T12:00')])
    expect(m.celdas[6][11].pedidos).toBe(2)
    expect(m.celdas[6][12].monto).toBe(1000)
    expect(m.max).toBe(2)
  })
})

describe('insights', () => {
  it('sin ventas devuelve una sola frase neutra', () => {
    const vacio = serieDiaria([], new Date('2026-09-01'), 7)
    expect(insights({ actual: vacio, previo: vacio, ventas: [] })).toHaveLength(1)
  })
  it('detecta subida, fiado y deuda concentrada', () => {
    const ventas = [venta('2026-09-02T10:00'), venta('2026-09-02T11:00', { tipoPago: 'fiado' })]
    const actual = serieDiaria(ventas, new Date('2026-09-02T00:00'), 1)
    const previo = serieDiaria([venta('2026-09-01T10:00')], new Date('2026-09-01T00:00'), 1)
    const clientes = [{ currentDebt: 50000 }, { currentDebt: 30000 }, { currentDebt: 20000 }, { currentDebt: 1000 }, { currentDebt: 500 }]
    const textos = insights({ actual, previo, ventas, clientes, mapa: mapaCalor(ventas) }).map(i => i.texto)
    expect(textos.some(t => t.includes('suben 100%'))).toBe(true)
    expect(textos.some(t => t.includes('50% de lo vendido salió fiado'))).toBe(true)
    expect(textos.some(t => t.includes('3 clientes concentran el 99%'))).toBe(true)
  })
  it('mejor vs peor día', () => {
    // lun 7, mar 8, mié 9 de septiembre 2026
    const ventas = [venta('2026-09-07T10:00', { totalVenta: 3000 }), venta('2026-09-08T10:00', { totalVenta: 1000 }), venta('2026-09-09T10:00', { totalVenta: 1000 })]
    const actual = serieDiaria(ventas, new Date('2026-09-07T00:00'), 3)
    const textos = insights({ actual, previo: [], ventas }).map(i => i.texto)
    expect(textos.some(t => t.startsWith('Lunes vende 3,0× más que'))).toBe(true)
  })
})
