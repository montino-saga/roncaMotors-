import { describe, it, expect } from 'vitest'
import { cn, formatCLP } from '../utils'

describe('utils', () => {
  it('formatCLP: pesos chilenos sin decimales, con punto de miles', () => {
    expect(formatCLP(0)).toBe('$0')
    expect(formatCLP(1234567)).toBe('$1.234.567')
    expect(formatCLP(-1600)).toBe('$-1.600')
    expect(formatCLP(999.6)).toBe('$1.000')
  })
  it('cn: combina y resuelve conflictos de Tailwind', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    const oculto = false
    expect(cn('text-white', oculto && 'oculto', undefined, 'font-bold')).toBe('text-white font-bold')
    expect(cn('min-h-0 min-h-[20rem] lg:min-h-0')).toBe('min-h-[20rem] lg:min-h-0')
  })
})
