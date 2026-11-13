import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../db/firebase'

/**
 * true/false según haya una sesión de caja abierta; null mientras se consulta.
 * Vender con la caja cerrada deja ventas en efectivo fuera de todo cierre Z.
 */
export function useCajaAbierta() {
    const [abierta, setAbierta] = useState(null)
    useEffect(() => {
        const q = query(collection(db, 'cash_registers'), where('status', '==', 'open'), limit(1))
        return onSnapshot(
            q,
            (snap) => setAbierta(!snap.empty),
            (error) => {
                // Sin poder confirmar, no se bloquea la venta: peor es dejar el mostrador parado.
                console.error('Estado de caja:', error)
                setAbierta(true)
            }
        )
    }, [])
    return abierta
}
