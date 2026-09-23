/** Patente chilena. */

export const limpiarPatente = (raw) => String(raw ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()

/** Formatos vigentes: autos LLLL·NN y LL·NNNN, motos LLL·NN y LL·NNN. */
const FORMATOS = [/^[A-Z]{4}\d{2}$/, /^[A-Z]{2}\d{4}$/, /^[A-Z]{3}\d{2}$/, /^[A-Z]{2}\d{3}$/]

export const validarPatente = (raw) => {
    const limpio = limpiarPatente(raw)
    return FORMATOS.some((re) => re.test(limpio))
}

/** Normaliza a LLLL-NN; devuelve lo limpio si no calza con ningún formato. */
export const formatPatente = (raw) => {
    const limpio = limpiarPatente(raw)
    if (!validarPatente(limpio)) return limpio
    const corte = limpio.search(/\d/)
    return `${limpio.slice(0, corte)}-${limpio.slice(corte)}`
}
