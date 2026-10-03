import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../db/firebase'

export const ROLES = [
    { id: 'desarrollador', label: 'Desarrollador', descripcion: 'Acceso total, incluida la configuración técnica' },
    { id: 'admin', label: 'Administrador', descripcion: 'Opera el negocio: ventas, caja, inventario y reportes' },
    { id: 'lector', label: 'Lector', descripcion: 'Solo consulta, sin modificar datos' },
]

// Hoy toda cuenta con sesión tiene acceso total: 'admin' refleja eso hasta
// que se activen las restricciones por rol.
export const ROL_INICIAL = 'admin'

export const rolDe = (id) => ROLES.find((r) => r.id === id) ?? ROLES.find((r) => r.id === ROL_INICIAL)

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
