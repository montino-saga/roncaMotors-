import { useState } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Button } from '../../components/ui/Button'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { PlusCircle } from 'lucide-react'
import { toast } from 'sonner'

function CreateProducts({ onProductCreated }) {
  const [nuevoProducto, setNuevoProducto] = usePersistedState('montino_create_product_draft', {
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
      // Check for duplicate ID if one is provided
      if (nuevoProducto.idProducto) {
        const q = query(
          collection(db, 'productos'),
          where('idProducto', '==', nuevoProducto.idProducto)
        )
        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          toast.error('El ID del producto ya existe. Por favor usa otro.')
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Crear Nuevo Producto</h2>
        <p className="text-slate-400">Añade un nuevo producto al inventario.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-2 space-y-8">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Información Básica</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Nombre del Producto</label>
                    <Input
                      name="nombreProducto"
                      placeholder="Ej. iPhone 15 Pro"
                      value={nuevoProducto.nombreProducto}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Marca</label>
                      <Input
                        name="marcaProducto"
                        placeholder="Ej. Apple"
                        value={nuevoProducto.marcaProducto}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Categoría</label>
                      <Input
                        name="categoriaProducto"
                        placeholder="Ej. Electrónica"
                        value={nuevoProducto.categoriaProducto}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Precios</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-emerald-400">Precio Local</label>
                    <CurrencyInput
                      name="precioVentaLocal"
                      placeholder="$0"
                      value={nuevoProducto.precioVentaLocal}
                      onChange={handleChange}
                      required
                      className="border-emerald-500/20 focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-sky-400">Precio Web</label>
                    <CurrencyInput
                      name="precioVentaWeb"
                      placeholder="$0"
                      value={nuevoProducto.precioVentaWeb}
                      onChange={handleChange}
                      required
                      className="border-sky-500/20 focus:border-sky-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Precio Original</label>
                    <CurrencyInput
                      name="precioOriginal"
                      placeholder="$0"
                      value={nuevoProducto.precioOriginal}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Inventory Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Inventario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Stock Disponible</label>
                    <Input
                      name="cantidadProducto"
                      type="number"
                      placeholder="0"
                      value={nuevoProducto.cantidadProducto}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">ID Personalizado (Opcional)</label>
                    <Input
                      name="idProducto"
                      placeholder="Identificador único"
                      value={nuevoProducto.idProducto}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Image Upload */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Imagen del Producto</label>
                  <ImageUpload
                    onImageUploaded={(url) => setNuevoProducto(prev => ({ ...prev, imagenProducto: url }))}
                    currentImage={nuevoProducto.imagenProducto}
                    className="h-full"
                  />
                </div>

                <Button type="submit" className="w-full flex items-center justify-center gap-2 mt-6">
                  <PlusCircle className="w-5 h-5" />
                  Crear Producto
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default CreateProducts

