import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { camposPublicos } from './catalogoWeb.js'
// import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

initializeApp()
const db = getFirestore()

// Consulta de patentes (Boostr) desactivada: no hay API key y el deploy exige
// el secret BOOSTR_KEY aunque se despliegue otra función. Para reactivarla:
// descomentar esto y el import de defineSecret, `firebase functions:secrets:set
// BOOSTR_KEY` y descomentar "Traer datos" en src/components/VehiculoForm.jsx.
// const BOOSTR_KEY = defineSecret('BOOSTR_KEY')

// const FORMATOS = [/^[A-Z]{4}\d{2}$/, /^[A-Z]{2}\d{4}$/, /^[A-Z]{3}\d{2}$/, /^[A-Z]{2}\d{3}$/]
// const limpiarPatente = (raw) => String(raw ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()

// // Cada consulta al proveedor gasta cupo; la patente de un auto no cambia de marca.
// const DIAS_CACHE = 180

// /** Deja solo los campos que muestra la ficha. No traemos datos del dueño (owner). */
// const normalizar = (d) => ({
//     marca: d.make ?? '',
//     modelo: d.model ?? '',
//     anio: d.year ?? '',
//     tipo: d.type ?? '',
//     motor: d.engine ?? '',
// })

// export const consultarPatente = onCall(
//     { region: 'southamerica-east1', secrets: [BOOSTR_KEY], cors: true, maxInstances: 5 },
//     async (request) => {
//         if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')

//         const patente = limpiarPatente(request.data?.patente)
//         if (!FORMATOS.some((re) => re.test(patente))) {
//             throw new HttpsError('invalid-argument', 'Patente inválida.')
//         }

//         const cacheRef = db.doc(`vehiculos/${patente}`)
//         const cacheado = await cacheRef.get()
//         if (cacheado.exists) {
//             const { consultadoEn, ...datos } = cacheado.data()
//             const dias = (Date.now() - consultadoEn.toMillis()) / 86400000
//             if (dias < DIAS_CACHE) return { ...datos, patente, desdeCache: true }
//         }

//         let res
//         try {
//             res = await fetch(`https://api.boostr.cl/vehicle/${patente}.json`, {
//                 headers: { 'X-API-KEY': BOOSTR_KEY.value() },
//                 signal: AbortSignal.timeout(15000),
//             })
//         } catch {
//             throw new HttpsError('unavailable', 'El servicio de patentes no responde.')
//         }

//         if (res.status === 401 || res.status === 403) {
//             throw new HttpsError('failed-precondition', 'API key inválida o no configurada.')
//         }
//         if (res.status === 404) throw new HttpsError('not-found', 'Sin datos para esa patente.')
//         if (res.status === 429) throw new HttpsError('resource-exhausted', 'Límite de consultas alcanzado.')
//         if (!res.ok) throw new HttpsError('unavailable', `El servicio devolvió ${res.status}.`)

//         const cuerpo = await res.json()
//         if (cuerpo.status !== 'success' || !cuerpo.data) {
//             throw new HttpsError('not-found', 'Sin datos para esa patente.')
//         }

//         const datos = normalizar(cuerpo.data)
//         await cacheRef.set({ ...datos, consultadoEn: Timestamp.now() })
//         return { ...datos, patente, desdeCache: false }
//     }
// )

// Debe coincidir con ROLES de src/lib/usuarios.js.
const ROLES = ['desarrollador', 'admin', 'lector']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Crea la cuenta en Auth sin contraseña y su perfil con el rol elegido. El
 * cliente manda después el correo de restablecimiento, que hace de invitación:
 * así el correo sale con la plantilla de Firebase y no hace falta un proveedor.
 */
