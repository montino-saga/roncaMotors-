/**
 * Doble de firebase/firestore para tests de componentes. Guarda lo escrito
 * en `escrituras` para poder afirmar sobre ello; el catálogo llega por
 * `emitirCatalogo`.
 */
import { vi } from 'vitest'

export const escrituras = { sets: [], updates: [], adds: [], deletes: [] }
export const catalogoFake = { docs: [] }
// Documentos de otras colecciones que getDocs debe devolver, por nombre.
export const coleccionesFake = {}
let oyenteCatalogo = null

export const emitirCatalogo = (productos) => {
  catalogoFake.docs = productos
  oyenteCatalogo?.({ docs: productos.map((p) => ({ id: p.id, data: () => { const { id: _i, ...d } = p; return d } })) })
}

export const resetFirebaseMock = () => {
  escrituras.sets = []; escrituras.updates = []; escrituras.adds = []; escrituras.deletes = []
  for (const k of Object.keys(coleccionesFake)) delete coleccionesFake[k]
  // El oyente del catálogo no se borra: lib/catalogo lo mantiene vivo toda la sesión.
}

const ref = (path) => ({ path, id: path.split('/').pop() })

export const firestoreMock = {
  collection: vi.fn((_db, name) => ({ path: name, _coll: true })),
  doc: vi.fn((_db, coll, id) => ref(typeof coll === 'object' ? `${coll.path}/nuevo-${Math.random().toString(36).slice(2, 8)}` : `${coll}/${id}`)),
  query: vi.fn((c, ...rest) => ({ ...c, filtros: rest })),
  where: vi.fn((f, op, v) => ({ where: [f, op, v] })),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  increment: vi.fn((n) => ({ __increment: n })),
  Timestamp: { now: () => ({ toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000) }), fromDate: (d) => ({ toDate: () => d }) },
  onSnapshot: vi.fn((target, cb) => {
    if (target?.path === 'productos') {
      oyenteCatalogo = cb
      emitirCatalogo(catalogoFake.docs)
    } else if (target?._coll) {
      // Colección/query: QuerySnapshot con lo que haya en coleccionesFake.
      const docs = coleccionesFake[target.path] || []
      cb({ empty: docs.length === 0, docs: docs.map((p) => ({ id: p.id, data: () => p })), forEach: (fn) => docs.forEach((p) => fn({ id: p.id, data: () => p })) })
    } else {
      cb({ exists: () => false, data: () => ({}) })
    }
    return () => { if (oyenteCatalogo === cb) oyenteCatalogo = null }
  }),
  getDocs: vi.fn(async (q) => {
    if (q?.path === 'productos') {
      const w = q.filtros?.find((f) => f.where)?.where
      const docs = catalogoFake.docs.filter((p) => !w || p[w[0]] === w[2])
      return { empty: docs.length === 0, docs: docs.map((p) => ({ id: p.id, data: () => p })), forEach: (fn) => docs.forEach((p) => fn({ id: p.id, data: () => p })) }
    }
    const docs = coleccionesFake[q?.path] || []
    return { empty: docs.length === 0, docs: docs.map((p) => ({ id: p.id, data: () => p })), forEach: (fn) => docs.forEach((p) => fn({ id: p.id, data: () => p })) }
  }),
  getDoc: vi.fn(async (r) => ({ exists: () => false, data: () => ({}), id: r.id })),
  addDoc: vi.fn(async (c, data) => { escrituras.adds.push({ coll: c.path, data }); return ref(`${c.path}/nuevo`) }),
  updateDoc: vi.fn(async (r, data) => { escrituras.updates.push({ ref: r.path, data }) }),
  setDoc: vi.fn(async (r, data) => { escrituras.sets.push({ ref: r.path, data }) }),
  deleteDoc: vi.fn(async (r) => { escrituras.deletes.push(r.path) }),
  writeBatch: vi.fn(() => ({
    set: (r, data) => escrituras.sets.push({ ref: r.path, data }),
    update: (r, data) => escrituras.updates.push({ ref: r.path, data }),
    delete: (r) => escrituras.deletes.push(r.path),
    commit: vi.fn(async () => {}),
  })),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}
