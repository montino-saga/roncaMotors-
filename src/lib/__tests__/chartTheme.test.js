import { describe, it, expect } from 'vitest'
import { chartTheme } from '../chartTheme'

describe('chartTheme', () => {
  it('devuelve paleta por tema y cae a oscuro', () => {
    expect(chartTheme('light').tooltip.backgroundColor).toBe('#ffffff')
    expect(chartTheme('dark').tooltip.backgroundColor).toBe('#0f172a')
    expect(chartTheme(undefined)).toBe(chartTheme('dark'))
    for (const k of ['grid', 'axis', 'cursor', 'cursorStroke', 'tooltip']) expect(chartTheme('light')).toHaveProperty(k)
  })
})
