// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { firestoreMock, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../db/firebase', () => ({ db: {} }))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), dismiss: vi.fn() } }))
import { toast } from 'sonner'
import { AlertaCaja } from '../AlertaCaja'

const sesion = (openingTime) => ({
  empty: !openingTime,
  docs: openingTime ? [{ data: () => ({ status: 'open', openingTime: { toDate: () => openingTime } }) }] : [],
})

const montar = (snap, ruta = '/ventas') => {
  firestoreMock.onSnapshot.mockImplementation((_q, cb) => { cb(snap); return () => {} })
  render(<MemoryRouter initialEntries={[ruta]}><AlertaCaja /></MemoryRouter>)
}

beforeEach(resetFirebaseMock)

describe('AlertaCaja', () => {
  it('sin caja abierta: descarta el aviso', () => {
    montar(sesion(null))
    expect(toast.dismiss).toHaveBeenCalledWith('caja-abierta')
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('caja abierta hoy: no molesta', () => {
    const hoy = new Date(); hoy.setHours(8, 0, 0, 0)
    montar(sesion(hoy))
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('caja abierta ayer: aviso persistente con salto a caja', () => {
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1); ayer.setHours(9, 0, 0, 0)
    montar(sesion(ayer))
    expect(toast.warning).toHaveBeenCalledWith('Caja sin cerrar', expect.objectContaining({
      id: 'caja-abierta', duration: Infinity, action: expect.objectContaining({ label: 'Ir a caja' }),
    }))
  })

  it('ya en la vista de caja: sin botón de acción', () => {
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
    montar(sesion(ayer), '/')
    expect(toast.warning.mock.calls[0][1].action).toBeUndefined()
  })
})
