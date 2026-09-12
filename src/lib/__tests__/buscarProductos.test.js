import { describe, it, expect } from 'vitest'
import { indexarPorCodigo, buscarPorCodigo, filtrarCatalogo, MAX_SUGERENCIAS } from '../buscarProductos'

const catalogo = [
  { id: 'd1', idProducto: 'ABC123', nombreProducto: 'Monster Blanco', marcaProducto: 'Monster' },
  { id: 'd2', idProducto: 'abc999', nombreProducto: 'Monster Verde', marcaProducto: 'Monster' },
  { id: 'd3', idProducto: '7801234', nombreProducto: 'Aceite 10W40', marcaProducto: 'Mobil' },
  { id: 'd4', idProducto: '', nombreProducto: 'Sin código', marcaProducto: '' },
  { id: 'd5', nombreProducto: 'Sin nada' },
]
const porCodigo = indexarPorCodigo(catalogo)

describe('indexarPorCodigo / buscarPorCodigo', () => {
  it('indexa en minúsculas y omite códigos vacíos', () => {
    expect(porCodigo.size).toBe(3)
    expect(porCodigo.has('')).toBe(false)
  })
  it('busca sin importar mayúsculas ni espacios (así llega del lector)', () => {
    expect(buscarPorCodigo(porCodigo, 'abc123').id).toBe('d1')
    expect(buscarPorCodigo(porCodigo, ' ABC999 ').id).toBe('d2')
    expect(buscarPorCodigo(porCodigo, '7801234').id).toBe('d3')
  })
  it('null si no existe', () => {
    expect(buscarPorCodigo(porCodigo, 'nada')).toBeNull()
    expect(buscarPorCodigo(porCodigo, '')).toBeNull()
    expect(buscarPorCodigo(porCodigo, undefined)).toBeNull()
  })
  it('ante códigos duplicados gana el primero', () => {
    const m = indexarPorCodigo([{ id: 'x', idProducto: 'A' }, { id: 'y', idProducto: 'a' }])
    expect(m.get('a').id).toBe('x')
  })
})

describe('filtrarCatalogo', () => {
  it('menos de 2 caracteres → nada', () => {
    expect(filtrarCatalogo(catalogo, porCodigo, 'm')).toEqual([])
    expect(filtrarCatalogo(catalogo, porCodigo, ' ')).toEqual([])
  })
  it('coincidencia exacta de código es un escaneo, no muestra lista', () => {
    expect(filtrarCatalogo(catalogo, porCodigo, 'ABC123')).toEqual([])
  })
  it('busca por nombre, código parcial y marca', () => {
    expect(filtrarCatalogo(catalogo, porCodigo, 'monster').map(p => p.id)).toEqual(['d1', 'd2'])
    expect(filtrarCatalogo(catalogo, porCodigo, 'abc').map(p => p.id)).toEqual(['d1', 'd2'])
    expect(filtrarCatalogo(catalogo, porCodigo, 'mobil').map(p => p.id)).toEqual(['d3'])
    expect(filtrarCatalogo(catalogo, porCodigo, '10w').map(p => p.id)).toEqual(['d3'])
  })
  it('tolera productos sin campos', () => {
    expect(filtrarCatalogo(catalogo, porCodigo, 'sin').map(p => p.id)).toEqual(['d4', 'd5'])
  })
  it('respeta el máximo', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({ id: String(i), idProducto: `Z${i}`, nombreProducto: `Tornillo ${i}` }))
    expect(filtrarCatalogo(muchos, indexarPorCodigo(muchos), 'tornillo')).toHaveLength(MAX_SUGERENCIAS)
    expect(filtrarCatalogo(muchos, indexarPorCodigo(muchos), 'tornillo', 3)).toHaveLength(3)
  })
})
