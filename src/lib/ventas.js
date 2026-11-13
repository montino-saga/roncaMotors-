import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { db } from '../db/firebase'

const inicioDelDia = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
const finDelDia = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999)

export function fechaLocal(valor) {
    if (valor instanceof Date) return inicioDelDia(valor)
    const [anio, mes, dia] = String(valor).split('-').map(Number)
    return new Date(anio, mes - 1, dia)
}

export function rangoDeVentas(periodo, fechaReferencia = new Date(), desde, hasta) {
    if (periodo === 'custom') {
        const inicio = fechaLocal(desde)
        const fin = fechaLocal(hasta)
        return inicio <= fin
            ? { desde: inicio, hasta: finDelDia(fin) }
            : { desde: fin, hasta: finDelDia(inicio) }
    }

    const ancla = fechaLocal(fechaReferencia)
    const hastaFecha = finDelDia(ancla)
    let desdeFecha = new Date(ancla)

    switch (periodo) {
        case 'week':
            desdeFecha.setDate(desdeFecha.getDate() - 6)
            break
        case 'month':
            desdeFecha = new Date(ancla.getFullYear(), ancla.getMonth(), 1)
            break
        case '3months':
            desdeFecha = new Date(ancla.getFullYear(), ancla.getMonth() - 2, 1)
            break
        case '6months':
            desdeFecha = new Date(ancla.getFullYear(), ancla.getMonth() - 5, 1)
            break
        case 'year':
            desdeFecha = new Date(ancla.getFullYear(), 0, 1)
            break
    }

    return { desde: inicioDelDia(desdeFecha), hasta: hastaFecha }
}

export async function obtenerVentas(desde, hasta) {
    const ventas = await getDocs(query(
        collection(db, 'sales'),
        where('fechaVenta', '>=', Timestamp.fromDate(desde)),
        where('fechaVenta', '<=', Timestamp.fromDate(hasta)),
        orderBy('fechaVenta', 'desc'),
    ))
    return ventas.docs.map(documento => ({ id: documento.id, ...documento.data() }))
}

export const esAbono = (venta) => venta?.tipoPago === 'abono' || venta?.isAbono === true

export const esIngresoReal = (venta) =>
    ['efectivo', 'tarjeta', 'abono'].includes(venta?.tipoPago) || venta?.isAbono === true
