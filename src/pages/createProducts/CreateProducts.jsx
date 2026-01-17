import { useState } from 'react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PlusCircle } from 'lucide-react'

function CreateProducts({ onProductCreated }) {
  const [nuevoProducto, setNuevoProducto] = useState({
    nombreProducto: '',
    marcaProducto: '',
    categoriaProducto: '',
    precioProducto: '',
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
      await addDoc(collection(db, 'productos'), {
        ...nuevoProducto,
        precioProducto: Number(nuevoProducto.precioProducto),
        precioOriginal: Number(nuevoProducto.precioOriginal),
        cantidadProducto: Number(nuevoProducto.cantidadProducto)
      })
      alert('Producto creado con éxito')
      setNuevoProducto({
        nombreProducto: '',
        marcaProducto: '',
        categoriaProducto: '',
        precioProducto: '',
        precioOriginal: '',
        cantidadProducto: '',
        imagenProducto: '',
        idProducto: ''
      })
      if (onProductCreated) onProductCreated()
    } catch (error) {
      console.error("Error al crear producto:", error)
      alert('Error al crear producto')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Crear Nuevo Producto</h2>
        <p className="text-slate-400">Añade un nuevo producto al inventario.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Stock / Cantidad</label>
              <Input
                name="cantidadProducto"
                type="number"
                placeholder="0"
                value={nuevoProducto.cantidadProducto}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Precio Actual</label>
              <Input
                name="precioProducto"
                type="number"
                placeholder="0.00"
                value={nuevoProducto.precioProducto}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Precio Original</label>
              <Input
                name="precioOriginal"
                type="number"
                placeholder="0.00"
                value={nuevoProducto.precioOriginal}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">URL de la Imagen</label>
            <Input
              name="imagenProducto"
              placeholder="https://..."
              value={nuevoProducto.imagenProducto}
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

          <div className="pt-4">
            <Button type="submit" className="w-full flex items-center justify-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Crear Producto
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default CreateProducts

