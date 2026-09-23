import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

const BOOSTR_KEY = defineSecret('BOOSTR_KEY')

const FORMATOS = [/^[A-Z]{4}\d{2}$/, /^[A-Z]{2}\d{4}$/, /^[A-Z]{3}\d{2}$/, /^[A-Z]{2}\d{3}$/]
const limpiarPatente = (raw) => String(raw ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()

// Cada consulta al proveedor gasta cupo; la patente de un auto no cambia de marca.
const DIAS_CACHE = 180

/** Deja solo los campos que muestra la ficha. No traemos datos del dueño (owner). */
const normalizar = (d) => ({
    marca: d.make ?? '',
    modelo: d.model ?? '',
    anio: d.year ?? '',
    tipo: d.type ?? '',
    motor: d.engine ?? '',
})

export const consultarPatente = onCall(
    { region: 'southamerica-east1', secrets: [BOOSTR_KEY], cors: true, maxInstances: 5 },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')

        const patente = limpiarPatente(request.data?.patente)
        if (!FORMATOS.some((re) => re.test(patente))) {
            throw new HttpsError('invalid-argument', 'Patente inválida.')
        }

        const cacheRef = db.doc(`vehiculos/${patente}`)
        const cacheado = await cacheRef.get()
        if (cacheado.exists) {
            const { consultadoEn, ...datos } = cacheado.data()
            const dias = (Date.now() - consultadoEn.toMillis()) / 86400000
            if (dias < DIAS_CACHE) return { ...datos, patente, desdeCache: true }
        }

        let res
        try {
            res = await fetch(`https://api.boostr.cl/vehicle/${patente}.json`, {
                headers: { 'X-API-KEY': BOOSTR_KEY.value() },
                signal: AbortSignal.timeout(15000),
            })
        } catch {
            throw new HttpsError('unavailable', 'El servicio de patentes no responde.')
        }

        if (res.status === 401 || res.status === 403) {
            throw new HttpsError('failed-precondition', 'API key inválida o no configurada.')
        }
        if (res.status === 404) throw new HttpsError('not-found', 'Sin datos para esa patente.')
        if (res.status === 429) throw new HttpsError('resource-exhausted', 'Límite de consultas alcanzado.')
        if (!res.ok) throw new HttpsError('unavailable', `El servicio devolvió ${res.status}.`)

        const cuerpo = await res.json()
        if (cuerpo.status !== 'success' || !cuerpo.data) {
            throw new HttpsError('not-found', 'Sin datos para esa patente.')
        }

        const datos = normalizar(cuerpo.data)
        await cacheRef.set({ ...datos, consultadoEn: Timestamp.now() })
        return { ...datos, patente, desdeCache: false }
    }
)
