import { describe, it, expect } from 'vitest'
import { limpiarPatente, validarPatente, formatPatente } from '../patente'

describe('limpiarPatente', () => {
    it('quita separadores y pasa a mayúsculas', () => {
        expect(limpiarPatente(' bb-cd.12 ')).toBe('BBCD12')
    })

    it('tolera vacío y nulo', () => {
        expect(limpiarPatente(undefined)).toBe('')
        expect(limpiarPatente(null)).toBe('')
    })
})

describe('validarPatente', () => {
    it('acepta formatos de auto y moto', () => {
        expect(validarPatente('BBCD12')).toBe(true)
        expect(validarPatente('AB1234')).toBe(true)
        expect(validarPatente('ABC12')).toBe(true)
        expect(validarPatente('AB123')).toBe(true)
    })

    it('rechaza largos y órdenes inválidos', () => {
        expect(validarPatente('12ABCD')).toBe(false)
        expect(validarPatente('ABCDE1')).toBe(false)
        expect(validarPatente('AB12')).toBe(false)
        expect(validarPatente('')).toBe(false)
    })
})

describe('formatPatente', () => {
    it('separa letras de números', () => {
        expect(formatPatente('bbcd12')).toBe('BBCD-12')
        expect(formatPatente('ab 12 34')).toBe('AB-1234')
    })

    it('devuelve lo limpio si no calza', () => {
        expect(formatPatente('ab12')).toBe('AB12')
    })
})
