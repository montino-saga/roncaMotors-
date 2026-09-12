import jsPDF from 'jspdf'
import { LOGO_LOCAL as logoUrl } from './marca'
import { TASA_IVA } from './iva'
import { totalesCotizacion } from './cotizacionTotales'
import { NOMBRE_NEGOCIO } from './marca'

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
 * @param cart          ítems del carrito ({ nombreProducto, marcaProducto, idProducto, cantidad, ... })
 * @param precioDe      precio unitario cobrado de un ítem (con su descuento)
 * @param precioListaDe precio unitario de lista (sin descuento); por defecto el mismo
 * @param descuento     rebaja en CLP sobre el total (opcional)
 * @param settings      { businessName } del ThemeContext
 */
export async function generarCotizacion({ cart, precioDe, precioListaDe = precioDe, descuento = 0, settings = {} }) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const logo = await cargarLogo()

    const ahora = new Date()
    const folio = folioDe(ahora)
    const vence = new Date(ahora.getTime() + VALIDEZ_DIAS * 86_400_000)
    const negocio = settings.businessName || NOMBRE_NEGOCIO

    const t = totalesCotizacion(cart, precioDe, precioListaDe, descuento)
    const hayDcto = t.descuentos > 0

    // Columnas de derecha a izquierda: la descripción absorbe el sobrante.
    // La columna DCTO solo existe si hay algún descuento en la cotización.
    const xTotal = ANCHO - MARGEN
    const xUnit = xTotal - 30
    const xDcto = hayDcto ? xUnit - 24 : xUnit
    const xCant = xDcto - 16
    const xCodigo = MARGEN
    const xDesc = MARGEN + 24
    const ALTO_FILA = 9

    const cabeceraTabla = (y) => {
        doc.setFillColor(30, 41, 59)
        doc.rect(MARGEN, y, ANCHO - MARGEN * 2, 8, 'F')
        doc.setTextColor(255).setFontSize(8).setFont('helvetica', 'bold')
        doc.text('CÓDIGO', xCodigo + 2, y + 5.4)
        doc.text('DESCRIPCIÓN', xDesc, y + 5.4)
        doc.text('CANT', xCant, y + 5.4, { align: 'right' })
        if (hayDcto) doc.text('DCTO', xDcto, y + 5.4, { align: 'right' })
        doc.text('P. UNIT', xUnit, y + 5.4, { align: 'right' })
        doc.text('TOTAL', xTotal - 2, y + 5.4, { align: 'right' })
        return y + 8
    }

    // ---- Cabecera: logo y nombre a la izquierda, en línea; datos a la derecha.
    let y = MARGEN
    const LOGO = 26
    let xNombre = MARGEN
    if (logo) {
        doc.addImage(logo.dataUrl, 'JPEG', MARGEN, y, LOGO, LOGO / logo.ratio)
        xNombre = MARGEN + LOGO + 5
    }
    doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(15)
    doc.text(negocio, xNombre, y + 11)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(100, 116, 139)
    doc.text('Repuestos y accesorios', xNombre, y + 16.5)

    doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(20)
    doc.text('COTIZACIÓN', ANCHO - MARGEN, y + 8, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139)
    doc.text(folio, ANCHO - MARGEN, y + 14, { align: 'right' })
    doc.text(fechaLarga(ahora), ANCHO - MARGEN, y + 19, { align: 'right' })
    doc.text(`Válida hasta el ${fechaLarga(vence)}`, ANCHO - MARGEN, y + 24, { align: 'right' })

    y += Math.max(LOGO, 26) + 6
    doc.setDrawColor(226, 232, 240).setLineWidth(0.4)
    doc.line(MARGEN, y, ANCHO - MARGEN, y)
    y += 8

    // ---- Tabla
    y = cabeceraTabla(y)
    doc.setFont('helvetica', 'normal').setFontSize(9)

    t.filas.forEach((f, i) => {
        // Salto de página conservando la cabecera de la tabla.
        if (y > ALTO - 48) {
            doc.addPage()
            y = cabeceraTabla(MARGEN)
            doc.setFont('helvetica', 'normal').setFontSize(9)
        }

        if (i % 2 === 0) {
            doc.setFillColor(FONDO_FILA, 248, 250)
            doc.rect(MARGEN, y, ANCHO - MARGEN * 2, ALTO_FILA, 'F')
        }

        const nombre = f.item.nombreProducto || 'Producto'
        const marca = f.item.marcaProducto && f.item.marcaProducto !== nombre ? ` · ${f.item.marcaProducto}` : ''
        // El ancho de la descripción es fijo: hay que recortar, no desbordar.
        const desc = doc.splitTextToSize(nombre + marca, xCant - 16 - xDesc)[0]

        doc.setTextColor(100, 116, 139).setFontSize(7.5)
        doc.text(String(f.item.idProducto || '—'), xCodigo + 2, y + 5.8)
        doc.setTextColor(15, 23, 42).setFontSize(9)
        doc.text(desc, xDesc, y + 5.8)
        doc.text(String(f.cantidad), xCant, y + 5.8, { align: 'right' })
        if (hayDcto) {
            if (f.dctoUnit > 0) {
                doc.setTextColor(180, 83, 9)
                doc.text(`-${clp(f.dctoUnit)}`, xDcto, y + 5.8, { align: 'right' })
                doc.setTextColor(15, 23, 42)
            } else {
                doc.setTextColor(148, 163, 184)
                doc.text('—', xDcto, y + 5.8, { align: 'right' })
                doc.setTextColor(15, 23, 42)
            }
        }
        if (f.dctoUnit > 0) {
            // Precio de lista tachado sobre el cobrado.
            doc.setFontSize(6.5).setTextColor(148, 163, 184)
            const txt = clp(f.unitLista)
            const w = doc.getTextWidth(txt)
            doc.text(txt, xUnit, y + 2.9, { align: 'right' })
            doc.setDrawColor(148, 163, 184).setLineWidth(0.3)
            doc.line(xUnit - w, y + 2.1, xUnit, y + 2.1)
            doc.setFontSize(9).setTextColor(15, 23, 42)
            doc.text(clp(f.unit), xUnit, y + 6.6, { align: 'right' })
        } else {
            doc.text(clp(f.unit), xUnit, y + 5.8, { align: 'right' })
        }
        doc.setFont('helvetica', 'bold')
        doc.text(clp(f.subtotal), xTotal - 2, y + 5.8, { align: 'right' })
        doc.setFont('helvetica', 'normal')

        y += ALTO_FILA
    })

    // ---- Totales
    const lineas = []
    if (hayDcto) {
        lineas.push(['Subtotal', clp(t.subtotalLista)])
        if (t.descuentoItems > 0) lineas.push(['Descuento por producto', `-${clp(t.descuentoItems)}`, 'dcto'])
        if (t.descuentoTotal > 0) lineas.push(['Descuento al total', `-${clp(t.descuentoTotal)}`, 'dcto'])
    }
    lineas.push(['Neto', clp(t.neto)])
    lineas.push([`IVA ${TASA_IVA}%`, clp(t.iva)])

    const altoCaja = lineas.length * 6 + 4 + 13
    y += 4
    if (y > ALTO - altoCaja - 20) { doc.addPage(); y = MARGEN }

    const ANCHO_CAJA = 84
    const xCaja = ANCHO - MARGEN - ANCHO_CAJA
    doc.setFont('helvetica', 'normal').setFontSize(9)
    lineas.forEach(([label, valor, tipo]) => {
        doc.setTextColor(...(tipo === 'dcto' ? [180, 83, 9] : [71, 85, 105]))
        doc.text(label, xCaja + 4, y + 5)
        doc.text(valor, xTotal - 3, y + 5, { align: 'right' })
        y += 6
    })
    y += 3

    doc.setFillColor(15, 23, 42)
    doc.rect(xCaja, y, ANCHO_CAJA, 13, 'F')
    doc.setTextColor(255).setFont('helvetica', 'bold')
    doc.setFontSize(9).text('TOTAL', xCaja + 4, y + 8.2)
    doc.setFontSize(13).text(clp(t.total), xTotal - 3, y + 8.6, { align: 'right' })

    if (hayDcto) {
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(180, 83, 9)
        doc.text(`Ahorro total: ${clp(t.descuentos)}`, xTotal - 3, y + 18, { align: 'right' })
    }

    // ---- Pie
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(148, 163, 184)
    doc.text(
        `${cart.length} ${cart.length === 1 ? 'producto' : 'productos'} · ${t.unidades} ${t.unidades === 1 ? 'unidad' : 'unidades'}`,
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

    return { doc, folio, total: t.total, neto: t.neto, iva: t.iva, descuentos: t.descuentos }
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
