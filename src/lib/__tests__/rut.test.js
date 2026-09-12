import { describe, it, expect } from 'vitest'
import { limpiarRut, formatRut, digitoVerificador, validarRut } from '../rut'

describe('rut', () => {
  it('limpiar deja solo dígitos y K mayúscula', () => {
    expect(limpiarRut('12.345.678-k')).toBe('12345678K')
    expect(limpiarRut(' 1-9 ')).toBe('19')
    expect(limpiarRut(null)).toBe('')
  })

  it('formatea con puntos y guion', () => {
    expect(formatRut('123456789')).toBe('12.345.678-9')
    expect(formatRut('12345678K')).toBe('12.345.678-K')
    expect(formatRut('12.345.678-9')).toBe('12.345.678-9')
    expect(formatRut('19')).toBe('1-9')
  })

  it('no formatea lo que no alcanza a ser RUT', () => {
    expect(formatRut('')).toBe('')
    expect(formatRut('1')).toBe('1')
    expect(formatRut('K1')).toBe('K1')
  })

  it('dígito verificador módulo 11', () => {
    expect(digitoVerificador('11111111')).toBe('1')
    expect(digitoVerificador('12345678')).toBe('5')
    expect(digitoVerificador('7654321')).toBe('6')
    expect(digitoVerificador('15000005')).toBe('K')
    expect(digitoVerificador('15000013')).toBe('0')
  })

  it('validarRut', () => {
    expect(validarRut('11.111.111-1')).toBe(true)
    expect(validarRut('12345678-5')).toBe(true)
    expect(validarRut('15.000.005-k')).toBe(true)
    expect(validarRut('15.000.013-0')).toBe(true)
    expect(validarRut('12.345.678-9')).toBe(false)
    expect(validarRut('1')).toBe(false)
    expect(validarRut('')).toBe(false)
    expect(validarRut('abc-1')).toBe(false)
  })
})
