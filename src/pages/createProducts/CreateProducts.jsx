import { useState } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Button } from '../../components/ui/Button'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { PlusCircle, Package, DollarSign, Layers, Image as ImageIcon, Save, Barcode } from 'lucide-react'
import { toast } from 'sonner'

function CreateProducts({ onProductCreated }) {
  const [nuevoProducto, setNuevoProducto] = usePersistedState('roncamotors_create_product_draft', {
    nombreProducto: '',
    marcaProducto: '',
    categoriaProducto: '',
    precioVentaLocal: '',
    precioVentaWeb: '',
    precioOriginal: '',
    cantidadProducto: '',
    imagenProducto: '',
    idProducto: ''
  })

  const handleChange = (e) => {
    setNuevoProducto({
      ...nuevoProducto,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
        precioProducto: Number(nuevoProducto.precioVentaLocal)
      })

      toast.success('Producto creado con éxito')

      setNuevoProducto({
        nombreProducto: '',
        marcaProducto: '',
        categoriaProducto: '',
        precioVentaLocal: '',
        precioVentaWeb: '',
        precioOriginal: '',
        cantidadProducto: '',
        imagenProducto: '',
        idProducto: ''
      })
      if (onProductCreated) onProductCreated()
    } catch (error) {
      console.error("Error al crear producto:", error)
      toast.error('Error al crear producto')
    }
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col max-w-8x1 mx-auto px-4 lg:px-8">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white">Crear Producto</h2>
          <p className="text-slate-400 text-sm">Nuevo item para el inventario.</p>
        </div>
        <Button 
          onClick={handleSubmit}
          className="bg-primary hover:bg-primary/90 text-white font-bold px-6 shadow-lg shadow-primary/20"
        >
          <Save className="w-4 h-4 mr-2" />
          Guardar Producto
        </Button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        {/* Left Column: Image (Full Height) */}
        <div className="lg:col-span-4 h-full">
          <Card className="p-4 border-l-4 border-l-orange-500 h-full flex flex-col bg-slate-900/50">
            <div className="flex items-center gap-2 mb-3 text-orange-400 shrink-0">
              <ImageIcon className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Imagen Principal</h3>
            </div>
            
            <div className="flex-1 w-full bg-slate-950/50 rounded-xl overflow-hidden border-2 border-dashed border-white/10 hover:border-white/20 transition-colors relative group">
              <ImageUpload
                onImageUploaded={(url) => setNuevoProducto(prev => ({ ...prev, imagenProducto: url }))}
                currentImage={nuevoProducto.imagenProducto}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <p className="text-[10px] text-center text-slate-500 mt-2 shrink-0">
              Click o arrastrar para subir (JPG, PNG)
            </p>
          </Card>
        </div>

        {/* Right Column: Form Inputs (Full Height Scrollable) */}
        <div className="lg:col-span-8 h-full overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4">
          
          {/* 1. Inventory & ID (PRIORITY) */}
          <Card className="p-5 border-l-4 border-l-purple-500 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 mb-4 text-purple-400">
              <Barcode className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Identificación e Inventario</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Código / ID (Escaneable)</label>
                <Input
                  name="idProducto"
                  placeholder="Escanea el código de barras o escribe..."
                  value={nuevoProducto.idProducto}
                  onChange={handleChange}
                  className="font-mono text-sm bg-slate-950 border-purple-500/30 focus:border-purple-500 h-10"
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
          <Card className="p-5 border-l-4 border-l-blue-500 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <Package className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Datos Básicos</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Nombre del Producto <span className="text-red-400">*</span></label>
                <Input
                  name="nombreProducto"
                  placeholder="Ej. iPhone 15 Pro Max"
                  value={nuevoProducto.nombreProducto}
                  onChange={handleChange}
                  required
                  className="bg-slate-950 h-10"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Marca</label>
                <Input
                  name="marcaProducto"
                  placeholder="Ej. Apple"
                  value={nuevoProducto.marcaProducto}
                  onChange={handleChange}
                  className="bg-slate-950 h-10"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
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
          <Card className="p-5 border-l-4 border-l-emerald-500 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <DollarSign className="w-4 h-4" />
              <h3 className="font-semibold text-white text-sm">Precios</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-emerald-400 block">Venta Local <span className="text-red-400">*</span></label>
                <CurrencyInput
                  name="precioVentaLocal"
                  placeholder="$0"
                  value={nuevoProducto.precioVentaLocal}
                  onChange={handleChange}
                  required
                  className="border-emerald-500/20 focus:border-emerald-500/50 bg-emerald-500/5 font-bold h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-sky-400 block">Venta Web</label>
                <CurrencyInput
                  name="precioVentaWeb"
                  placeholder="$0"
                  value={nuevoProducto.precioVentaWeb}
                  onChange={handleChange}
                  className="border-sky-500/20 focus:border-sky-500/50 bg-sky-500/5 h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 block">Costo</label>
                <CurrencyInput
                  name="precioOriginal"
                  placeholder="$0"
                  value={nuevoProducto.precioOriginal}
                  onChange={handleChange}
                  className="text-slate-400 bg-slate-950 h-10"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CreateProducts