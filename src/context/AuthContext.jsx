import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../db/firebase'
import { registrarAcceso } from '../lib/usuarios'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [perfil, setPerfil] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u)
            setLoading(false)
        })
        return () => unsub()
    }, [])

    // Se guarda junto al uid para no mostrar el perfil anterior al cambiar de cuenta.
    useEffect(() => {
        if (!user?.uid) return
        const uid = user.uid
        registrarAcceso(user).catch((e) => console.error('Error registrando acceso:', e))
        return onSnapshot(
            doc(db, 'usuarios', uid),
            (s) => setPerfil({ uid, datos: s.exists() ? s.data() : null }),
            () => setPerfil({ uid, datos: null }),
        )
    }, [user])

    // undefined = aún cargando; null = sin doc. Las guardas por rol esperan al primero.
    const perfilActual = !user ? null : perfil?.uid === user.uid ? perfil.datos : undefined

    const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
    const logout = () => signOut(auth)
    const recuperar = (email) => sendPasswordResetEmail(auth, email)

    return (
        <AuthContext.Provider value={{ user, perfil: perfilActual, loading, login, logout, recuperar }}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
