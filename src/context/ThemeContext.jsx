import { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../db/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
    const [settings, setSettings] = useState({
        logo: '',
        primaryColor: '#3b82f6',
        businessName: 'Montino App'
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Real-time listener for settings
        const unsub = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
            if (doc.exists()) {
                const data = doc.data()
                setSettings(data)
                // Apply CSS variable
                document.documentElement.style.setProperty('--primary-color', data.primaryColor)
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

export const useTheme = () => useContext(ThemeContext)
