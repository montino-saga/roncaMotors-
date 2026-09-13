import { describe, it, expect, vi, beforeEach } from 'vitest'
import { firestoreMock, coleccionesFake, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../db/firebase', () => ({ db: {} }))
import { cargarClientes, clientesEnCache, invalidarClientes } from '../clientes'

beforeEach(() => { resetFirebaseMock(); invalidarClientes(); coleccionesFake.clients = [{ id: 'a', name: 'Ana' }] })

describe('clientes (caché de sesión)', () => {
  it('una sola lectura mientras la caché viva', async () => {
    expect(clientesEnCache()).toEqual([])
    expect(await cargarClientes()).toEqual([{ id: 'a', name: 'Ana' }])
    coleccionesFake.clients = [{ id: 'b', name: 'Beto' }]
    expect(await cargarClientes()).toEqual([{ id: 'a', name: 'Ana' }])
    expect(firestoreMock.getDocs).toHaveBeenCalledTimes(1)
    expect(clientesEnCache()).toHaveLength(1)
  })
  it('invalidar fuerza relectura', async () => {
    await cargarClientes()
    invalidarClientes()
    coleccionesFake.clients = [{ id: 'b', name: 'Beto' }]
    expect(await cargarClientes()).toEqual([{ id: 'b', name: 'Beto' }])
    expect(firestoreMock.getDocs).toHaveBeenCalledTimes(2)
  })
})
