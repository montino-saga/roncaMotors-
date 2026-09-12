import { useSyncExternalStore } from 'react'
import { collection, onSnapshot, doc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../db/firebase'
import { indexarPorCodigo, buscarPorCodigo } from './buscarProductos'

/**
 * Catálogo compartido por toda la app con un único listener de Firestore.
 *
 * Por qué así y no getDocs por pantalla: cada getDocs cobra una lectura por
 * documento, cada vez. Un onSnapshot que vive toda la sesión paga el catálogo
 * una vez y después solo los documentos que cambian; con la caché persistente
 * activada en firebase.js, al reabrir la app arranca desde disco y el servidor
 * manda únicamente los deltas. Entrar y salir del POS o del inventario cuesta 0.
 */
let estado = { productos: [], porCodigo: new Map(), listo: false, error: null }
let unsub = null
const oyentes = new Set()

function arrancar() {
    if (unsub) return
    unsub = onSnapshot(
        collection(db, 'productos'),
        (snap) => {
            const productos = snap.docs.map((d) => ({ ...d.data(), id: d.id }))
            estado = { productos, porCodigo: indexarPorCodigo(productos), listo: true, error: null }
            oyentes.forEach((fn) => fn())
        },
        (error) => {
            // Un listener que falla (p. ej. permission-denied al cerrar sesión)
            // queda muerto: se suelta para que la próxima pantalla lo rearme.
            console.error('Catálogo:', error)
            unsub?.()
            unsub = null
            estado = { ...estado, listo: false, error }
            oyentes.forEach((fn) => fn())
        }
    )
}

function suscribir(fn) {
    oyentes.add(fn)
    arrancar()
    // El listener de Firestore no se cierra al desmontar: es la caché viva de
    // la sesión. Cerrarlo y reabrirlo volvería a cobrar el catálogo completo.
    return () => oyentes.delete(fn)
}

const leer = () => estado

/** { productos, porCodigo, listo, error } — se actualiza en tiempo real. */
export function useCatalogo() {
    return useSyncExternalStore(suscribir, leer, leer)
}

/** Acceso fuera de React (p. ej. dentro de un handler async). */
export const catalogoActual = () => estado

/**
 * DocumentReference del producto con ese código, o null. Primero el catálogo
 * en memoria (0 lecturas); solo si no está se pregunta al servidor.
 */
export async function refProductoPorCodigo(idProducto) {
    const enCatalogo = buscarPorCodigo(estado.porCodigo, idProducto)
    if (enCatalogo) return doc(db, 'productos', enCatalogo.id)
    const snap = await getDocs(query(collection(db, 'productos'), where('idProducto', '==', idProducto)))
    return snap.empty ? null : doc(db, 'productos', snap.docs[0].id)
}
