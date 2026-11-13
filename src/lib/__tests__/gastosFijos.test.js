import { describe, it, expect, vi, beforeEach } from 'vitest'
import { firestoreMock, escrituras, coleccionesFake, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../db/firebase', () => ({ db: {}, auth: {}, storage: {} }))
import { generarGastosFijos } from '../gastosFijos'

const hoy = new Date('2026-11-12T10:00')
const plantilla = (id, extra = {}) => ({ id, nombre: 'Canva', monto: 12990, dia: 3, categoria: 'suscripciones', activo: true, ultimoMes: '2026-10', ...extra })

beforeEach(() => resetFirebaseMock())

describe('generarGastosFijos', () => {
  it('crea un gasto por pagar por cada mes faltante y avanza ultimoMes', async () => {
    coleccionesFake.gastosRecurrentes = [plantilla('r1', { ultimoMes: '2026-09' })]
    expect(await generarGastosFijos('u1', hoy)).toBe(2)
    expect(escrituras.sets.map(s => s.data.fecha.toDate().getMonth())).toEqual([9, 10])
    expect(escrituras.sets[0].data).toMatchObject({ monto: 12990, categoria: 'suscripciones', descripcion: 'Canva', recurrenteId: 'r1', pagado: false, userId: 'u1' })
    expect(escrituras.sets[1].data.fecha.toDate().getDate()).toBe(3)
    expect(escrituras.updates).toEqual([{ ref: 'gastosRecurrentes/r1', data: { ultimoMes: '2026-11' } }])
  })

  it('no repite el mes ya registrado ni genera plantillas inactivas', async () => {
    coleccionesFake.gastosRecurrentes = [plantilla('r1', { ultimoMes: '2026-11' }), plantilla('r2', { activo: false })]
    expect(await generarGastosFijos('u1', hoy)).toBe(0)
    expect(escrituras.sets).toHaveLength(0)
    expect(escrituras.updates).toHaveLength(0)
  })
})
