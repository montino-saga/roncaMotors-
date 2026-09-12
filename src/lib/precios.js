import { conIva, desglosar } from './iva'

// Los precios en CLP no llevan decimales: 1.333 + 17% = 1.559,61 no es un precio.
export const REDONDEO = 10
export const redondear = (n) => Math.round(n / REDONDEO) * REDONDEO

/**
 * Precio final desde costo neto y margen sobre el neto.
 * precio = (costo / (1 − margen)) × IVA. Con 40%: costo/0,6 × 1,19.
 * El margen es sobre el NETO (misma definición que el inventario) y el IVA se
 * suma después: aplicarlo al precio final disfrazaría de ganancia una pérdida.
 * Devuelve '' (string, para el input) si no se puede calcular.
 */
export const desdeMargen = (costo, pct, afecto = true) => {
    const m = Number(pct)
    if (!(costo > 0) || pct === '' || pct == null || isNaN(m) || m >= 100) return ''
    return String(redondear(conIva(costo / (1 - m / 100), afecto)))
}

/** Margen (% sobre neto) que implica un precio final ya escrito. null si no aplica. */
export const margenImplicito = (costo, precioFinal, afecto = true) => {
    const { neto } = desglosar(precioFinal, afecto)
    if (!(costo > 0) || !(neto > costo)) return null
    return Math.round(((neto - costo) / neto) * 100)
}

// Referencia fija del negocio, independiente del % elegido en el formulario.
export const DIVISOR_REF = 0.6
export const IVA_REF = 1.19

/** precioVenta = ⌈⌈costo ÷ 0,6⌉ × 1,19⌉, en pesos enteros. Exento: sin el × 1,19. */
export const formulaReferencia = (costo, afecto = true) => {
    if (!(costo > 0)) return null
    const neto = Math.ceil(costo / DIVISOR_REF)
    return { neto, precio: afecto ? Math.ceil(neto * IVA_REF) : neto }
}

/** Indicadores de una venta: ganancia, markup sobre costo y margen sobre neto. */
export const indicadores = (costo, precioFinal, afecto = true) => {
    const { neto, iva } = desglosar(precioFinal, afecto)
    const ganancia = neto - costo
    return {
        neto, iva, ganancia,
        markup: costo > 0 && neto > 0 ? (ganancia / costo) * 100 : null,
        margen: neto > 0 ? (ganancia / neto) * 100 : null,
        perdida: costo > 0 && neto > 0 && neto < costo,
    }
}
