import { describe, it, expect } from 'vitest'
import { redondear, desdeMargen, margenImplicito, formulaReferencia, indicadores, REDONDEO } from '../precios'

describe('precios', () => {
  it('redondear a múltiplos de 10', () => {
    expect(REDONDEO).toBe(10)
    expect(redondear(1983.33)).toBe(1980)
    expect(redondear(1985)).toBe(1990)
    expect(redondear(0)).toBe(0)
  })

  describe('desdeMargen', () => {
    it('40% de margen = costo/0,6 × 1,19 (fórmula del negocio)', () => {
      // 1000/0.6 = 1666.67 × 1.19 = 1983.33 → 1980
      expect(desdeMargen(1000, 40)).toBe('1980')
      expect(desdeMargen(1000, '40')).toBe('1980')
    })
    it('exento no suma IVA', () => {
      expect(desdeMargen(1000, 40, false)).toBe('1670')
    })
    it('margen 0 = costo con IVA', () => {
      expect(desdeMargen(1000, 0)).toBe('1190')
    })
    it('devuelve "" si no se puede calcular', () => {
      expect(desdeMargen(0, 40)).toBe('')
      expect(desdeMargen(-5, 40)).toBe('')
      expect(desdeMargen(1000, '')).toBe('')
      expect(desdeMargen(1000, null)).toBe('')
      expect(desdeMargen(1000, 'abc')).toBe('')
      expect(desdeMargen(1000, 100)).toBe('')
      expect(desdeMargen(1000, 150)).toBe('')
    })
  })

  describe('margenImplicito', () => {
    it('recupera el margen de un precio generado', () => {
      expect(margenImplicito(1000, 1983.33)).toBe(40)
      expect(margenImplicito(1000, Number(desdeMargen(1000, 30)))).toBe(30)
    })
    it('null si no hay costo o no hay ganancia', () => {
      expect(margenImplicito(0, 1000)).toBeNull()
      expect(margenImplicito(1000, 1000)).toBeNull()
      expect(margenImplicito(1000, 500)).toBeNull()
      expect(margenImplicito(1000, '')).toBeNull()
    })
  })

  describe('formulaReferencia', () => {
    it('⌈⌈costo ÷ 0,6⌉ × 1,19⌉ en pesos enteros', () => {
      expect(formulaReferencia(1000)).toEqual({ neto: 1667, precio: 1984 })
      expect(formulaReferencia(600)).toEqual({ neto: 1000, precio: 1190 })
    })
    it('null sin costo', () => {
      expect(formulaReferencia(0)).toBeNull()
      expect(formulaReferencia(undefined)).toBeNull()
    })
  })

  describe('indicadores', () => {
    it('ganancia, markup y margen sobre neto', () => {
      const r = indicadores(1000, 1190)
      expect(r.neto).toBe(1000)
      expect(r.ganancia).toBe(0)
      expect(r.markup).toBe(0)
      expect(r.perdida).toBe(false)
    })
    it('detecta pérdida disfrazada por el IVA', () => {
      // "gano 10%" sobre el precio final: 1.100 con IVA → neto 924 < 1.000
      const r = indicadores(1000, 1100)
      expect(r.perdida).toBe(true)
      expect(r.ganancia).toBeLessThan(0)
    })
    it('sin costo, markup null', () => {
      expect(indicadores(0, 1190).markup).toBeNull()
      expect(indicadores(1000, 0).margen).toBeNull()
    })
  })
})
