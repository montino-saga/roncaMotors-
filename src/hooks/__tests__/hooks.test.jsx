// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDelayedLoading } from '../useDelayedLoading'
import { usePersistedState } from '../usePersistedState'
import { useOnline } from '../useOnline'
import { useMediaQuery } from '../useMediaQuery'

describe('useDelayedLoading', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('no muestra skeleton antes del retardo; sí después; se apaga al instante', () => {
    const { result, rerender } = renderHook(({ l }) => useDelayedLoading(l, 150), { initialProps: { l: true } })
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(149))
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(2))
    expect(result.current).toBe(true)
    rerender({ l: false })
    expect(result.current).toBe(false)
  })
  it('carga rápida: nunca parpadea', () => {
    const { result, rerender } = renderHook(({ l }) => useDelayedLoading(l, 150), { initialProps: { l: true } })
    act(() => vi.advanceTimersByTime(50))
    rerender({ l: false })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe(false)
  })
})

describe('usePersistedState', () => {
  it('lee el valor guardado, persiste cambios y usa el default si no hay nada', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }))
    const { result } = renderHook(() => usePersistedState('k', 'def'))
    expect(result.current[0]).toEqual({ a: 1 })
    act(() => result.current[1]('nuevo'))
    expect(JSON.parse(localStorage.getItem('k'))).toBe('nuevo')
    const { result: r2 } = renderHook(() => usePersistedState('otra', 'def'))
    expect(r2.current[0]).toBe('def')
  })
  it('JSON corrupto no rompe: cae al default', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('mal', '{no json')
    const { result } = renderHook(() => usePersistedState('mal', 7))
    expect(result.current[0]).toBe(7)
    vi.restoreAllMocks()
  })
})

describe('useOnline', () => {
  it('sigue los eventos online/offline del navegador', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(result.current).toBe(false)
  })
})

describe('useMediaQuery', () => {
  it('devuelve matches y reacciona al cambio', () => {
    let oyente
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: (_e, cb) => { oyente = cb }, removeEventListener() {} }))
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: (_e, cb) => { oyente = cb }, removeEventListener() {} }))
    act(() => oyente())
    expect(result.current).toBe(false)
  })
})
