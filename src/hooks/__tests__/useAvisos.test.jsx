// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { firestoreMock, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../db/firebase', () => ({ db: {} }))
import { useAvisos } from '../useAvisos'

const sesion = (openingTime) => ({
  empty: !openingTime,
  docs: openingTime ? [{ data: () => ({ status: 'open', openingTime: { toDate: () => openingTime } }) }] : [],
})

const montar = (snap) => {
  firestoreMock.onSnapshot.mockImplementation((_q, cb) => { cb(snap); return () => {} })
  return renderHook(() => useAvisos()).result
}

beforeEach(resetFirebaseMock)

describe('useAvisos', () => {
  it('sin caja abierta: sin avisos', () => {
    expect(montar(sesion(null)).current).toEqual([])
  })

  it('caja abierta hoy: no molesta', () => {
    const hoy = new Date(); hoy.setHours(8, 0, 0, 0)
    expect(montar(sesion(hoy)).current).toEqual([])
  })

  it('caja abierta ayer: aviso con salto a caja', () => {
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1); ayer.setHours(9, 0, 0, 0)
    const [aviso] = montar(sesion(ayer)).current
    expect(aviso).toMatchObject({ id: 'caja-abierta', titulo: 'Caja sin cerrar', accion: { label: 'Ir a caja', href: '/' } })
    expect(aviso.detalle).toMatch(/hace \d+ h/)
  })
})
