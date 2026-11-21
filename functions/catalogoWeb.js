/**
 * Campos públicos del catálogo: lo único que sale a internet.
 *
 * Vive aparte de index.js para poder probarlo sin arrancar firebase-admin.
 * Lo usan `espejarCatalogoWeb` y `backfillCatalogoWeb`.
 */

export const normalizarTexto = (texto) =>
    String(texto ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()

export const slugify = (texto) =>
    normalizarTexto(texto)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

/** Solo lo que puede ver cualquier persona en internet. */
export function camposPublicos(data, docId) {
    if (!data) return null

    const nombre = String(data.nombreProducto ?? '').trim()
    const idProducto = String(data.idProducto ?? '').trim()
    const marca = String(data.marcaProducto ?? '').trim()
    const categoria = String(data.categoriaProducto ?? '').trim()
    const compatibilidad = String(data.compatibilidad ?? '').trim().slice(0, 200)
    const imagen = String(data.imagenProducto ?? '')
    const stock = Number(data.cantidadProducto) || 0

    // El precio web manda; si no está cargado, cae al de local.
    const precioWeb = Number(data.precioVentaWeb) || 0
    const precio = precioWeb > 0 ? precioWeb : Number(data.precioVentaLocal) || 0

    // Sin nombre o sin precio no se publica: poner el precio en 0 despublica.
    if (!nombre || precio <= 0) return null

    return {
        idProducto,
        slug: `${slugify(nombre).slice(0, 60)}-${slugify(idProducto) || docId}`,
        nombre,
        marca,
        categoria,
        compatibilidad,
        precio,
        stock,
        imagen,
        busqueda: normalizarTexto([nombre, marca, idProducto, categoria, compatibilidad].filter(Boolean).join(' ')),
    }
}
