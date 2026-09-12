import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Button } from '../../components/ui/Button'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { PlusCircle, Package, DollarSign, Layers, Image as ImageIcon, Save, Barcode, Eraser } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'
import { PRESS } from '../../lib/motion'
import { TASA_IVA } from '../../lib/iva'
import { desdeMargen, margenImplicito, formulaReferencia, indicadores } from '../../lib/precios'

const ATAJOS = [20, 30, 40, 50]

const clp = (n) => `$${Math.round(n).toLocaleString('es-CL')}`

/**
 * Un precio que se puede escribir de dos formas. El conmutador cambia cuál de
 * los dos campos editas; los dos valores se muestran siempre, para que nunca
 * haya que adivinar el que está oculto.
 */
function PrecioVenta({ label, tone, costo, precio, modo, pct, onModo, onPct, onPrecio, name, required, afecto }) {
  const venta = Number(precio) || 0
  const hayCosto = costo > 0
  // El IVA se recauda para el fisco: no entra en la ganancia por ningún lado.
  const { neto, iva, ganancia, markup: markupReal, margen: margenReal, perdida } = indicadores(costo, venta, afecto)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className={cn("text-xs font-medium block", tone)}>
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <div className="flex rounded-lg bg-slate-950 border border-white/10 p-0.5" role="group">
          {[['pct', '% margen'], ['fijo', 'Precio fijo']].map(([k, txt]) => (
            <button
              key={k}
              type="button"
              onClick={() => onModo(k)}
              disabled={k === 'pct' && !hayCosto}
              title={k === 'pct' && !hayCosto ? 'Ingresa primero el costo' : undefined}
              aria-pressed={modo === k}
              className={cn(
                "px-2.5 h-7 text-[11px] font-medium rounded-md transition-colors",
                "disabled:opacity-30 disabled:cursor-not-allowed", PRESS,
                modo === k ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {modo === 'pct' ? (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="99"
              inputMode="numeric"
              value={pct}
              onChange={(e) => onPct(e.target.value)}
              placeholder="40"
              className="h-10 pr-8 font-bold"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">%</span>
          </div>
          <div className="flex gap-1.5">
            {ATAJOS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onPct(String(v))}
                className={cn(
                  "flex-1 h-7 rounded-md text-[11px] font-medium transition-colors", PRESS,
                  String(v) === String(pct)
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                )}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>
      ) : (
        <CurrencyInput
          name={name}
          placeholder="$0"
          value={precio}
          onChange={onPrecio}
          required={required}
          className={cn("h-10 font-bold", tone)}
        />
      )}

      {/* El resultado de la otra mitad del cálculo, siempre visible. */}
      <div className={cn(
        "rounded-lg px-3 py-2 border text-sm",
        perdida ? "bg-red-500/10 border-red-500/25" : "bg-white/[0.03] border-white/10"
      )}>
        {venta > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-400 text-xs">Paga el cliente</span>
              <span className={cn("font-bold tabular-nums", perdida ? "text-red-400" : tone)}>
                {clp(venta)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1 text-[11px] tabular-nums">
              <span className="text-slate-500">Neto {clp(neto)}</span>
              <span className="text-slate-500">
                {afecto ? `+ IVA ${clp(iva)}` : 'Exento de IVA'}
              </span>
            </div>
            {hayCosto && (
              <div className="flex items-baseline justify-between gap-2 mt-1.5 pt-1.5
                              border-t border-white/[0.07] text-[11px]">
                <span className={perdida ? 'text-red-400' : 'text-slate-400'}>
                  {perdida ? 'El neto no cubre el costo' : `Ganas ${clp(ganancia)}`}
                </span>
                <span className="text-slate-400 tabular-nums">
                  +{markupReal.toFixed(1)}% sobre costo · {margenReal.toFixed(0)}% margen
                </span>
              </div>
            )}
          </>
        ) : (
          <span className="text-slate-500 text-xs">
            {hayCosto ? 'Escribe un margen menor a 100%' : 'Ingresa el costo para calcular'}
          </span>
        )}
      </div>
    </div>
  )
}

function FormulaPrecio({ costo }) {
  const ref = formulaReferencia(costo)
  if (!ref) return null
  const { neto, precio } = ref

  return (
    <div className="rounded-lg px-3 py-2 border border-emerald-500/25 bg-emerald-500/[0.06] text-[11px] tabular-nums space-y-0.5">
      <p className="text-slate-400">
        Fórmula: <span className="text-slate-300">precioVenta = (costo neto ÷ 0,6) × 1,19</span>
      </p>
      <p className="text-slate-400">
        ({clp(costo)} ÷ 0,6) × 1,19 = <span className="text-slate-200">{clp(neto)}</span> × 1,19
      </p>
      <p className="flex justify-between gap-2 pt-1 border-t border-emerald-500/20">
        <span className="text-slate-400">Precio venta</span>
        <span className="font-bold text-emerald-400">{clp(precio)}</span>
      </p>
    </div>
  )
}

const PRODUCTO_VACIO = {
  nombreProducto: '',
  marcaProducto: '',
  categoriaProducto: '',
  precioVentaLocal: '',
  precioVentaWeb: '',
  precioOriginal: '',
  cantidadProducto: '',
  imagenProducto: '',
  idProducto: '',
  afectoIva: true
}

function CreateProducts() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const idRef = useRef(null)
  const nombreRef = useRef(null)

  // El lector de barras remata con Enter: eso debe saltar al nombre, no enviar
  // un producto a medio llenar.
  const enterAlNombre = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    nombreRef.current?.focus()
  }
  const [nuevoProducto, setNuevoProducto] = usePersistedState('roncamotors_create_product_draft', {
    nombreProducto: '',
    marcaProducto: '',
    categoriaProducto: '',
    precioVentaLocal: '',
    precioVentaWeb: '',
    precioOriginal: '',
    cantidadProducto: '',
    imagenProducto: '',
    idProducto: '',
    afectoIva: true
  })

  const afecto = nuevoProducto.afectoIva !== false

  // Aparte del borrador del producto: son ayudas de captura, no campos del
  // documento. Mezclarlas haría que `addDoc({...nuevoProducto})` las guardara.
  const [ganancia, setGanancia] = usePersistedState('roncamotors_create_product_ganancia', {
    modoLocal: 'pct', pctLocal: '40',
    modoWeb: 'fijo', pctWeb: ''
  })

  const costo = Number(nuevoProducto.precioOriginal) || 0

  const handleChange = (e) => {
    setNuevoProducto({
      ...nuevoProducto,
      [e.target.name]: e.target.value
    })
  }

  // El costo es la base: al cambiarlo, los precios en modo % se recalculan solos.
  const handleCosto = (e) => {
    const valor = e.target.value
    const c = Number(valor) || 0
    setNuevoProducto((prev) => ({
      ...prev,
      precioOriginal: valor,
      precioVentaLocal: ganancia.modoLocal === 'pct'
        ? desdeMargen(c, ganancia.pctLocal, afecto) : prev.precioVentaLocal,
      precioVentaWeb: ganancia.modoWeb === 'pct'
        ? desdeMargen(c, ganancia.pctWeb, afecto) : prev.precioVentaWeb
    }))
  }

  const setPct = (campo, valor) => {
    setGanancia((g) => ({ ...g, [`pct${campo}`]: valor }))
    setNuevoProducto((p) => ({ ...p, [`precioVenta${campo}`]: desdeMargen(costo, valor, afecto) }))
  }

  // Cambiar el régimen mueve el precio final: la ganancia pactada es la misma
  // y lo que cambia es si hay que sumarle IVA encima.
  const setAfecto = (valor) => {
    setNuevoProducto((p) => ({
      ...p,
      afectoIva: valor,
      precioVentaLocal: ganancia.modoLocal === 'pct'
        ? desdeMargen(costo, ganancia.pctLocal, valor) : p.precioVentaLocal,
      precioVentaWeb: ganancia.modoWeb === 'pct'
        ? desdeMargen(costo, ganancia.pctWeb, valor) : p.precioVentaWeb
    }))
  }

  const setModo = (campo, modo) => {
    setGanancia((g) => ({ ...g, [`modo${campo}`]: modo }))
    if (modo === 'pct') {
      // Al volver a %, el margen arranca en el que ya implica el precio
      // escrito a mano: cambiar de modo no debe mover el precio.
      const pct = margenImplicito(costo, nuevoProducto[`precioVenta${campo}`], afecto)
      if (pct != null) {
        setGanancia((g) => ({ ...g, [`modo${campo}`]: modo, [`pct${campo}`]: String(pct) }))
      }
    }
  }

  const hayBorrador = Object.entries(nuevoProducto).some(([k, v]) => k !== 'afectoIva' && v !== '')

  const limpiar = () => {
    setNuevoProducto({ ...PRODUCTO_VACIO, afectoIva: afecto })
    idRef.current?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!(Number(nuevoProducto.precioVentaLocal) > 0)) {
      toast.error('Falta el precio de venta local')
      return
    }
    setSaving(true)
    try {
      if (nuevoProducto.idProducto) {
        const q = query(
          collection(db, 'productos'),
          where('idProducto', '==', nuevoProducto.idProducto)
        )
        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          toast.error('El ID del producto ya existe.')
          return
        }
      }

      await addDoc(collection(db, 'productos'), {
        ...nuevoProducto,
        precioVentaLocal: Number(nuevoProducto.precioVentaLocal),
        precioVentaWeb: Number(nuevoProducto.precioVentaWeb),
        precioOriginal: Number(nuevoProducto.precioOriginal),
        cantidadProducto: Number(nuevoProducto.cantidadProducto),
        precioProducto: Number(nuevoProducto.precioVentaLocal),
        afectoIva: afecto
      })

      // Se queda aquí: lo normal es cargar varios productos seguidos.
      toast.success('Producto creado', {
        description: nuevoProducto.nombreProducto,
        action: { label: 'Ver inventario', onClick: () => navigate('/productos') }
      })
      limpiar()
    } catch (error) {
      console.error("Error al crear producto:", error)
      toast.error('Error al crear producto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="page-fit flex flex-col">
      <div className="mb-4 tall:mb-6 shrink-0">
        <h2 className="text-lg sm:text-2xl font-bold text-white tracking-[-0.01em] truncate">Crear Producto</h2>
        <p className="text-slate-400 text-sm hidden sm:block">Nuevo item para el inventario.</p>
      </div>

      {/* Por debajo de lg todo scrollea junto en un único hilo; a partir de lg
          la imagen se queda fija y sólo el formulario se desplaza. */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-visible custom-scrollbar
                      grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Imagen */}
        <div className="lg:col-span-4 lg:h-full lg:min-h-0">
          <Card className="p-4 border-l-4 border-l-orange-500 lg:h-full flex flex-col bg-slate-900/50">
            <div className="flex items-center gap-2 mb-3 text-orange-400 shrink-0">
              <ImageIcon className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Imagen Principal</h3>
            </div>

            {/* Proporción fija en móvil (h-full daría una tira infinita dentro
                de un scroller); en lg se estira a la altura de la columna. */}
            <div className="aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:flex-1 w-full
                            bg-slate-950/50 rounded-xl overflow-hidden border-2 border-dashed
                            border-white/10 hover:border-white/20 transition-colors relative group">
              <ImageUpload
                onImageUploaded={(url) => setNuevoProducto(prev => ({ ...prev, imagenProducto: url }))}
                currentImage={nuevoProducto.imagenProducto}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <p className="text-[11px] text-center text-slate-500 mt-2 shrink-0">
              Click o arrastrar para subir (JPG, PNG)
            </p>
          </Card>
        </div>

        {/* Formulario. @container: los campos se reparten según el ancho de esta
            columna, que depende también de si el sidebar está desplegado. */}
        <div className="@container lg:col-span-8 lg:h-full lg:min-h-0 lg:overflow-y-auto
                        lg:pr-2 custom-scrollbar flex flex-col gap-4">

          {/* 1. Inventory & ID (PRIORITY) */}
          <Card className="p-4 @lg:p-5 border-l-4 border-l-purple-500 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 mb-4 text-purple-400">
              <Barcode className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Identificación e Inventario</h3>
            </div>

            <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4 @lg:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Código / ID (Escaneable)</label>
                <Input
                  name="idProducto"
                  placeholder="Escanea el código de barras o escribe..."
                  value={nuevoProducto.idProducto}
                  onChange={handleChange}
                  className="font-mono text-sm bg-slate-950 border-purple-500/30 focus:border-purple-500 h-10"
                  ref={idRef}
                  onKeyDown={enterAlNombre}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Stock Inicial</label>
                <Input
                  name="cantidadProducto"
                  type="number"
                  placeholder="0"
                  value={nuevoProducto.cantidadProducto}
                  onChange={handleChange}
                  className="font-mono bg-slate-950 h-10"
                />
              </div>
            </div>
          </Card>

          {/* 2. Basic Info */}
          <Card className="p-4 @lg:p-5 border-l-4 border-l-blue-500 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <Package className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Datos Básicos</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 @lg:gap-6">
              <div className="col-span-12">
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Nombre del Producto <span className="text-red-400">*</span></label>
                <Input
                  ref={nombreRef}
                  name="nombreProducto"
                  placeholder="Ej. iPhone 15 Pro Max"
                  value={nuevoProducto.nombreProducto}
                  onChange={handleChange}
                  required
                  className="bg-slate-950 h-10"
                />
              </div>

              <div className="col-span-12 @lg:col-span-6">
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Marca</label>
                <Input
                  name="marcaProducto"
                  placeholder="Ej. Apple"
                  value={nuevoProducto.marcaProducto}
                  onChange={handleChange}
                  className="bg-slate-950 h-10"
                />
              </div>

              <div className="col-span-12 @lg:col-span-6">
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Categoría</label>
                <Input
                  name="categoriaProducto"
                  placeholder="Ej. Electrónica"
                  value={nuevoProducto.categoriaProducto}
                  onChange={handleChange}
                  className="bg-slate-950 h-10"
                />
              </div>
            </div>
          </Card>

          {/* 3. Pricing */}
          <Card className="p-4 @lg:p-5 border-l-4 border-l-emerald-500 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <DollarSign className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Precios</h3>
            </div>

            {/* El costo va primero: es el número del que dependen los otros dos. */}
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
              <div className="space-y-1.5 w-full @sm:w-auto @sm:min-w-[200px]">
                <label className="text-xs font-medium text-slate-300 block">
                  Costo <span className="text-slate-500 font-normal">— neto, sin IVA</span>
                </label>
                <CurrencyInput
                  name="precioOriginal"
                  placeholder="$0"
                  value={nuevoProducto.precioOriginal}
                  onChange={handleCosto}
                  className="bg-slate-950 h-10 font-medium"
                />
                <FormulaPrecio costo={costo} />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-300 block">Régimen</span>
                <div className="flex rounded-lg bg-slate-950 border border-white/10 p-0.5" role="group">
                  {[[true, `Afecto a IVA ${TASA_IVA}%`], [false, 'Exento']].map(([v, txt]) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setAfecto(v)}
                      aria-pressed={afecto === v}
                      className={cn(
                        "px-3 h-9 text-[11px] font-medium rounded-md transition-colors", PRESS,
                        afecto === v ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                      )}
                    >
                      {txt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-5 pt-5 border-t border-white/10">
              <PrecioVenta
                label="Venta Local"
                tone="text-emerald-400"
                name="precioVentaLocal"
                required
                costo={costo}
                afecto={afecto}
                precio={nuevoProducto.precioVentaLocal}
                modo={ganancia.modoLocal}
                pct={ganancia.pctLocal}
                onModo={(m) => setModo('Local', m)}
                onPct={(v) => setPct('Local', v)}
                onPrecio={handleChange}
              />
              <PrecioVenta
                label="Venta Web"
                tone="text-sky-400"
                name="precioVentaWeb"
                costo={costo}
                afecto={afecto}
                precio={nuevoProducto.precioVentaWeb}
                modo={ganancia.modoWeb}
                pct={ganancia.pctWeb}
                onModo={(m) => setModo('Web', m)}
                onPct={(v) => setPct('Web', v)}
                onPrecio={handleChange}
              />
            </div>
          </Card>

          {/* Acciones al cierre del formulario: el ojo termina en Precios y
              Guardar está justo debajo, no en el borde de la pantalla. */}
          <div className="shrink-0 flex flex-col-reverse @md:flex-row @md:items-center @md:justify-between gap-3 pb-2">
            <p className="text-xs text-slate-500 text-center @md:text-left">
              {hayBorrador ? 'Borrador guardado en este equipo.' : 'Los campos con * son obligatorios.'}
            </p>
            <div className="flex gap-2 @md:gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={limpiar}
                disabled={saving || !hayBorrador}
                className="h-12 px-4 flex-1 @md:flex-none inline-flex items-center justify-center gap-2 whitespace-nowrap
                           disabled:opacity-40 disabled:pointer-events-none"
              >
                <Eraser className="w-4 h-4" />
                Limpiar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-12 px-6 flex-[2] @md:flex-none @md:min-w-[220px] text-base font-bold
                           inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Guardando…' : 'Guardar producto'}
              </Button>
            </div>
          </div>
        </div>
      </div>

    </form>
  )
}

export default CreateProducts