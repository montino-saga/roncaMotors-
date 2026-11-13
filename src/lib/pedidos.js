// Pedidos del local: encargos de un cliente (repuestos por traer, trabajos)
// con abono inicial y saldo. No mueven stock, caja ni deuda de fiado: son un
// registro aparte hasta que se entregan.

export const ESTADOS = {
    pendiente: { label: 'Pendiente', clase: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    entregado: { label: 'Entregado', clase: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    cancelado: { label: 'Cancelado', clase: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
}

export const METODOS_ABONO = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'transferencia', label: 'Transferencia' },
]

const num = (v) => Number(v) || 0

export const totalItems = (items) => items.reduce((a, i) => a + num(i.precio) * num(i.cantidad), 0)

export const saldoDe = (p) => Math.max(0, num(p.total) - num(p.abonado))

/** Suma un producto del catálogo; si ya está, sube la cantidad. */
export function agregarProducto(items, producto) {
    const i = items.findIndex(x => x.idProducto && x.idProducto === producto.idProducto)
    if (i >= 0) return items.map((x, k) => k === i ? { ...x, cantidad: num(x.cantidad) + 1 } : x)
    return [...items, {
        idProducto: producto.idProducto ?? null,
        nombreProducto: producto.nombreProducto || 'Producto',
        cantidad: 1,
        precio: num(producto.precioVentaLocal ?? producto.precioProducto),
    }]
}

/** KPIs: solo cuentan los pendientes, lo entregado o cancelado ya no se cobra. */
export function resumenPedidos(pedidos) {
    const pendientes = pedidos.filter(p => p.estado === 'pendiente')
    return {
        pendientes: pendientes.length,
        porCobrar: pendientes.reduce((a, p) => a + saldoDe(p), 0),
        abonado: pendientes.reduce((a, p) => a + num(p.abonado), 0),
    }
}

/** Estado exacto ('' = todos) y texto sobre cliente, descripción o productos. */
export function filtrarPedidos(pedidos, { estado = '', texto = '' } = {}) {
    const t = texto.trim().toLowerCase()
    return pedidos.filter(p =>
        (!estado || p.estado === estado) &&
        (!t
            || (p.nombreCliente || '').toLowerCase().includes(t)
            || (p.descripcion || '').toLowerCase().includes(t)
            || (p.productos || []).some(i => (i.nombreProducto || '').toLowerCase().includes(t)))
    )
}

/** Datos del abono a registrar: no puede superar lo que se debe. */
export function validarAbono(monto, saldo) {
    const m = num(monto)
    if (!(m > 0)) return 'Ingresa un monto válido'
    if (m > saldo) return 'El abono supera lo que se debe'
    return null
}
