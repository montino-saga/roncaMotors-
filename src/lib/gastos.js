// Gastos del local (publicidad, arriendo, arreglos…). Distintos de los
// movimientos de caja chica de CashClose: esto es contabilidad del negocio,
// no lo que sale del cajón.

export const CATEGORIAS = [
    { id: 'publicidad',  label: 'Publicidad',       color: 'pink' },
    { id: 'arriendo',    label: 'Arriendo',         color: 'blue' },
    { id: 'suscripciones', label: 'Suscripciones',  color: 'indigo' },
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

/* ------------------------------ Gastos fijos ------------------------------ */
// Un gasto marcado como fijo crea una plantilla en `gastosRecurrentes`. Al
// entrar a la app en un mes nuevo se registra solo como gasto "por pagar"
// (`pagado: false`) y se marca pagado desde la lista.

/** 'YYYY-MM': compara como texto en orden cronológico. */
export const claveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Día de pago dentro del mes; el 31 cae el último día en meses cortos. */
export function vencimientoEn(dia, mes) {
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    return new Date(mes.getFullYear(), mes.getMonth(), Math.min(Number(dia) || 1, ultimo), 12)
}

/**
 * Meses que faltan por registrar desde `ultimoMes` (exclusivo) hasta el de
 * `hoy` (inclusivo). Tope de 12: si nadie abrió la app en un año, no inundar.
 */
export function mesesPendientes(ultimoMes, hoy = new Date()) {
    const actual = inicioMes(hoy)
    if (!ultimoMes) return [actual]
    const [y, m] = ultimoMes.split('-').map(Number)
    const meses = []
    for (let d = new Date(y, m, 1); d <= actual; d = mesSiguiente(d)) meses.push(d)
    return meses.slice(-12)
}

/** Gasto "por pagar" que genera una plantilla en un mes. */
export function gastoDeFijo(recurrenteId, r, mes) {
    return {
        fecha: vencimientoEn(r.dia, mes),
        monto: Number(r.monto) || 0,
        categoria: r.categoria || 'otro',
        descripcion: r.nombre || '',
        recurrenteId,
        pagado: false,
    }
}
