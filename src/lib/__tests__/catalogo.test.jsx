// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { firestoreMock, emitirCatalogo, resetFirebaseMock } from '../../test/firebaseMock'

vi.mock('firebase/firestore', () => firestoreMock)
vi.mock('../../db/firebase', () => ({ db: {} }))
import { useCatalogo, catalogoActual, refProductoPorCodigo } from '../catalogo'

beforeEach(() => { resetFirebaseMock(); emitirCatalogo([{ id: 'doc1', idProducto: 'A1', nombreProducto: 'Cadena' }]) })

describe('catálogo compartido', () => {
  it('el hook expone productos e índice por código en tiempo real', () => {
    const { result } = renderHook(() => useCatalogo())
    expect(result.current.listo).toBe(true)
    expect(result.current.productos).toHaveLength(1)
    act(() => emitirCatalogo([{ id: 'doc1', idProducto: 'A1' }, { id: 'doc2', idProducto: 'B2' }]))
    expect(result.current.productos).toHaveLength(2)
    expect(catalogoActual().productos).toHaveLength(2)
  })
  it('refProductoPorCodigo: en memoria sin lecturas; si no está, consulta', async () => {
    renderHook(() => useCatalogo())
    firestoreMock.getDocs.mockClear()
    const ref = await refProductoPorCodigo('A1')
    expect(ref.path).toBe('productos/doc1')
    expect(firestoreMock.getDocs).not.toHaveBeenCalled()
    expect(await refProductoPorCodigo('NO-EXISTE')).toBeNull()
    expect(firestoreMock.getDocs).toHaveBeenCalledTimes(1)
  })
})
