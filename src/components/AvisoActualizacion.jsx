import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ID = 'actualizacion'

// Hay un service worker nuevo esperando: se ofrece recargar, nunca se fuerza.
export function AvisoActualizacion() {
    const { needRefresh: [necesita], updateServiceWorker } = useRegisterSW()

    useEffect(() => {
        if (!necesita) return
        toast.info('Nueva versión disponible', {
            id: ID,
            duration: Infinity,
            description: 'Termina lo que estés haciendo y actualiza cuando quieras.',
            action: { label: 'Actualizar', onClick: () => updateServiceWorker(true) },
        })
    }, [necesita, updateServiceWorker])

    return null
}
