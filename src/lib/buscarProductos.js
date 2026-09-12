/**
 * Búsqueda del catálogo en memoria. Firestore no busca por subcadena, así que
 * el filtro vive aquí; son funciones puras para poder probarlas sin Firebase.
 */

const norm = (s) => String(s ?? '').trim().toLowerCase()

/** Map código → producto (case-insensitive). El código es único a nivel de app. */
export function indexarPorCodigo(productos) {
    const m = new Map()
    for (const p of productos) {
        const k = norm(p.idProducto)
        if (k && !m.has(k)) m.set(k, p)
    }
    return m
}

export function buscarPorCodigo(porCodigo, code) {
    return porCodigo.get(norm(code)) ?? null
}

export const MIN_BUSQUEDA = 2
export const MAX_SUGERENCIAS = 8

/**
 * Sugerencias por nombre, código o marca. Devuelve [] si el término es corto
 * o si coincide exacto con un código: eso es un escaneo, no una búsqueda.
 */
export function filtrarCatalogo(productos, porCodigo, termino, max = MAX_SUGERENCIAS) {
    const t = norm(termino)
    if (t.length < MIN_BUSQUEDA) return []
    if (porCodigo.has(t)) return []
    const out = []
    for (const p of productos) {
        if (norm(p.nombreProducto).includes(t) || norm(p.idProducto).includes(t) || norm(p.marcaProducto).includes(t)) {
            out.push(p)
            if (out.length >= max) break
        }
    }
    return out
}
