/**
 * IVA chileno.
 *
 * Invariante del modelo: `precioVentaLocal` y `precioVentaWeb` son SIEMPRE el
 * precio final que paga el cliente. El campo `afectoIva` dice si ese precio
 * lleva el 19% dentro (true) o si el producto está exento (false).
 *
 * Para quitar el IVA se DIVIDE entre 1,19. Multiplicar por 0,19 un precio que
 * ya lo incluye da de más: sobre 1.800 daría 342 en vez de los 287 correctos.
 */
export const TASA_IVA = 19
const FACTOR = 1 + TASA_IVA / 100

// Productos anteriores al campo: se asumen afectos, que es el caso normal.
export const esAfecto = (producto) => producto?.afectoIva !== false

/** Precio sin IVA a partir del precio final. */
export const netoDe = (precioFinal, afecto = true) => {
    const p = Number(precioFinal) || 0
    return afecto ? p / FACTOR : p
}

/** Parte del precio final que corresponde a IVA. */
export const ivaDe = (precioFinal, afecto = true) => {
    const p = Number(precioFinal) || 0
    return afecto ? p - p / FACTOR : 0
}

/** Precio final a partir de un neto. */
export const conIva = (neto, afecto = true) => {
    const n = Number(neto) || 0
    return afecto ? n * FACTOR : n
}

/** Desglose completo, redondeado a peso. */
export const desglosar = (precioFinal, afecto = true) => {
    const total = Math.round(Number(precioFinal) || 0)
    const neto = Math.round(netoDe(total, afecto))
    return { neto, iva: total - neto, total, afecto }
}
