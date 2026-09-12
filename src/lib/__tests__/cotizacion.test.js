// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'

// jsdom no carga imágenes: el Image del logo dispara onerror y el PDF sale sin logo.
beforeAll(() => {
  globalThis.Image = class { set src(_v) { setTimeout(() => this.onerror?.(), 0) } }
})
vi.mock('../marca', () => ({ LOGO_LOCAL: 'logo.jpeg', NOMBRE_NEGOCIO: 'Roncamotors' }))

import { generarCotizacion } from '../cotizacion'

const cart = [
  { idProducto: 'A1', nombreProducto: 'Cadena 428', cantidad: 2, precioVentaLocal: 10000 },
  { idProducto: 'B2', nombreProducto: 'Mano de obra', cantidad: 1, precioVentaLocal: 5000, afectoIva: false },
]
const precio = (i) => i.precioVentaLocal
// El texto va en literales (…) Tj; los acentos salen en WinAnsi, así que se
// afirma sobre fragmentos ASCII.
const contenido = (doc) => doc.output()

describe('generarCotizacion con datos de la empresa', () => {
  it('cabecera con giro, RUT, dirección, contacto y web', async () => {
    const { doc, total } = await generarCotizacion({
      cart, precioDe: precio,
      settings: { businessName: 'Taller Norte', giro: 'Motos y repuestos', rut: '76.123.456-7', direccion: 'Av. Prueba 123', telefono: '+56 9 1111 2222', email: 'hola@taller.cl', web: 'www.taller.cl' },
    })
    const pdf = contenido(doc)
    for (const frag of ['Taller Norte', 'Motos y repuestos', 'RUT 76.123.456-7', 'Av. Prueba 123', '+56 9 1111 2222', 'hola@taller.cl', 'www.taller.cl', 'Cadena 428']) {
      expect(pdf, frag).toContain(frag)
    }
    expect(total).toBe(25000)
  })

  it('sin datos: nombre y giro por defecto, sin línea de RUT', async () => {
    const { doc } = await generarCotizacion({ cart, precioDe: precio, settings: {} })
    const pdf = contenido(doc)
    expect(pdf).toContain('Roncamotors')
    expect(pdf).toContain('Repuestos y accesorios')
    expect(pdf).not.toContain('RUT ')
  })

  it('validez configurable y pie personalizado', async () => {
    const hoy = new Date()
    const { doc } = await generarCotizacion({ cart, precioDe: precio, settings: { validezDias: 3, piePagina: 'Pago al contado. Sin devoluciones.' } })
    const pdf = contenido(doc)
    const vence = new Date(hoy.getTime() + 3 * 86_400_000)
    expect(pdf).toContain(String(vence.getDate()))
    expect(pdf).toContain('Pago al contado. Sin devoluciones.')
    expect(pdf).not.toContain('Los precios pueden variar')
  })
})
