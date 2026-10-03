import { describe, it, expect, vi } from 'vitest'
vi.mock('../../db/firebase', () => ({ db: {} }))
import { puedeEscribir, esDesarrollador, rolDe } from '../usuarios'

describe('permisos por rol', () => {
  it('lector no escribe; el resto sí, incluso con perfil cargando o sin doc', () => {
    expect(puedeEscribir({ rol: 'lector' })).toBe(false)
    for (const p of [{ rol: 'admin' }, { rol: 'desarrollador' }, null, undefined]) expect(puedeEscribir(p)).toBe(true)
  })
  it('solo desarrollador gestiona usuarios; rol desconocido se trata como admin', () => {
    expect(esDesarrollador({ rol: 'desarrollador' })).toBe(true)
    expect(esDesarrollador({ rol: 'admin' })).toBe(false)
    expect(rolDe('raro').id).toBe('admin')
  })
})
