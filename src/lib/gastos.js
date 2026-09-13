// Gastos del local (publicidad, arriendo, arreglos…). Distintos de los
// movimientos de caja chica de CashClose: esto es contabilidad del negocio,
// no lo que sale del cajón.

export const CATEGORIAS = [
    { id: 'publicidad',  label: 'Publicidad',       color: 'pink' },
    { id: 'arriendo',    label: 'Arriendo',         color: 'blue' },
    { id: 'servicios',   label: 'Servicios',        color: 'cyan' },
    { id: 'arreglos',    label: 'Arreglos',         color: 'orange' },
    { id: 'sueldos',     label: 'Sueldos',          color: 'purple' },
    { id: 'insumos',     label: 'Insumos',          color: 'emerald' },
    { id: 'transporte',  label: 'Transporte',       color: 'yellow' },
    { id: 'impuestos',   label: 'Impuestos',        color: 'red' },
    { id: 'otro',        label: 'Otro',             color: 'slate' },
]

export const categoriaDe = (id) => CATEGORIAS.find(c => c.id === id) ?? CATEGORIAS[CATEGORIAS.length - 1]

const fecha = (g) => g.fecha?.toDate?.() ?? g.fecha

export const inicioMes = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
export const finMes = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
export const mesAnterior = (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
export const mesSiguiente = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
export const mismoMes = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

/** Separa una lista (que puede traer dos meses) en el mes pedido y el anterior. */
export function partirPorMes(gastos, mes) {
    const previo = mesAnterior(mes)
    const actual = [], anterior = []
    for (const g of gastos) {
        const f = fecha(g)
        if (!f) continue
        if (mismoMes(f, mes)) actual.push(g)
        else if (mismoMes(f, previo)) anterior.push(g)
    }
    return { actual, anterior }
}

const suma = (arr) => arr.reduce((a, g) => a + (Number(g.monto) || 0), 0)

/** Total, variación contra el mes anterior y desglose por categoría (mayor primero). */
export function resumenGastos(actual, anterior = []) {
    const total = suma(actual)
    const totalAnterior = suma(anterior)
    const variacion = totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : null

    const acc = new Map()
    for (const g of actual) {
        const id = g.categoria || 'otro'
        acc.set(id, (acc.get(id) || 0) + (Number(g.monto) || 0))
    }
    const porCategoria = [...acc.entries()]
        .map(([id, monto]) => ({ ...categoriaDe(id), monto, pct: total ? (monto / total) * 100 : 0 }))
        .sort((a, b) => b.monto - a.monto)

    return { total, totalAnterior, variacion, cantidad: actual.length, porCategoria, mayor: porCategoria[0] ?? null }
}

/** Filtro de la lista: categoría exacta y texto libre sobre la descripción. */
export function filtrarGastos(gastos, { categoria = '', texto = '' } = {}) {
    const t = texto.trim().toLowerCase()
    return gastos.filter(g =>
        (!categoria || g.categoria === categoria) &&
        (!t || (g.descripcion || '').toLowerCase().includes(t) || categoriaDe(g.categoria).label.toLowerCase().includes(t))
    )
}
