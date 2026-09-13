// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const updateServiceWorker = vi.fn()
let necesita = false
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ needRefresh: [necesita, () => {}], updateServiceWorker }) }))
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))
import { toast } from 'sonner'
import { AvisoActualizacion } from '../AvisoActualizacion'

describe('AvisoActualizacion', () => {
  it('sin versión nueva no avisa', () => {
    render(<AvisoActualizacion />)
    expect(toast.info).not.toHaveBeenCalled()
  })
  it('con SW esperando: toast persistente; Actualizar aplica el SW', () => {
    necesita = true
    render(<AvisoActualizacion />)
    expect(toast.info).toHaveBeenCalledWith('Nueva versión disponible', expect.objectContaining({ duration: Infinity }))
    toast.info.mock.calls[0][1].action.onClick()
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
