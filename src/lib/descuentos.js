/**
 * Descuentos del POS. Puras: sin React ni Firestore.
 *
 * Un descuento por ítem vive como `precioDescuento` (precio unitario final),
 * así total, ganancia, boleta y cotización lo heredan sin tocar nada más. El
 * descuento al total se guarda en CLP, no en %, porque el vendedor pacta
 * "te lo dejo en 10.000", no "un 7,3%".
 */

export const precioLista = (item) => Number(item?.precioVentaLocal ?? item?.precioProducto ?? 0)
export const precioCobrado = (item) => item?.precioDescuento != null ? Number(item.precioDescuento) : precioLista(item)

/**
 * Precio resultante de aplicar `valor` en modo 'pct' (0–100) o 'precio'
 * (final, ≤ base) sobre `base`. null si el valor no es válido.
 */
export function calcularDescuento(base, modo, valor) {
    if (valor === '' || valor == null) return null
    const v = Number(valor)
    if (isNaN(v) || v < 0) return null
    if (modo === 'pct') return v > 100 ? null : Math.round(base * (1 - v / 100))
    return v <= base ? v : null
}

/** Ítem con `precioDescuento` puesto, o sin él si el precio no rebaja nada. */
export function aplicarDescuentoItem(item, precioFinal) {
    if (precioFinal == null || precioFinal >= precioLista(item)) return quitarDescuentoItem(item)
    return { ...item, precioDescuento: precioFinal }
}

export function quitarDescuentoItem(item) {
    if (item?.precioDescuento == null) return item
    const { precioDescuento: _omit, ...rest } = item
    return rest
}

export const subtotalCarrito = (cart) => cart.reduce((t, it) => t + precioCobrado(it) * (Number(it.cantidad) || 0), 0)

/** Recorta el descuento al total para que nunca deje un total negativo. */
export const descuentoTotalAcotado = (cart, descuentoTotal) => {
    if (!cart.length) return 0
    return Math.min(Math.max(0, Number(descuentoTotal) || 0), subtotalCarrito(cart))
}

/** Totales de la venta tal como se guardan en `sales`. */
export function totalesCarrito(cart, descuentoTotal = 0) {
    const subtotal = subtotalCarrito(cart)
    const dcto = descuentoTotalAcotado(cart, descuentoTotal)
    const gananciaItems = cart.reduce((t, it) => t + (precioCobrado(it) - (Number(it.precioOriginal) || 0)) * (Number(it.cantidad) || 0), 0)
    return { subtotal, descuentoTotal: dcto, total: subtotal - dcto, ganancia: gananciaItems - dcto }
}

/** Suma de descuentos por ítem de una venta guardada (ventas antiguas: 0). */
export const descuentoItemsVenta = (sale) =>
    (sale?.productos || []).reduce((acc, p) => acc + (Number(p.descuento) || 0) * (Number(p.cantidad) || 0), 0)

export const ventaConDescuento = (sale) => (Number(sale?.descuentoTotal) || 0) > 0 || descuentoItemsVenta(sale) > 0

/**
 * Descuento al total que queda tras una devolución: la misma proporción sobre
 * el nuevo subtotal. Fijo en pesos devolvía de más (10% de $3.600 son $360;
 * devuelta la mitad, el descuento debe ser $180, no seguir en $360).
 */
export function descuentoProporcional(descuento, subtotalAntes, subtotalDespues) {
    const d = Number(descuento) || 0
    if (!(d > 0) || !(subtotalAntes > 0) || !(subtotalDespues > 0)) return 0
    return Math.min(subtotalDespues, Math.round(d * subtotalDespues / subtotalAntes))
}
