import { describe, it, expect } from 'vitest'
import { TASA_IVA, esAfecto, netoDe, ivaDe, conIva, desglosar } from '../iva'

describe('iva', () => {
  it('tasa 19%', () => expect(TASA_IVA).toBe(19))

  it('productos sin campo afectoIva se tratan como afectos', () => {
    expect(esAfecto({})).toBe(true)
    expect(esAfecto({ afectoIva: true })).toBe(true)
    expect(esAfecto({ afectoIva: false })).toBe(false)
    expect(esAfecto(null)).toBe(true)
  })

  it('el neto se obtiene dividiendo, no multiplicando por 0,19', () => {
    expect(netoDe(1190)).toBeCloseTo(1000)
    expect(ivaDe(1190)).toBeCloseTo(190)
    // 1.800 con IVA dentro → IVA 287, no 342
    expect(Math.round(ivaDe(1800))).toBe(287)
  })

  it('exento: neto = final, IVA 0', () => {
    expect(netoDe(1000, false)).toBe(1000)
    expect(ivaDe(1000, false)).toBe(0)
    expect(conIva(1000, false)).toBe(1000)
  })

  it('conIva y netoDe son inversas', () => {
    expect(netoDe(conIva(1234))).toBeCloseTo(1234)
  })

  it('desglosar redondea a peso y cuadra', () => {
    const d = desglosar(1990)
    expect(d.total).toBe(1990)
    expect(d.neto + d.iva).toBe(d.total)
    expect(d.neto).toBe(1672)
    expect(d.iva).toBe(318)
  })

  it('entradas basura → 0', () => {
    expect(netoDe('abc')).toBe(0)
    expect(conIva(undefined)).toBe(0)
    expect(desglosar(null).total).toBe(0)
  })
})
