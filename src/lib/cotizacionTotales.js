import { esAfecto, netoDe } from './iva'

/**
 * Totales de una cotización/venta con descuentos por ítem y al total. Pura:
 * jsPDF no entra aquí, así se puede probar.
 *
 * El IVA se declara sobre lo efectivamente cobrado, así que el descuento al
 * total rebaja neto e IVA a prorrata.
 */
export function totalesCotizacion(cart, precioDe, precioListaDe = precioDe, descuento = 0) {
    let lista = 0, cobrado = 0, neto = 0, exentos = 0
    const filas = cart.map((item) => {
        const cantidad = Number(item.cantidad) || 0
        const unitLista = Number(precioListaDe(item)) || 0
        const unit = Number(precioDe(item)) || 0
        const dctoUnit = Math.max(0, unitLista - unit)
        const subtotal = unit * cantidad
        const afecto = esAfecto(item)
        lista += unitLista * cantidad
        cobrado += subtotal
        neto += netoDe(subtotal, afecto)
        if (!afecto) exentos += 1
        return { item, cantidad, unitLista, unit, dctoUnit, dcto: dctoUnit * cantidad, subtotal, afecto }
    })

    const descuentoItems = lista - cobrado
    const descuentoTotal = Math.min(Math.max(0, Number(descuento) || 0), cobrado)
    if (descuentoTotal > 0 && cobrado > 0) neto = neto * (1 - descuentoTotal / cobrado)

    const total = Math.round(cobrado - descuentoTotal)
    const netoR = Math.round(neto)
    return {
        filas,
        subtotalLista: Math.round(lista),
        descuentoItems: Math.round(descuentoItems),
        descuentoTotal: Math.round(descuentoTotal),
        descuentos: Math.round(descuentoItems + descuentoTotal),
        neto: netoR,
        iva: total - netoR,
        total,
        exentos,
        unidades: filas.reduce((a, f) => a + f.cantidad, 0),
    }
}
