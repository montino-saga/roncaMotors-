import { useState, useEffect, useRef, useMemo } from 'react'
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { usePersistedState } from '../../hooks/usePersistedState'
import {
  ArrowUpDown, Search, Package, Tag, Edit, Trash2, AlertTriangle, X,
  Wallet, TrendingUp, TrendingDown, PackageX, Snowflake, CircleHelp, Copy, Receipt, Plus
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { doc, deleteDoc, setDoc } from 'firebase/firestore'
import { useCatalogo } from '../../lib/catalogo'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { cn } from '../../lib/utils'
import { PRESS } from '../../lib/motion'
import { esAfecto, netoDe } from '../../lib/iva'

const LOW_STOCK = 10
const VENTANA_DIAS = 90        // ventana de rotación
const MARGEN_MINIMO = 10       // % sobre precio de venta por debajo del cual avisamos

const DIA_MS = 86_400_000
const money = (n) => `$${Math.round(n).toLocaleString('es-CL')}`

/** Cifra primero, etiqueta debajo: el dato es el titular, no el rótulo. */
function Metric({ value, label, tone = 'text-white', icon: Icon, onClick, active, title }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      title={title}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={cn(
        "flex items-center gap-3 px-3 sm:px-4 py-2 tall:py-3 rounded-xl text-left transition-colors",
        onClick && `${PRESS} hover:bg-white/[0.06] cursor-pointer`,
        active && "bg-white/[0.08] ring-1 ring-inset ring-white/15"
      )}
    >
      {Icon && (
        <div className={cn("w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-white/[0.06]", tone)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      )}
      <div className="min-w-0">
        <p className={cn("text-xl lg:text-2xl tall:text-[28px] font-bold leading-none tabular-nums tracking-[-0.02em]", tone)}>
          {value}
        </p>
        <p className="text-[11px] text-slate-400 mt-1.5 leading-none tracking-[0.03em] whitespace-nowrap">
          {label}
        </p>
      </div>
    </Tag>
  )
}

const TONOS = {
  red: 'text-red-300 bg-red-500/10 border-red-500/25 hover:bg-red-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/20',
  sky: 'text-sky-300 bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/20',
  slate: 'text-slate-300 bg-white/5 border-white/10 hover:bg-white/10'
}

/** Contador que además filtra. Si no hay ninguno, se apaga en vez de desaparecer:
 *  un cero es información — significa que ese problema está resuelto. */
function Alerta({ k, count, active, onToggle, icon: Icon, tone, label, title, disabled }) {
  const vacio = count === 0
  const on = active === k
  return (
    <button
      onClick={() => onToggle(k)}
      disabled={disabled || (vacio && !on)}
      title={title}
      aria-pressed={on}
      className={cn(
        "h-9 pl-2.5 pr-3.5 inline-flex items-center gap-2 rounded-full border text-xs font-medium",
        "transition-colors disabled:pointer-events-none", PRESS,
        vacio ? 'text-slate-500 bg-transparent border-white/[0.07]' : TONOS[tone],
        on && 'ring-2 ring-inset ring-white/30',
        disabled && 'opacity-40'
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="tabular-nums font-semibold">{count}</span>
      <span className="text-slate-400 font-normal hidden sm:inline">{label}</span>
    </button>
  )
}

function ProductList() {
  // Catálogo compartido: 0 lecturas al entrar, y refleja altas/bajas al instante.
  const { productos, listo } = useCatalogo()
  const loading = !listo
  const mostrarSkeleton = useDelayedLoading(loading)
  const [orden, setOrden] = usePersistedState('roncamotors_productos_orden', '')

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('')
  const [minStock, setMinStock] = useState('')
  const [maxStock, setMaxStock] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [alerta, setAlerta] = useState(null)   // 'bajo' | 'muerto' | 'margen' | 'sinCosto' | 'duplicado'
  const [rotacion, setRotacion] = useState(new Map())
  // Instante de la lectura de rotación: los "días sin venta" se miden desde
  // aquí y no con Date.now() en render, que el compilador de React no permite.
  const [rotacionAt, setRotacionAt] = useState(0)
  const [rotacionError, setRotacionError] = useState(false)
  const itemsPerPage = 100
  const scrollRef = useRef(null)

  const navigate = useNavigate()

  const getLocalPrice = (product) => Number(product?.precioVentaLocal ?? product?.precioProducto ?? 0)
  const getWebPrice = (product) => Number(product?.precioVentaWeb ?? 0)

  // Rotación: unidades vendidas y última venta por idProducto. Si esta lectura
  // falla, la vista sigue funcionando sin las columnas de rotación.
  useEffect(() => {
    const obtenerRotacion = async () => {
      try {
        const desde = Timestamp.fromDate(new Date(Date.now() - VENTANA_DIAS * DIA_MS))
        const snap = await getDocs(query(collection(db, 'sales'), where('fechaVenta', '>=', desde)))

        const acc = new Map()
        snap.forEach((d) => {
          const venta = d.data()
          const fecha = venta.fechaVenta?.toDate?.()
          venta.productos?.forEach((item) => {
            // Los abonos viajan como un ítem sintético, no son inventario.
            if (!item.idProducto || item.idProducto === 'ABONO' || item.esAbono) return
            const prev = acc.get(item.idProducto) || { unidades: 0, ultima: null }
            prev.unidades += Number(item.cantidad) || 0
            if (fecha && (!prev.ultima || fecha > prev.ultima)) prev.ultima = fecha
            acc.set(item.idProducto, prev)
          })
        })
        setRotacion(acc)
        setRotacionAt(Date.now())
      } catch (error) {
        console.error('Error al obtener rotación:', error)
        setRotacionError(true)
      }
    }
    obtenerRotacion()
  }, [])

  // El orden se aplica al final de la derivación, no mutando una copia del
  // array: así puede ordenar también por margen y rotación, que son campos
  // calculados y no existen en el documento de Firestore.
  const ordenarProductos = (tipo) => {
    setOrden(tipo)
    setCurrentPage(1)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const COMPARADORES = {
    'nombre-asc': (a, b) => a.nombreProducto.localeCompare(b.nombreProducto),
    'nombre-desc': (a, b) => b.nombreProducto.localeCompare(a.nombreProducto),
    'precio-asc': (a, b) => a._venta - b._venta,
    'precio-desc': (a, b) => b._venta - a._venta,
    'stock-asc': (a, b) => a._stock - b._stock,
    // Sin costo al final: un margen que no se puede calcular no es "el peor".
    'margen-asc': (a, b) => (a._margenPct ?? Infinity) - (b._margenPct ?? Infinity),
    // Más parado primero; los que nunca se vendieron encabezan.
    'rotacion-asc': (a, b) => (a._unidades - b._unidades) || (b._valorCosto - a._valorCosto)
  }

  // Sin diálogo de confirmación: se borra ya y el toast ofrece deshacer, que
  // restaura el documento tal cual. Más rápido y no entrena a aceptar sin leer.
  const handleDeleteClick = (producto) => {
    const { id, ...data } = producto
    const ref = doc(db, 'productos', id)
    deleteDoc(ref).catch((error) => {
      console.error("Error al eliminar producto:", error)
      toast.error('Error al eliminar el producto', { description: producto.nombreProducto })
    })
    toast('Producto eliminado', {
      description: producto.nombreProducto,
      duration: 8000,
      action: {
        label: 'Deshacer',
        onClick: () => setDoc(ref, data).catch(() => toast.error('No se pudo restaurar el producto'))
      }
    })
  }

  // Rojo solo para agotado, que es el problema real; ámbar avisa. Antes <10 era
  // rojo y <50 amarillo, dos tonos casi indistinguibles para dos significados.
  const getStockColor = (stock) => {
    const quantity = parseInt(stock) || 0
    if (quantity === 0) return 'text-red-400'
    if (quantity < LOW_STOCK) return 'text-amber-400'
    return 'text-emerald-400'
  }

  // Un solo paso que deriva todo lo que la vista necesita saber de cada producto.
  const enriquecidos = useMemo(() => {
    const vecesPorCodigo = new Map()
    productos.forEach((p) => {
      const k = p.idProducto ?? ''
      vecesPorCodigo.set(k, (vecesPorCodigo.get(k) || 0) + 1)
    })

    return productos.map((p) => {
      const stock = parseInt(p.cantidadProducto) || 0
      const costo = Number(p.precioOriginal) || 0
      const venta = getLocalPrice(p)

      // El IVA se recauda para el fisco, así que la ganancia se mide contra el
      // neto. Con precio 1.800 afecto, se compara 1.513 con el costo, no 1.800.
      const afecto = esAfecto(p)
      const neto = netoDe(venta, afecto)
      const iva = venta - neto

      const sinCosto = costo <= 0
      const margenUnit = neto - costo
      const margenPct = sinCosto || neto <= 0 ? null : (margenUnit / neto) * 100

      const rot = rotacion.get(p.idProducto)
      const unidades = rot?.unidades ?? 0
      const ultima = rot?.ultima ?? null
      const diasSinVenta = ultima ? Math.floor((rotacionAt - ultima.getTime()) / DIA_MS) : null
      const porDia = unidades / VENTANA_DIAS
      const cobertura = porDia > 0 ? Math.round(stock / porDia) : null

      return {
        ...p,
        _stock: stock,
        _costo: costo,
        _venta: venta,
        _afecto: afecto,
        _neto: neto,
        _iva: iva,
        _valorCosto: costo * stock,
        _valorVenta: venta * stock,
        _valorNeto: neto * stock,
        _margenUnit: margenUnit,
        _margenPct: margenPct,
        _unidades: unidades,
        _diasSinVenta: diasSinVenta,
        _cobertura: cobertura,
        _alertas: {
          bajo: stock > 0 && stock < LOW_STOCK,
          agotado: stock === 0,
          // Capital muerto: hay existencias y no se ha movido ni una en la ventana.
          muerto: stock > 0 && unidades === 0,
          margen: !sinCosto && margenPct !== null && margenPct < MARGEN_MINIMO,
          sinCosto,
          duplicado: (vecesPorCodigo.get(p.idProducto ?? '') || 0) > 1
        }
      }
    })
  }, [productos, rotacion, rotacionAt])

  // Filter Logic
  const filtrados = enriquecidos.filter(product => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = (
      product.nombreProducto.toLowerCase().includes(searchLower) ||
      product.marcaProducto?.toLowerCase().includes(searchLower) ||
      product.idProducto?.toString().toLowerCase().includes(searchLower) ||
      product.id?.toLowerCase().includes(searchLower)
    )

    const stock = product._stock
    const matchesMinStock = minStock === '' || stock >= parseInt(minStock)
    const matchesMaxStock = maxStock === '' || stock <= parseInt(maxStock)
    const matchesAlerta = !alerta || product._alertas[alerta]

    return matchesSearch && matchesMinStock && matchesMaxStock && matchesAlerta
  })

  const filteredProducts = COMPARADORES[orden]
    ? [...filtrados].sort(COMPARADORES[orden])
    : filtrados

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage))
  // Filtrar puede dejar la página actual fuera de rango: sin esto la tabla
  // sale vacía y "Siguiente" queda habilitado apuntando a la nada.
  const page = Math.min(currentPage, totalPages)
  const indexOfLastItem = page * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem)

  // Capital: a costo es lo que tienes inmovilizado; a venta, lo que esperas
  // ingresar. Mezclarlos en una sola cifra "Valor total" era engañoso.
  const valorCosto = filteredProducts.reduce((a, p) => a + p._valorCosto, 0)
  const valorVenta = filteredProducts.reduce((a, p) => a + p._valorVenta, 0)
  const valorNeto = filteredProducts.reduce((a, p) => a + p._valorNeto, 0)
  const ivaTotal = valorVenta - valorNeto
  // Contra el neto: el IVA no forma parte de la ganancia. Así la cadena
  // costo → venta neta → ganancia sigue cuadrando en la cabecera.
  const margenLatente = valorNeto - valorCosto
  const margenPctTotal = valorNeto > 0 ? (margenLatente / valorNeto) * 100 : null
  const totalCount = filteredProducts.length

  // Un producto sin costo cuenta 0 al inmovilizado y su venta entera como
  // ganancia: mientras los haya, estas dos cifras están sesgadas a favor.
  const sinCostoEnVista = filteredProducts.filter((p) => p._alertas.sinCosto).length

  // Los contadores se cuentan sobre TODO el catálogo, no sobre lo filtrado:
  // si contaran lo filtrado, al activar uno se quedaría fijado en su propio total.
  const conteos = useMemo(() => {
    const c = { bajo: 0, agotado: 0, muerto: 0, margen: 0, sinCosto: 0, duplicado: 0 }
    enriquecidos.forEach((p) => {
      Object.keys(c).forEach((k) => { if (p._alertas[k]) c[k] += 1 })
    })
    return c
  }, [enriquecidos])

  const hasFilters = searchTerm !== '' || minStock !== '' || maxStock !== '' || alerta !== null || orden !== ''

  const clearFilters = () => {
    setSearchTerm('')
    setMinStock('')
    setMaxStock('')
    setAlerta(null)
    setOrden('')
    setCurrentPage(1)
  }

  const toggleAlerta = (key) => {
    setAlerta((prev) => (prev === key ? null : key))
    setCurrentPage(1)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  return (
    <div className="page-fit flex flex-col gap-3 tall:gap-5">
      <div className="shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-3 tall:gap-4">
        {/* Los datos ocupan el sitio que antes tenía el rótulo: el sidebar ya
            indica que estás en Productos, repetirlo no informaba de nada. */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap
                        rounded-2xl border border-white/[0.07] bg-white/[0.03]
                        px-2 sm:px-3 py-1.5 tall:py-2
                        reduce-transparency:bg-slate-900">
          {/* La cadena completa: lo que costó → lo que se cobra → lo que queda.
              Sin el eslabón del medio, costo y ganancia se leen como si uno
              fuera el ingreso y salieran pérdidas. */}
          <Metric
            icon={Wallet}
            value={money(valorCosto)}
            label="Lo que costó el stock"
            title="Capital inmovilizado: suma de precioOriginal × unidades"
          />
          <span className="text-slate-600 shrink-0 px-0.5" aria-hidden="true">→</span>
          <Metric
            icon={Receipt}
            tone="text-sky-400"
            value={money(valorNeto)}
            label="Si se vende todo (sin IVA)"
            title={`El cliente paga ${money(valorVenta)}, de los cuales ${money(ivaTotal)} son IVA que se entera al fisco`}
          />
          <span className="text-slate-600 shrink-0 px-0.5" aria-hidden="true">=</span>
          <Metric
            icon={TrendingUp}
            tone="text-emerald-400"
            value={money(margenLatente)}
            label={margenPctTotal === null
              ? 'Ganancia'
              : `Ganancia · ${margenPctTotal.toFixed(0)}% de margen`}
            title={`${money(valorVenta)} − ${money(valorCosto)}`}
          />
          {sinCostoEnVista > 0 && (
            <span
              title={`${sinCostoEnVista} producto(s) sin costo registrado cuentan como ganancia entera. La cifra real es menor.`}
              className="self-center shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg
                         text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25"
            >
              <CircleHelp className="w-3.5 h-3.5" />
              inflada
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2 flex-1 xl:flex-none">
            <div className="relative flex-1 min-w-[150px] xl:flex-none">
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9 pr-4 h-10 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full xl:w-48 transition-colors"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 h-10" title="Filtrar por stock">
              <span className="text-xs text-slate-400 pr-0.5">Stock</span>
              <input
                type="number"
                placeholder="Min"
                value={minStock}
                onChange={(e) => {
                  setMinStock(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-14 bg-transparent text-white text-sm focus:outline-none text-center"
              />
              <span className="text-slate-500">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxStock}
                onChange={(e) => {
                  setMaxStock(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-14 bg-transparent text-white text-sm focus:outline-none text-center"
              />
            </div>

            <div className="relative">
              <select
                value={orden}
                onChange={(e) => ordenarProductos(e.target.value)}
                className="appearance-none h-10 bg-white/5 border border-white/10 rounded-lg px-3 pr-8 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <option value="" className="bg-slate-900">Ordenar por...</option>
                <option value="nombre-asc" className="bg-slate-900">A-Z</option>
                <option value="nombre-desc" className="bg-slate-900">Z-A</option>
                <option value="precio-asc" className="bg-slate-900">Precio Min</option>
                <option value="precio-desc" className="bg-slate-900">Precio Max</option>
                <option value="stock-asc" className="bg-slate-900">Menos stock</option>
                <option value="margen-asc" className="bg-slate-900">Peor margen</option>
                <option value="rotacion-asc" className="bg-slate-900">Menos rotación</option>
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Avisos: cada uno es un filtro. El contador dice cuántos hay; pulsarlo
          te lleva exactamente a esos productos. */}
      {!loading && (
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <Alerta k="agotado" count={conteos.agotado} active={alerta} onToggle={toggleAlerta}
            icon={PackageX} tone="red" label="Agotados" />
          <Alerta k="bajo" count={conteos.bajo} active={alerta} onToggle={toggleAlerta}
            icon={AlertTriangle} tone="amber" label={`Bajo ${LOW_STOCK} unidades`} />
          <Alerta k="muerto" count={conteos.muerto} active={alerta} onToggle={toggleAlerta}
            icon={Snowflake} tone="sky" label={`Sin vender en ${VENTANA_DIAS} días`}
            disabled={rotacionError}
            title={rotacionError ? 'No se pudieron leer las ventas' : undefined} />
          <Alerta k="margen" count={conteos.margen} active={alerta} onToggle={toggleAlerta}
            icon={TrendingDown} tone="amber" label={`Margen bajo ${MARGEN_MINIMO}%`} />
          <Alerta k="sinCosto" count={conteos.sinCosto} active={alerta} onToggle={toggleAlerta}
            icon={CircleHelp} tone="slate" label="Sin costo registrado"
            title="Sin precioOriginal no hay margen ni ganancia fiables" />
          <Alerta k="duplicado" count={conteos.duplicado} active={alerta} onToggle={toggleAlerta}
            icon={Copy} tone="red" label="Códigos duplicados"
            title="El escáner del POS elige uno al azar y descuenta stock del equivocado" />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className={cn(
                "h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full text-xs font-medium",
                "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10",
                "transition-colors", PRESS
              )}
            >
              <X className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        mostrarSkeleton && <Card className="flex-1 min-h-0 p-0 overflow-hidden">
          <div className="p-4 space-y-4 h-full overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-16 rounded-lg ml-auto" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        /* La Card se queda con todo el alto sobrante; dentro, la zona de scroll
           es flex-1 y la paginación va anclada abajo. */
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden p-0 border-white/10">
            <div
              ref={scrollRef}
              /* @container: las columnas se ocultan según el ancho real de la
                 tabla, que depende también de si el sidebar está desplegado. */
              className="@container flex-1 min-h-0 overflow-auto custom-scrollbar"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm">Imagen</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm hidden @2xl:table-cell">ID</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm">Nombre</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm hidden @xl:table-cell">Marca</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm hidden @md:table-cell">Categoría</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm">Precio Local</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm hidden @3xl:table-cell">Margen</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm hidden @4xl:table-cell">Rotación</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm hidden @5xl:table-cell">Web</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm">Stock</th>
                    <th className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm reduce-transparency:bg-slate-950 border-b border-white/10 px-4 py-3 font-medium text-slate-300 text-sm text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentItems.map((producto) => (
                    <tr key={producto.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10 grid place-items-center">
                          {producto.imagenProducto ? (
                            <img
                              src={producto.imagenProducto}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[10px] hidden @2xl:table-cell">
                        {producto.idProducto || producto.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-sm">{producto.nombreProducto}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm hidden @xl:table-cell">{producto.marcaProducto}</td>
                      <td className="px-4 py-3 hidden @md:table-cell">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                          <Tag className="w-3 h-3" />
                          {producto.categoriaProducto}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-emerald-400 tabular-nums">
                          ${getLocalPrice(producto).toLocaleString('es-CL')}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {producto._afecto
                            ? `neto ${money(producto._neto)}`
                            : <span className="text-slate-400">exento</span>}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-sm hidden @3xl:table-cell"
                        title={producto._alertas.sinCosto
                          ? 'Sin costo registrado: el margen no se puede calcular'
                          : `Costo ${money(producto._costo)} → neto ${money(producto._neto)}`
                            + (producto._afecto ? ` (+ IVA ${money(producto._iva)} = ${money(producto._venta)})` : ' · exento de IVA')}
                      >
                        {producto._alertas.sinCosto ? (
                          <span className="text-slate-500">Sin costo</span>
                        ) : (
                          <div className="flex items-baseline gap-1.5">
                            <span className={cn(
                              "font-medium tabular-nums",
                              producto._margenPct < 0 ? 'text-red-400'
                                : producto._margenPct < MARGEN_MINIMO ? 'text-amber-400'
                                  : 'text-emerald-400'
                            )}>
                              {producto._margenPct.toFixed(0)}%
                            </span>
                            <span className="text-[11px] text-slate-500 tabular-nums">
                              {money(producto._margenUnit)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm hidden @4xl:table-cell">
                        {rotacionError ? (
                          <span className="text-slate-600">—</span>
                        ) : producto._unidades === 0 ? (
                          <span className={cn("text-xs", producto._stock > 0 ? 'text-sky-300' : 'text-slate-500')}>
                            Sin ventas
                          </span>
                        ) : (
                          <div className="leading-tight">
                            <span className="text-slate-200 tabular-nums">{producto._unidades}</span>
                            <span className="text-slate-500 text-xs"> vend.</span>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {producto._cobertura === null ? '—'
                                : producto._cobertura > 365 ? '+1 año de stock'
                                  : `${producto._cobertura} días de stock`}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-sky-400 text-sm hidden @5xl:table-cell">
                        ${getWebPrice(producto).toLocaleString('es-CL')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className={`w-3.5 h-3.5 ${getStockColor(producto.cantidadProducto)}`} />
                          <span className={`font-medium text-sm ${getStockColor(producto.cantidadProducto)}`}>
                            {producto.cantidadProducto}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/editar/${producto.id}`)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(producto)}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {currentItems.length === 0 && (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                  <Package className="w-12 h-12 mb-3 opacity-40" />
                  {productos.length === 0 ? (
                    <>
                      <p className="font-medium">Aún no hay productos</p>
                      <p className="text-sm text-slate-500">Crea el primero para empezar a vender</p>
                      <Button onClick={() => navigate('/crear')} className="mt-4 h-10 text-sm inline-flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Crear producto
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Ningún producto coincide</p>
                      <p className="text-sm text-slate-500">Prueba con otro texto o rango de stock</p>
                      <Button
                        variant="secondary"
                        onClick={() => { setSearchTerm(''); setMinStock(''); setMaxStock(''); setAlerta(null) }}
                        className="mt-4 h-10 text-sm"
                      >
                        Limpiar filtros
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Anclada al pie de la Card: la paginación no debe irse con el scroll */}
            {filteredProducts.length > 0 && (
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3
                              border-t border-white/10 bg-slate-950/50 reduce-transparency:bg-slate-950">
                <p className="text-sm text-slate-400 tabular-nums">
                  Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, filteredProducts.length)} de {totalCount} productos
                  {hasFilters && <span className="text-slate-500"> · {productos.length} en total</span>}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className={cn(
                      "h-9 px-3 text-sm font-medium text-slate-200 bg-white/5 border border-white/10 rounded-lg",
                      "hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors", PRESS
                    )}
                  >
                    Anterior
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Ventana deslizante centrada en la página actual, sin
                      // salirse por ninguno de los dos extremos.
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                      const pageNum = start + i
                      if (pageNum > totalPages) return null

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          aria-current={page === pageNum ? 'page' : undefined}
                          className={cn(
                            "w-9 h-9 text-sm font-medium rounded-lg transition-colors tabular-nums", PRESS,
                            page === pageNum
                              ? 'bg-primary text-on-accent'
                              : 'text-slate-300 hover:bg-white/10'
                          )}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className={cn(
                      "h-9 px-3 text-sm font-medium text-slate-200 bg-white/5 border border-white/10 rounded-lg",
                      "hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors", PRESS
                    )}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
        </Card>
      )}

    </div>
  )
}

export default ProductList
