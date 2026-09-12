// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }))
import { toast } from 'sonner'
import { AvisoConexion } from '../AvisoConexion'

const ponerRed = (online) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
  act(() => { window.dispatchEvent(new Event(online ? 'online' : 'offline')) })
}

beforeEach(() => ponerRed(true))

describe('AvisoConexion', () => {
  it('con red no avisa nada', () => {
    render(<AvisoConexion />)
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('sin red: toast persistente; al volver: conexión restablecida', () => {
    render(<AvisoConexion />)
    ponerRed(false)
    expect(toast.warning).toHaveBeenCalledWith('Sin conexión', expect.objectContaining({ id: 'conexion', duration: Infinity, dismissible: false }))
    ponerRed(true)
    expect(toast.success).toHaveBeenCalledWith('Conexión restablecida', expect.objectContaining({ id: 'conexion' }))
  })
})
