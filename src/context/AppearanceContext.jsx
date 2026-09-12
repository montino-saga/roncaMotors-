import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { usePersistedState } from '../hooks/usePersistedState'

const CLAVE_TEMA = 'roncamotors_theme'

const AppearanceContext = createContext({ mode: 'dark', resolved: 'dark', setMode: () => {} })

const mq = (q) => window.matchMedia(q)
const useMedia = (q, ssr) => useSyncExternalStore(
    (cb) => { const m = mq(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => mq(q).matches,
    () => ssr,
)

// Mismo atributo que fija el script de arranque de index.html: aquí solo se
// mantiene al día cuando cambia la preferencia o la del sistema.
function aplicarTema(resolved) {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.style.colorScheme = resolved
}

export function AppearanceProvider({ children }) {
    const [mode, setModeRaw] = usePersistedState(CLAVE_TEMA, 'system')
    const prefiereOscuro = useMedia('(prefers-color-scheme: dark)', true)
    const reduce = useMedia('(prefers-reduced-motion: reduce)', false)
    const resolved = mode === 'system' ? (prefiereOscuro ? 'dark' : 'light') : mode

    useEffect(() => { aplicarTema(resolved) }, [resolved])

    // Cambio de tema con View Transitions: la ola (máscara + blur en index.css)
    // va de arriba-izquierda a abajo-derecha.
    const setMode = useCallback((m) => {
        const nuevo = m === 'system' ? (prefiereOscuro ? 'dark' : 'light') : m
        if (nuevo === resolved || reduce || !document.startViewTransition) { setModeRaw(m); return }
        document.startViewTransition(() => {
            aplicarTema(nuevo)
            flushSync(() => setModeRaw(m))
        })
    }, [prefiereOscuro, reduce, resolved, setModeRaw])

    const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode])
    return (
        <AppearanceContext.Provider value={value}>
            {children}
        </AppearanceContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAppearance = () => useContext(AppearanceContext)
