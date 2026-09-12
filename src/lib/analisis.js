// Cálculos de la vista Análisis. Puros: reciben ventas ya bajadas de Firestore
// (con fechaVenta.toDate()) y devuelven series listas para pintar.

export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const esVenta = (s) => s.tipoPago !== 'abono' && !s.isAbono
const fecha = (s) => s.fechaVenta?.toDate?.() ?? s.fechaVenta
const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
// Clave por fecha civil, no por getTime(): el día del cambio de hora en Chile
// (00:00 no existe) medianoche cae en 01:00 y los timestamps dejan de casar.
const claveDia = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Un punto por día del rango [desde, desde + dias), con ceros donde no hubo ventas. */
export function serieDiaria(ventas, desde, dias) {
    const base = inicioDia(desde)
    const porDia = new Map()
    for (let i = 0; i < dias; i++) {
        const d = new Date(base); d.setDate(base.getDate() + i)
        porDia.set(claveDia(d), { fecha: d, ventas: 0, ganancia: 0, pedidos: 0 })
    }
    for (const s of ventas) {
        if (!esVenta(s) || !fecha(s)) continue
        const p = porDia.get(claveDia(fecha(s)))
        if (!p) continue
        p.ventas += s.totalVenta || 0
        p.ganancia += s.totalGanancia || 0
        p.pedidos += 1
    }
    return [...porDia.values()]
}

/** Actual vs. período previo de igual largo, alineados por índice de día. */
export function serieConFantasma(actual, previo) {
    return actual.map((p, i) => ({
        dia: p.fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
        fecha: p.fecha,
        ventas: p.ventas,
        previo: previo[i]?.ventas ?? 0,
        fechaPrevio: previo[i]?.fecha,
    }))
}

const suma = (arr, k) => arr.reduce((a, p) => a + p[k], 0)
export const variacion = (actual, previo) => previo > 0 ? ((actual - previo) / previo) * 100 : null

/** KPIs con serie (sparkline) y variación contra el período previo. */
export function kpis(actual, previo) {
    const tot = (serie) => {
        const ventas = suma(serie, 'ventas'), ganancia = suma(serie, 'ganancia'), pedidos = suma(serie, 'pedidos')
        return { ventas, ganancia, pedidos, ticket: pedidos ? ventas / pedidos : 0 }
    }
    const a = tot(actual), p = tot(previo)
    const ticketDiario = (s) => s.pedidos ? s.ventas / s.pedidos : 0
    return [
        { clave: 'ventas',   label: 'Ventas',         valor: a.ventas,   delta: variacion(a.ventas, p.ventas),     serie: actual.map(s => s.ventas),   moneda: true },
        { clave: 'ganancia', label: 'Ganancia',       valor: a.ganancia, delta: variacion(a.ganancia, p.ganancia), serie: actual.map(s => s.ganancia), moneda: true },
        { clave: 'pedidos',  label: 'Pedidos',        valor: a.pedidos,  delta: variacion(a.pedidos, p.pedidos),   serie: actual.map(s => s.pedidos),  moneda: false },
        { clave: 'ticket',   label: 'Ticket promedio', valor: a.ticket,  delta: variacion(a.ticket, p.ticket),     serie: actual.map(ticketDiario),    moneda: true },
    ]
}

/** 7 filas (getDay: 0 = domingo) × 24 horas. Cuenta pedidos y monto. */
export function mapaCalor(ventas) {
    const celdas = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ pedidos: 0, monto: 0 })))
    let max = 0
    for (const s of ventas) {
        if (!esVenta(s) || !fecha(s)) continue
        const d = fecha(s)
        const c = celdas[d.getDay()][d.getHours()]
        c.pedidos += 1
        c.monto += s.totalVenta || 0
        if (c.pedidos > max) max = c.pedidos
    }
    return { celdas, max }
}

const pct = (n) => `${Math.round(n)}%`
const veces = (n) => `${n.toFixed(1).replace('.', ',')}×`
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Frases por reglas, sin IA. Cada una lleva `tono` (bueno | ojo | neutro) y
 * `peso` para ordenarlas: primero lo más accionable.
 */
