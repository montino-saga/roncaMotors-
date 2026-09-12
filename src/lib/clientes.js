import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../db/firebase'

// Lista de clientes para la paleta de comandos: una lectura por sesión.
let cache = null

export async function cargarClientes() {
    if (cache) return cache
    const snap = await getDocs(query(collection(db, 'clients'), orderBy('name', 'asc')))
    cache = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return cache
}

export const clientesEnCache = () => cache ?? []
export const invalidarClientes = () => { cache = null }
