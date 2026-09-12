import { useEffect, useState } from 'react'

/**
 * true solo si `loading` lleva más de `delay` ms. Con la caché de Firestore la
 * mayoría de vistas resuelven en <50 ms y el skeleton parpadearía; en cuanto
 * `loading` baja, devuelve false al instante.
 */
export function useDelayedLoading(loading, delay = 150) {
    const [show, setShow] = useState(false)
    // Reset durante el render (no en un efecto): al bajar loading, la próxima
    // carga vuelve a esperar su delay.
    const [prev, setPrev] = useState(loading)
    if (prev !== loading) {
        setPrev(loading)
        if (!loading) setShow(false)
    }
    useEffect(() => {
        if (!loading) return
        const t = setTimeout(() => setShow(true), delay)
        return () => clearTimeout(t)
    }, [loading, delay])
    return loading && show
}