export function insights({ actual, previo, ventas, clientes = [], mapa }) {
    const out = []
    const totalVentas = suma(actual, 'ventas')
    const totalPrevio = suma(previo, 'ventas')
    const pedidos = suma(actual, 'pedidos')
    if (pedidos === 0) return [{ tono: 'neutro', peso: 0, texto: 'Sin ventas en el período: nada que analizar todavía.' }]

    // Tendencia vs. período anterior
    const v = variacion(totalVentas, totalPrevio)
    if (v != null && Math.abs(v) >= 5) {
        out.push({
            tono: v > 0 ? 'bueno' : 'ojo', peso: 90,
            texto: `Ventas ${v > 0 ? 'suben' : 'bajan'} ${pct(Math.abs(v))} frente al período anterior.`,
        })
    }

    // Mejor vs. peor día de la semana (promedio por día real, no por suma)
    const porDia = Array.from({ length: 7 }, () => ({ ventas: 0, dias: 0 }))
    for (const p of actual) { const d = p.fecha.getDay(); porDia[d].ventas += p.ventas; porDia[d].dias += 1 }
    const prom = porDia.map((d, i) => ({ i, prom: d.dias ? d.ventas / d.dias : 0 })).filter(d => d.prom > 0)
    if (prom.length >= 3) {
        const mejor = prom.reduce((a, b) => b.prom > a.prom ? b : a)
        const peor = prom.reduce((a, b) => b.prom < a.prom ? b : a)
        const ratio = mejor.prom / peor.prom
        if (ratio >= 1.5) {
            out.push({
                tono: 'neutro', peso: 80,
                texto: `${capitalizar(DIAS_LARGO[mejor.i])} vende ${veces(ratio)} más que ${DIAS_LARGO[peor.i]}.`,
            })
        }
    }

    // Concentración de ganancia en pocos productos
    const gananciaPorProd = new Map()
    let gananciaTotal = 0
    for (const s of ventas) {
        if (!esVenta(s)) continue
        for (const p of s.productos ?? []) {
            const g = (p.cantidad || 0) * ((p.precioDescuento ?? p.precioVentaLocal ?? p.precioProducto ?? 0) - (p.precioOriginal || 0))
            gananciaPorProd.set(p.nombreProducto, (gananciaPorProd.get(p.nombreProducto) || 0) + g)
            gananciaTotal += g
        }
    }
    if (gananciaTotal > 0 && gananciaPorProd.size >= 8) {
        const top = [...gananciaPorProd.values()].sort((a, b) => b - a).slice(0, 5)
        const share = top.reduce((a, b) => a + b, 0) / gananciaTotal
        if (share >= 0.35) {
            out.push({ tono: 'neutro', peso: 70, texto: `5 productos generan el ${pct(share * 100)} de la ganancia.` })
        }
    }

    // Franja punta
    if (mapa) {
        const porHora = Array(24).fill(0)
        mapa.celdas.forEach(fila => fila.forEach((c, h) => { porHora[h] += c.pedidos }))
        let mejorIni = 0, mejorSuma = -1
        for (let h = 0; h <= 21; h++) {
            const s = porHora[h] + porHora[h + 1] + porHora[h + 2]
            if (s > mejorSuma) { mejorSuma = s; mejorIni = h }
        }
        const share = mejorSuma / pedidos
        if (share >= 0.3) {
            out.push({
                tono: 'neutro', peso: 60,
                texto: `Entre ${mejorIni}:00 y ${mejorIni + 3}:00 se hace el ${pct(share * 100)} de las ventas.`,
            })
        }
        const ultima = porHora.reduce((u, n, h) => n > 0 ? h : u, -1)
        if (ultima >= 0 && ultima <= 17) {
            out.push({ tono: 'ojo', peso: 40, texto: `Ninguna venta después de las ${ultima + 1}:00 en todo el período.` })
        }
    }

    // Fiado
    const fiado = ventas.filter(s => esVenta(s) && s.tipoPago === 'fiado').reduce((a, s) => a + (s.totalVenta || 0), 0)
    if (totalVentas > 0 && fiado / totalVentas >= 0.15) {
        out.push({ tono: 'ojo', peso: 75, texto: `El ${pct(fiado / totalVentas * 100)} de lo vendido salió fiado.` })
    }

    // Deuda concentrada
    const deudores = clientes.map(c => c.currentDebt || 0).filter(d => d > 0).sort((a, b) => b - a)
    const deudaTotal = deudores.reduce((a, b) => a + b, 0)
    if (deudores.length >= 4) {
        const top3 = deudores.slice(0, 3).reduce((a, b) => a + b, 0)
        const share = top3 / deudaTotal
        if (share >= 0.5) {
            out.push({ tono: 'ojo', peso: 85, texto: `3 clientes concentran el ${pct(share * 100)} de la deuda.` })
        }
    }

    // Ticket
    const ticketA = totalVentas / pedidos
    const pedidosP = suma(previo, 'pedidos')
    const ticketP = pedidosP ? totalPrevio / pedidosP : 0
    const vt = variacion(ticketA, ticketP)
    if (vt != null && Math.abs(vt) >= 10) {
        out.push({
            tono: vt > 0 ? 'bueno' : 'ojo', peso: 50,
            texto: `Ticket promedio ${vt > 0 ? 'sube' : 'baja'} ${pct(Math.abs(vt))}: ${vt > 0 ? 'se compra más por visita' : 'se compra menos por visita'}.`,
        })
    }

    return out.sort((a, b) => b.peso - a.peso)
}