export const crearUsuario = onCall(
    { region: 'southamerica-east1', cors: true, maxInstances: 5 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')

        // Admin SDK salta las rules: el permiso se valida aquí.
        const quien = await db.doc(`usuarios/${request.auth.uid}`).get()
        if (quien.data()?.rol !== 'desarrollador') {
            throw new HttpsError('permission-denied', 'Solo un desarrollador puede crear usuarios.')
        }

        const email = String(request.data?.email ?? '').trim().toLowerCase()
        const nombre = String(request.data?.nombre ?? '').trim().slice(0, 80)
        const rol = request.data?.rol
        if (!EMAIL.test(email) || email.length > 120) throw new HttpsError('invalid-argument', 'Correo inválido.')
        if (!ROLES.includes(rol)) throw new HttpsError('invalid-argument', 'Rol inválido.')

        let usuario
        try {
            usuario = await getAuth().createUser({ email, ...(nombre && { displayName: nombre }) })
        } catch (e) {
            if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Ese correo ya tiene cuenta.')
            throw e
        }

        await db.doc(`usuarios/${usuario.uid}`).set({
            email,
            nombre,
            rol,
            creadoEn: Timestamp.now(),
            invitadoPor: request.auth.uid,
        })
        return { uid: usuario.uid }
    }
)

// ──────────────────────────────────────────────────────────────────────────
// Espejo público del catálogo (colección `catalogoWeb`)
//
// Lo lee el sitio público (../WebRoncaMotors) sin sesión. `productos` NO se
// abre al público porque guarda `precioOriginal`, el costo de compra, y
// Firestore no filtra campos al leer.
//
// REGLA QUE NO SE ROMPE: `camposPublicos` es una lista EXPLÍCITA. Nunca
// hagas `{ ...data }` aquí: un spread publicaría el costo en silencio.
// ──────────────────────────────────────────────────────────────────────────

export const espejarCatalogoWeb = onDocumentWritten(
    { document: 'productos/{id}', region: 'southamerica-east1', maxInstances: 10 },
    async (event) => {
        const id = event.params.id
        const espejo = db.doc(`catalogoWeb/${id}`)

        const antes = camposPublicos(event.data?.before?.data(), id)
        const despues = camposPublicos(event.data?.after?.data(), id)

        if (!despues) {
            // Borrado o dejó de ser publicable. Borrar lo que no existe no falla.
            await espejo.delete()
            return
        }

        // Editar solo el costo o el precio local no cambia nada público: así
        // no gastamos una escritura en cada ajuste de margen.
        if (antes && JSON.stringify(antes) === JSON.stringify(despues)) return

        await espejo.set({ ...despues, actualizadoEn: Timestamp.now() })
    }
)

/**
 * Reconstruye el espejo completo: carga inicial y botón de pánico si quedó
 * desincronizado. Escribe con Admin SDK, que es el único camino: las rules
 * dejan `catalogoWeb` cerrado a escritura para todo el mundo.
 */
export const backfillCatalogoWeb = onCall(
    { region: 'southamerica-east1', cors: true, maxInstances: 1, timeoutSeconds: 300 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
        const quien = await db.doc(`usuarios/${request.auth.uid}`).get()
        if (quien.data()?.rol !== 'desarrollador') {
            throw new HttpsError('permission-denied', 'Solo un desarrollador puede reconstruir el catálogo web.')
        }

        const productos = await db.collection('productos').get()
        const espejoActual = await db.collection('catalogoWeb').select().get()
        const sobrantes = new Set(espejoActual.docs.map((d) => d.id))

        let espejados = 0
        let saltados = 0
        let lote = db.batch()
        let pendientes = 0

        const confirmar = async (forzar = false) => {
            if (pendientes >= 400 || (forzar && pendientes > 0)) {
                await lote.commit()
                lote = db.batch()
                pendientes = 0
            }
        }

        for (const doc of productos.docs) {
            sobrantes.delete(doc.id)
            const publico = camposPublicos(doc.data(), doc.id)
            if (!publico) {
                saltados += 1
                lote.delete(db.doc(`catalogoWeb/${doc.id}`))
            } else {
                espejados += 1
                lote.set(db.doc(`catalogoWeb/${doc.id}`), { ...publico, actualizadoEn: Timestamp.now() })
            }
            pendientes += 1
            await confirmar()
        }

        // Espejos de productos que ya no existen.
        for (const id of sobrantes) {
            lote.delete(db.doc(`catalogoWeb/${id}`))
            pendientes += 1
            await confirmar()
        }
        await confirmar(true)

        return { espejados, saltados, borrados: sobrantes.size }
    }
)
