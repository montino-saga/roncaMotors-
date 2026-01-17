import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { ArrowUpDown, Search, Package, DollarSign, Tag } from 'lucide-react'

function ProductList() {
  const [productos, setProductos] = useState([])
  const [productosOriginales, setProductosOriginales] = useState([])
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState('')

  const obtenerProductos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'productos'))
      const docs = []
      querySnapshot.forEach((doc) => {
        docs.push({ ...doc.data(), id: doc.id })
      })
      setProductos(docs)
      setProductosOriginales(docs)
    } catch (error) {
      console.error('Error al obtener productos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    obtenerProductos()
  }, [])

  const ordenarProductos = (tipo) => {
    let productosOrdenados = [...productosOriginales]

    if (tipo === 'nombre-asc') {
      productosOrdenados.sort((a, b) =>
        a.nombreProducto.localeCompare(b.nombreProducto)
      )
    }

    if (tipo === 'nombre-desc') {
      productosOrdenados.sort((a, b) =>
        b.nombreProducto.localeCompare(a.nombreProducto)
      )
    }

    if (tipo === 'precio-asc') {
      productosOrdenados.sort((a, b) => a.precioProducto - b.precioProducto)
    }

    if (tipo === 'precio-desc') {
      productosOrdenados.sort((a, b) => b.precioProducto - a.precioProducto)
    }

    if (tipo === '') {
      productosOrdenados = [...productosOriginales]
    }

    setOrden(tipo)
    setProductos(productosOrdenados)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Lista de Productos</h2>
          <p className="text-slate-400">Gestiona tu inventario y precios.</p>
        </div>

        <div className="relative">
          <select
            value={orden}
            onChange={(e) => ordenarProductos(e.target.value)}
            className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="" className="bg-slate-900">Ordenar por...</option>
            <option value="nombre-asc" className="bg-slate-900">Nombre (A → Z)</option>
            <option value="nombre-desc" className="bg-slate-900">Nombre (Z → A)</option>
            <option value="precio-asc" className="bg-slate-900">Precio (Menor → Mayor)</option>
            <option value="precio-desc" className="bg-slate-900">Precio (Mayor → Menor)</option>
          </select>
          <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-medium text-slate-300">Imagen</th>
                  <th className="p-4 font-medium text-slate-300">ID</th>
                  <th className="p-4 font-medium text-slate-300">Nombre</th>
                  <th className="p-4 font-medium text-slate-300">Marca</th>
                  <th className="p-4 font-medium text-slate-300">Categoría</th>
                  <th className="p-4 font-medium text-slate-300">Precio</th>
                  <th className="p-4 font-medium text-slate-300">Original</th>
                  <th className="p-4 font-medium text-slate-300">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {productos.map((producto) => (
                  <tr key={producto.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                        <img
                          src={producto.imagenProducto || 'https://via.placeholder.com/56'}
                          alt={producto.nombreProducto}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-sm">
                      {producto.idProducto || producto.id.slice(0, 8)}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-white">{producto.nombreProducto}</div>
                    </td>
                    <td className="p-4 text-slate-300">{producto.marcaProducto}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Tag className="w-3 h-3" />
                        {producto.categoriaProducto}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-emerald-400">
                      ${producto.precioProducto}
                    </td>
                    <td className="p-4 text-slate-500 line-through text-sm">
                      ${producto.precioOriginal}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300">{producto.cantidadProducto}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default ProductList
