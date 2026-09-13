import { describe, it, expect } from 'vitest'
import { partirPorMes, resumenGastos, filtrarGastos, inicioMes, finMes, mesAnterior, categoriaDe } from '../gastos'

const g = (fecha, monto, categoria = 'otro', descripcion = '') => ({ fecha: { toDate: () => new Date(fecha) }, monto, categoria, descripcion })

describe('meses', () => {
  it('inicio, fin y anterior', () => {
    const d = new Date('2026-03-15T12:00')
    expect(inicioMes(d).toISOString().slice(0, 10)).toBe('2026-03-01')
    expect(finMes(d).getDate()).toBe(31)
    expect(mesAnterior(new Date('2026-01-10')).getMonth()).toBe(11)
  })
  it('partirPorMes separa actual y anterior, ignora el resto', () => {
    const { actual, anterior } = partirPorMes([g('2026-03-02', 1), g('2026-02-20', 2), g('2026-01-05', 3)], new Date('2026-03-10'))
    expect(actual.map(x => x.monto)).toEqual([1])
    expect(anterior.map(x => x.monto)).toEqual([2])
  })
})

describe('resumenGastos', () => {
  it('total, variación y desglose ordenado', () => {
    const r = resumenGastos([g('2026-03-01', 30000, 'publicidad'), g('2026-03-02', 10000, 'arreglos'), g('2026-03-03', 20000, 'publicidad')], [g('2026-02-01', 40000)])
    expect(r.total).toBe(60000)
    expect(r.variacion).toBe(50)
    expect(r.cantidad).toBe(3)
    expect(r.porCategoria.map(c => [c.id, c.monto, Math.round(c.pct)])).toEqual([['publicidad', 50000, 83], ['arreglos', 10000, 17]])
    expect(r.mayor.label).toBe('Publicidad')
  })
  it('sin mes anterior: variación null; sin gastos: mayor null', () => {
    expect(resumenGastos([g('2026-03-01', 5)]).variacion).toBeNull()
    expect(resumenGastos([]).mayor).toBeNull()
  })
  it('categoría desconocida cae en Otro', () => {
    expect(categoriaDe('inventada').id).toBe('otro')
  })
})

describe('filtrarGastos', () => {
  const lista = [g('2026-03-01', 1, 'publicidad', 'Instagram ads'), g('2026-03-02', 2, 'arreglos', 'Vidrio vitrina')]
  it('por categoría y por texto (descripción o nombre de categoría)', () => {
    expect(filtrarGastos(lista, { categoria: 'arreglos' })).toHaveLength(1)
    expect(filtrarGastos(lista, { texto: 'insta' })[0].monto).toBe(1)
    expect(filtrarGastos(lista, { texto: 'ARREGLOS' })[0].monto).toBe(2)
    expect(filtrarGastos(lista, {})).toHaveLength(2)
  })
})
