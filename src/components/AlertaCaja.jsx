import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { toast } from 'sonner'
import { db } from '../db/firebase'

const ID = 'caja-abierta'

// Caja abierta desde un día anterior: se olvidó cerrar. Toast persistente con
// salto a Cierre de Caja; desaparece solo cuando la sesión se cierra.
export function AlertaCaja() {
    const navigate = useNavigate()
    const { pathname } = useLocation()

    useEffect(() => {
        const q = query(collection(db, 'cash_registers'), where('status', '==', 'open'), limit(1))
        return onSnapshot(q, (snap) => {
            if (snap.empty) return toast.dismiss(ID)
            const abierta = snap.docs[0].data().openingTime?.toDate()
            if (!abierta) return
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
            if (abierta >= hoy) return toast.dismiss(ID)

            const horas = Math.floor((Date.now() - abierta) / 36e5)
            const desde = abierta.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })
            toast.warning('Caja sin cerrar', {
                id: ID,
                duration: Infinity,
                description: `Abierta desde el ${desde} (hace ${horas} h). Ciérrala antes de seguir vendiendo.`,
                action: pathname === '/' || pathname === '/cierre-caja'
                    ? undefined
                    : { label: 'Ir a caja', onClick: () => navigate('/') },
            })
        }, (error) => console.error('AlertaCaja:', error))
    }, [navigate, pathname])

    return null
}
