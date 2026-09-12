import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useOnline } from '../hooks/useOnline'

const ID = 'conexion'

// Firestore encola las escrituras sin red; el usuario tiene que saber que
// lo que ve "guardado" aún no salió del dispositivo.
export function AvisoConexion() {
    const online = useOnline()
    const estuvoOffline = useRef(false)

    useEffect(() => {
        if (!online) {
            estuvoOffline.current = true
            toast.warning('Sin conexión', {
                id: ID,
                duration: Infinity,
                dismissible: false,
                description: 'Los cambios se guardan en este dispositivo y se sincronizan al volver la red.',
            })
            return
        }
        if (!estuvoOffline.current) return
        toast.success('Conexión restablecida', { id: ID, duration: 4000, description: 'Sincronizando cambios pendientes.' })
    }, [online])

    return null
}
