/** RUT chileno. */

export const limpiarRut = (raw) => String(raw ?? '').replace(/[^0-9kK]/g, '').toUpperCase()

/** Normaliza a 12.345.678-9; devuelve lo limpio si no alcanza a ser un RUT. */
export const formatRut = (raw) => {
    const limpio = limpiarRut(raw)
    if (limpio.length < 2) return limpio
    const cuerpo = limpio.slice(0, -1)
    const dv = limpio.slice(-1)
    if (!/^\d+$/.test(cuerpo)) return limpio
    return `${Number(cuerpo).toLocaleString('es-CL')}-${dv}`
}

/** Dígito verificador (módulo 11) de un cuerpo numérico. */
export const digitoVerificador = (cuerpo) => {
    let suma = 0, mult = 2
    for (let i = String(cuerpo).length - 1; i >= 0; i--) {
        suma += Number(cuerpo[i]) * mult
        mult = mult === 7 ? 2 : mult + 1
    }
    const resto = 11 - (suma % 11)
    return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
}

export const validarRut = (raw) => {
    const limpio = limpiarRut(raw)
    if (limpio.length < 2) return false
    const cuerpo = limpio.slice(0, -1)
    if (!/^\d+$/.test(cuerpo)) return false
    return digitoVerificador(cuerpo) === limpio.slice(-1)
}
