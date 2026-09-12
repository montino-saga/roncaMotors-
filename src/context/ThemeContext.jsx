import { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../db/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { NOMBRE_NEGOCIO, LOGO_LOCAL } from '../lib/marca'

const ThemeContext = createContext()

const POR_DEFECTO = {
    logo: LOGO_LOCAL, primaryColor: '#3b82f6', businessName: NOMBRE_NEGOCIO,
    giro: 'Repuestos y accesorios', rut: '', direccion: '', telefono: '', email: '', web: '',
    validezDias: 15, piePagina: '',
}

export function ThemeProvider({ children }) {
    const [settings, setSettings] = useState(POR_DEFECTO)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Real-time listener for settings
        const unsub = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
            if (doc.exists()) {
                const data = doc.data()
                // Campos vacíos en Firestore no borran la marca local.
                setSettings({
                    ...POR_DEFECTO,
                    ...data,
                    logo: data.logo || LOGO_LOCAL,
                    businessName: data.businessName || NOMBRE_NEGOCIO,
                })
                if (data.primaryColor) document.documentElement.style.setProperty('--primary-color', data.primaryColor)
            }
            setLoading(false)
        })

        return () => unsub()
    }, [])

    return (
        <ThemeContext.Provider value={{ settings, loading }}>
            {children}
        </ThemeContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext)
