import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth, db, functions } from '../db/firebase'

export const ROLES = [
    { id: 'desarrollador', label: 'Desarrollador', descripcion: 'Acceso total y gestión de usuarios' },
    { id: 'admin', label: 'Administrador', descripcion: 'Acceso total salvo usuarios' },
    { id: 'lector', label: 'Lector', descripcion: 'Ve todo, no modifica nada' },
]

// Cuentas creadas a mano en Auth (sin invitación) entran como admin, igual
// que antes de existir los roles.
export const ROL_INICIAL = 'admin'

export const rolDe = (id) => ROLES.find((r) => r.id === id) ?? ROLES.find((r) => r.id === ROL_INICIAL)

// Única diferencia hoy entre desarrollador y admin: la gestión de usuarios.
// Debe coincidir con esDesarrollador() de firestore.rules.
export const esDesarrollador = (perfil) => perfil?.rol === 'desarrollador'

// Perfil aún cargando cuenta como escritor: las rules rechazan igual, y así
// un admin no ve los botones parpadear deshabilitados al abrir la app.
// Debe coincidir con puedeEscribir() de firestore.rules.
export const puedeEscribir = (perfil) => perfil?.rol !== 'lector'

// Las cuentas se crean a mano en Firebase Auth y el SDK cliente no puede
// listarlas: cada usuario se da de alta en `usuarios` al iniciar sesión.
export async function registrarAcceso(user) {
    const ref = doc(db, 'usuarios', user.uid)
    const ahora = Timestamp.now()
    const snap = await getDoc(ref)
    if (snap.exists()) {
        await updateDoc(ref, { email: user.email ?? '', ultimoAcceso: ahora })
    } else {
        await setDoc(ref, {
            email: user.email ?? '',
            nombre: user.displayName ?? '',
            rol: ROL_INICIAL,
            creadoEn: ahora,
            ultimoAcceso: ahora,
        })
    }
}

const MENSAJES_INVITACION = {
    'functions/already-exists': 'Ese correo ya tiene cuenta.',
    'functions/permission-denied': 'Solo un desarrollador puede crear usuarios.',
    'functions/invalid-argument': 'Revisa el correo y el rol.',
    'functions/unauthenticated': 'Sesión expirada, vuelve a entrar.',
}

export const mensajeErrorInvitacion = (error) =>
    MENSAJES_INVITACION[error?.code] ?? 'No se pudo crear el usuario.'

// El correo de "restablecer contraseña" hace de invitación: la cuenta nace sin
// contraseña y el enlace le deja crear la suya.
export const enviarInvitacion = (email) => sendPasswordResetEmail(auth, email)

export async function invitarUsuario({ email, nombre, rol }) {
    const limpio = email.trim().toLowerCase()
    await httpsCallable(functions, 'crearUsuario')({ email: limpio, nombre: nombre.trim(), rol })
    await enviarInvitacion(limpio)
}
