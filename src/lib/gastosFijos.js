import { collection, doc, getDocs, query, runTransaction, Timestamp, where } from 'firebase/firestore'
import { db } from '../db/firebase'
import { claveMes, gastoDeFijo, mesesPendientes } from './gastos'

/**
 * Registra los gastos fijos de los meses que aún no se generaron. Corre al
 * abrir la app; la transacción sobre la plantilla evita duplicados si dos
 * pestañas o equipos entran a la vez. Devuelve cuántos gastos creó.
 */
export async function generarGastosFijos(userId, hoy = new Date()) {
    const actual = claveMes(hoy)
    const snap = await getDocs(query(collection(db, 'gastosRecurrentes'), where('activo', '==', true)))
    let creados = 0
    for (const d of snap.docs) {
        if ((d.data().ultimoMes || '') >= actual) continue
        creados += await runTransaction(db, async (tx) => {
            const ref = doc(db, 'gastosRecurrentes', d.id)
            const s = await tx.get(ref)
            const r = s.exists() ? s.data() : null
            if (!r?.activo || (r.ultimoMes || '') >= actual) return 0
            const meses = mesesPendientes(r.ultimoMes, hoy)
            for (const mes of meses) {
                const g = gastoDeFijo(d.id, r, mes)
                tx.set(doc(collection(db, 'gastos')), { ...g, fecha: Timestamp.fromDate(g.fecha), creadoEn: Timestamp.now(), userId: userId || null })
            }
            tx.update(ref, { ultimoMes: actual })
            return meses.length
        })
    }
    return creados
}

// Una sola generación por mes y sesión: Layout y la vista Gastos la piden a
// la vez y Gastos espera a que termine antes de cargar la lista.
let enCurso = null
let mesEnCurso = ''

export function asegurarGastosFijos(userId) {
    const mes = claveMes(new Date())
    if (!enCurso || mesEnCurso !== mes) {
        mesEnCurso = mes
        enCurso = generarGastosFijos(userId).catch((error) => {
            console.error('Error generando gastos fijos:', error)
            enCurso = null
            return 0
        })
    }
    return enCurso
}

/** Solo para tests: olvida la generación cacheada. */
export const olvidarGastosFijos = () => { enCurso = null; mesEnCurso = '' }
