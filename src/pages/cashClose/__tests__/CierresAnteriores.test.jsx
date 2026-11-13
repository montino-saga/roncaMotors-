// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { firestoreMock, coleccionesFake, resetFirebaseMock } from '../../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
import { CierresAnteriores } from '../CierresAnteriores'

const ts = (iso) => ({ toDate: () => new Date(iso) })

beforeEach(() => resetFirebaseMock())

describe('Cierres anteriores', () => {
  it('lista esperado, contado y diferencia de cada corte', async () => {
    coleccionesFake.cash_registers = [
      { id: 'z1', status: 'closed', openingTime: ts('2026-11-12T09:00'), closingTime: ts('2026-11-12T20:00'), expectedBalance: 26040, closingBalance: 26000, difference: -40 },
      { id: 'z2', status: 'closed', openingTime: ts('2026-11-11T09:00'), closingTime: ts('2026-11-11T20:00'), expectedBalance: 50000, closingBalance: 50000, difference: 0 },
    ]
    render(<CierresAnteriores />)
    const filas = await screen.findAllByRole('row')
    expect(within(filas[1]).getByText('$26.040')).toBeInTheDocument()
    expect(within(filas[1]).getByText('-$40')).toBeInTheDocument()
    expect(within(filas[2]).getByText('Cuadra')).toBeInTheDocument()
    expect(firestoreMock.orderBy).toHaveBeenCalledWith('closingTime', 'desc')
  })

  it('sin cierres muestra un mensaje', async () => {
    coleccionesFake.cash_registers = []
    render(<CierresAnteriores />)
    expect(await screen.findByText(/Todavía no hay cierres/)).toBeInTheDocument()
  })
})
