import { describe, it, expect } from 'vitest'
import { camposPublicos, slugify, normalizarTexto } from '../catalogoWeb.js'

const PRODUCTO = {
    idProducto: 'TEST-001',
    nombreProducto: 'Pastillas de freno delanteras',
    marcaProducto: 'Brembo',
    categoriaProducto: 'Frenos',
    compatibilidad: 'Toyota Hilux 2016-2022',
    precioVentaLocal: 24990,
    precioVentaWeb: 21990,
    precioOriginal: 12000,
    precioProducto: 24990,
    cantidadProducto: 7,
    imagenProducto: 'https://ejemplo/foto.jpg',
    afectoIva: true,
}

describe('camposPublicos', () => {
    it('no publica el costo ni los precios internos', () => {
        const publico = camposPublicos(PRODUCTO, 'doc1')
        for (const campo of ['precioOriginal', 'precioVentaLocal', 'precioProducto', 'afectoIva', 'cantidadProducto']) {
            expect(publico).not.toHaveProperty(campo)
        }
    })

    it('copia los campos públicos con el precio web', () => {
        expect(camposPublicos(PRODUCTO, 'doc1')).toEqual({
            idProducto: 'TEST-001',
            slug: 'pastillas-de-freno-delanteras-test-001',
            nombre: 'Pastillas de freno delanteras',
            marca: 'Brembo',
            categoria: 'Frenos',
            compatibilidad: 'Toyota Hilux 2016-2022',
            precio: 21990,
            stock: 7,
            imagen: 'https://ejemplo/foto.jpg',
            busqueda: 'pastillas de freno delanteras brembo test-001 frenos toyota hilux 2016-2022',
        })
    })

    it('cae al precio local cuando no hay precio web', () => {
        expect(camposPublicos({ ...PRODUCTO, precioVentaWeb: 0 }, 'doc1').precio).toBe(24990)
    })

    it('no publica sin nombre ni con precio 0 (así se despublica)', () => {
        expect(camposPublicos({ ...PRODUCTO, nombreProducto: '' }, 'doc1')).toBeNull()
        expect(camposPublicos({ ...PRODUCTO, precioVentaWeb: 0, precioVentaLocal: 0 }, 'doc1')).toBeNull()
        expect(camposPublicos(undefined, 'doc1')).toBeNull()
    })

    it('tolera productos antiguos sin compatibilidad ni imagen', () => {
        const publico = camposPublicos(
            { idProducto: 'A1', nombreProducto: 'Filtro', precioVentaLocal: 5000, cantidadProducto: '3' },
            'doc1'
        )
        expect(publico.compatibilidad).toBe('')
        expect(publico.imagen).toBe('')
        expect(publico.marca).toBe('')
        expect(publico.stock).toBe(3)
    })

    it('usa el id del documento cuando el producto no tiene código', () => {
        expect(camposPublicos({ ...PRODUCTO, idProducto: '' }, 'doc1').slug).toBe('pastillas-de-freno-delanteras-doc1')
    })

    it('recorta la compatibilidad a 200 caracteres', () => {
        const largo = 'a'.repeat(300)
        expect(camposPublicos({ ...PRODUCTO, compatibilidad: largo }, 'doc1').compatibilidad).toHaveLength(200)
    })

    it('ignora el stock inválido', () => {
        expect(camposPublicos({ ...PRODUCTO, cantidadProducto: undefined }, 'doc1').stock).toBe(0)
    })
})

describe('normalización', () => {
    it('quita tildes y mayúsculas', () => {
        expect(normalizarTexto('Suspensión Delantera')).toBe('suspension delantera')
    })

    it('arma slugs sin caracteres raros', () => {
        expect(slugify('Disco de freno 280mm / Ø')).toBe('disco-de-freno-280mm')
    })
})
