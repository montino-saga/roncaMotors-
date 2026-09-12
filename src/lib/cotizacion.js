import jsPDF from 'jspdf'
import logoUrl from '../assets/roncamotors_logo.jpeg'
import { TASA_IVA, esAfecto, netoDe } from './iva'

const MARGEN = 15
const ANCHO = 210          // A4 vertical, en mm
const ALTO = 297
const FONDO_FILA = 246
const VALIDEZ_DIAS = 15

const clp = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`

/**
 * El logo original pesa 231 KB. Embeberlo tal cual en cada cotización es
 * absurdo para un sello de 32 mm, así que se reescala una vez y se cachea.
 */
let logoCache
async function cargarLogo() {
    if (logoCache !== undefined) return logoCache
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image()
            el.onload = () => resolve(el)
            el.onerror = reject
            el.src = logoUrl
        })
        const ancho = 400
        const alto = Math.round(img.height * (ancho / img.width))
        const canvas = document.createElement('canvas')
        canvas.width = ancho
        canvas.height = alto
        canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto)
        logoCache = { dataUrl: canvas.toDataURL('image/jpeg', 0.82), ratio: img.width / img.height }
    } catch {
        logoCache = null   // sin logo la cotización sigue saliendo
    }
    return logoCache
}

const folioDe = (fecha) => {
    const p = (n) => String(n).padStart(2, '0')
    return `COT-${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}`
        + `-${p(fecha.getHours())}${p(fecha.getMinutes())}`
}

const fechaLarga = (d) => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * @param cart      ítems del carrito ({ nombreProducto, marcaProducto, idProducto, cantidad, ... })
 * @param precioDe  cómo obtener el precio unitario de un ítem
 * @param descuento rebaja en CLP sobre el total (opcional)
 * @param settings  { businessName } del ThemeContext
 */
export async function generarCotizacion({ cart, precioDe, descuento = 0, settings = {} }) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const logo = await cargarLogo()

    const ahora = new Date()
    const folio = folioDe(ahora)
    const vence = new Date(ahora.getTime() + VALIDEZ_DIAS * 86_400_000)
    const negocio = settings.businessName || 'Roncamotors'

    // Columnas: x de inicio y alineación. La descripción absorbe el sobrante.
    const xCodigo = MARGEN
    const xDesc = MARGEN + 26
    const xCant = ANCHO - MARGEN - 78
    const xUnit = ANCHO - MARGEN - 46
    const xTotal = ANCHO - MARGEN

    const cabeceraTabla = (y) => {
        doc.setFillColor(30, 41, 59)
        doc.rect(MARGEN, y, ANCHO - MARGEN * 2, 8, 'F')
        doc.setTextColor(255).setFontSize(8).setFont('helvetica', 'bold')
        doc.text('CÓDIGO', xCodigo + 2, y + 5.4)
        doc.text('DESCRIPCIÓN', xDesc, y + 5.4)
        doc.text('CANT', xCant + 14, y + 5.4, { align: 'right' })
        doc.text('P. UNIT', xUnit + 26, y + 5.4, { align: 'right' })
        doc.text('TOTAL', xTotal - 2, y + 5.4, { align: 'right' })
        return y + 8
    }

    // ---- Cabecera
    let y = MARGEN
    if (logo) {
        const w = 32
        doc.addImage(logo.dataUrl, 'JPEG', MARGEN, y, w, w / logo.ratio)
    }

    doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(20)
    doc.text('COTIZACIÓN', ANCHO - MARGEN, y + 6, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139)
    doc.text(folio, ANCHO - MARGEN, y + 12, { align: 'right' })
    doc.text(fechaLarga(ahora), ANCHO - MARGEN, y + 17, { align: 'right' })
    doc.text(`Válida hasta el ${fechaLarga(vence)}`, ANCHO - MARGEN, y + 22, { align: 'right' })

    doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(12)
    doc.text(negocio, MARGEN, y + 30)

    y += 38
    doc.setDrawColor(226, 232, 240).setLineWidth(0.4)
    doc.line(MARGEN, y, ANCHO - MARGEN, y)
    y += 8

    // ---- Tabla
    y = cabeceraTabla(y)
    doc.setFont('helvetica', 'normal').setFontSize(9)

    let total = 0, neto = 0, exentos = 0
    cart.forEach((item, i) => {
        const unit = Number(precioDe(item)) || 0
        const cantidad = Number(item.cantidad) || 0
        const subtotal = unit * cantidad
        const afecto = esAfecto(item)
        total += subtotal
        neto += netoDe(subtotal, afecto)
        if (!afecto) exentos += 1

        // Salto de página conservando la cabecera de la tabla.
        if (y > ALTO - 48) {
            doc.addPage()
            y = cabeceraTabla(MARGEN)
            doc.setFont('helvetica', 'normal').setFontSize(9)
        }

        if (i % 2 === 0) {
            doc.setFillColor(FONDO_FILA, 248, 250)
            doc.rect(MARGEN, y, ANCHO - MARGEN * 2, 9, 'F')
        }

        const nombre = item.nombreProducto || 'Producto'
        const marca = item.marcaProducto ? ` · ${item.marcaProducto}` : ''
        // El ancho de la descripción es fijo: hay que recortar, no desbordar.
        const desc = doc.splitTextToSize(nombre + marca, xCant - xDesc - 4)[0]

        doc.setTextColor(100, 116, 139).setFontSize(7.5)
        doc.text(String(item.idProducto || '—'), xCodigo + 2, y + 5.8)
        doc.setTextColor(15, 23, 42).setFontSize(9)
        doc.text(desc, xDesc, y + 5.8)
        doc.text(String(cantidad), xCant + 14, y + 5.8, { align: 'right' })
        doc.text(clp(unit), xUnit + 26, y + 5.8, { align: 'right' })
        doc.setFont('helvetica', 'bold')
        doc.text(clp(subtotal), xTotal - 2, y + 5.8, { align: 'right' })
        doc.setFont('helvetica', 'normal')

        y += 9
    })

    // El descuento global rebaja neto e IVA a prorrata: el IVA se declara
    // sobre lo efectivamente cobrado.
    const subtotal = total
    const rebaja = Math.min(Math.max(0, Number(descuento) || 0), subtotal)
    if (rebaja > 0 && subtotal > 0) {
        neto = neto * (1 - rebaja / subtotal)
        total = subtotal - rebaja
    }
    neto = Math.round(neto)
    const iva = Math.round(total) - neto

    // ---- Totales, con el IVA desglosado
    y += 4
    if (y > ALTO - (rebaja > 0 ? 72 : 60)) { doc.addPage(); y = MARGEN }

    const xCaja = ANCHO - MARGEN - 78
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(71, 85, 105)
    if (rebaja > 0) {
        doc.text('Subtotal', xCaja + 4, y + 5)
        doc.text(clp(subtotal), xTotal - 3, y + 5, { align: 'right' })
        doc.text('Descuento', xCaja + 4, y + 11)
        doc.text(`-${clp(rebaja)}`, xTotal - 3, y + 11, { align: 'right' })
        y += 12
    }
    doc.text('Neto', xCaja + 4, y + 5)
    doc.text(clp(neto), xTotal - 3, y + 5, { align: 'right' })
    doc.text(`IVA ${TASA_IVA}%`, xCaja + 4, y + 11)
    doc.text(clp(iva), xTotal - 3, y + 11, { align: 'right' })
    if (exentos > 0) {
        doc.setFontSize(7).setTextColor(148, 163, 184)
        doc.text(`(${exentos} ${exentos === 1 ? 'ítem exento' : 'ítems exentos'})`, xCaja + 4, y + 15.5)
        doc.setFontSize(9)
    }
    y += exentos > 0 ? 19 : 15

    doc.setFillColor(15, 23, 42)
    doc.rect(xCaja, y, 78, 13, 'F')
    doc.setTextColor(255).setFont('helvetica', 'bold')
    doc.setFontSize(9).text('TOTAL', xCaja + 4, y + 8.2)
    doc.setFontSize(13).text(clp(total), xTotal - 3, y + 8.6, { align: 'right' })

    // ---- Pie
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(148, 163, 184)
    const unidades = cart.reduce((a, it) => a + (Number(it.cantidad) || 0), 0)
    doc.text(
        `${cart.length} ${cart.length === 1 ? 'producto' : 'productos'} · ${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`,
        MARGEN, y + 8
    )
    doc.text(
        'Los precios pueden variar sin previo aviso una vez vencida la cotización. Sujeto a disponibilidad de stock.',
        MARGEN, ALTO - 12
    )

    const paginas = doc.getNumberOfPages()
    for (let p = 1; p <= paginas; p++) {
        doc.setPage(p)
        doc.setFontSize(7.5).setTextColor(148, 163, 184)
        doc.text(`${p} / ${paginas}`, ANCHO - MARGEN, ALTO - 12, { align: 'right' })
    }

    return { doc, folio, total, neto, iva }
}

/**
 * Comparte el PDF por el menú nativo (WhatsApp, correo…) cuando el dispositivo
 * lo permite; si no, lo descarga. Devuelve qué ocurrió para poder avisar.
 */
export async function compartirODescargar(doc, folio, negocio) {
    const nombre = `${folio}.pdf`
    const blob = doc.output('blob')
    const file = new File([blob], nombre, { type: 'application/pdf' })

    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: `Cotización ${negocio}` })
            return { via: 'compartido', nombre }
        } catch (err) {
            // El usuario cerró la hoja de compartir: no es un error que reportar.
            if (err?.name === 'AbortError') return { via: 'cancelado', nombre }
        }
    }

    doc.save(nombre)

    // Una descarga a ciegas no dice dónde quedó ni deja verla: esta URL
    // alimenta el botón "Abrir" del aviso.
    const url = URL.createObjectURL(blob)
    setTimeout(() => URL.revokeObjectURL(url), 120_000)
    return { via: 'descargado', nombre, url }
}
