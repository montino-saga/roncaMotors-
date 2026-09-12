import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

// Frena la navegación interna (blocker) y el cierre de pestaña (beforeunload)
// mientras haya cambios sin guardar. `liberar()` desactiva el guard antes de
// un navigate() programático tras guardar: el estado aún no se ha re-renderizado
// cuando el router consulta el blocker.
export function useConfirmarSalida(sucio) {
    const liberado = useRef(false)

    const blocker = useBlocker(({ currentLocation, nextLocation }) =>
        sucio && !liberado.current && currentLocation.pathname !== nextLocation.pathname
    )

    useEffect(() => {
        if (!sucio) return
        const onBeforeUnload = (e) => {
            if (liberado.current) return
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [sucio])

    return { blocker, liberar: () => { liberado.current = true } }
}
