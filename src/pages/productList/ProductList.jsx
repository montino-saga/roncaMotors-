import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { ArrowUpDown, Search, Package, DollarSign, Tag, Edit, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { doc, deleteDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '../../components/ui/Skeleton'

function ProductList() {
  const [productos, setProductos] = useState([])
  const [productosOriginales, setProductosOriginales] = useState([])
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState(null)

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('')
  const [minStock, setMinStock] = useState('')
  const [maxStock, setMaxStock] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const navigate = useNavigate()

  const getLocalPrice = (product) => Number(product?.precioVentaLocal ?? product?.precioProducto ?? 0)
  const getWebPrice = (product) => Number(product?.precioVentaWeb ?? 0)

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
      productosOrdenados.sort((a, b) => getLocalPrice(a) - getLocalPrice(b))
    }

    if (tipo === 'precio-desc') {
      productosOrdenados.sort((a, b) => getLocalPrice(b) - getLocalPrice(a))
    }

    if (tipo === '') {
      productosOrdenados = [...productosOriginales]
    }

    setOrden(tipo)
    setProductos(productosOrdenados)
  }

  const handleDeleteClick = (producto) => {
    setProductToDelete(producto)
    setIsModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!productToDelete) return

    try {
      await deleteDoc(doc(db, 'productos', productToDelete.id))
      setProductos(productos.filter(p => p.id !== productToDelete.id))
      setProductosOriginales(productosOriginales.filter(p => p.id !== productToDelete.id))
      toast.success('Producto eliminado correctamente')
    } catch (error) {
      console.error("Error al eliminar producto:", error)
      toast.error('Error al eliminar el producto')
    } finally {
      setIsModalOpen(false)
      setProductToDelete(null)
    }
  }

  // Helper for stock color
  const getStockColor = (stock) => {
    const quantity = parseInt(stock)
    if (quantity < 10) return 'text-red-400'
    if (quantity < 50) return 'text-yellow-400'
    return 'text-emerald-400'
  }

  // Filter Logic
  const filteredProducts = productos.filter(product => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = (
      product.nombreProducto.toLowerCase().includes(searchLower) ||
      product.marcaProducto?.toLowerCase().includes(searchLower) ||
      product.idProducto?.toString().toLowerCase().includes(searchLower) ||
      product.id?.toLowerCase().includes(searchLower)
    )

    const stock = parseInt(product.cantidadProducto) || 0
    const matchesMinStock = minStock === '' || stock >= parseInt(minStock)
    const matchesMaxStock = maxStock === '' || stock <= parseInt(maxStock)

    return matchesSearch && matchesMinStock && matchesMaxStock
  })

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Lista de Productos</h2>
          <p className="text-slate-400">Gestiona tu inventario y precios.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por ID, nombre o marca..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1) // Reset to first page on search
              }}
              className="pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50 w-full md:w-64 transition-colors"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min Stock"
              value={minStock}
              onChange={(e) => {
                setMinStock(e.target.value)
                setCurrentPage(1)
              }}
              className="w-24 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            />
            <span className="text-slate-500">-</span>
            <input
              type="number"
              placeholder="Max Stock"
              value={maxStock}
              onChange={(e) => {
                setMaxStock(e.target.value)
                setCurrentPage(1)
              }}
              className="w-24 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            />
          </div>

          <div className="relative">
            <select
              value={orden}
              onChange={(e) => ordenarProductos(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <option value="" className="bg-slate-900">Ordenar por...</option>
              <option value="nombre-asc" className="bg-slate-900">Nombre (A → Z)</option>
              <option value="nombre-desc" className="bg-slate-900">Nombre (Z → A)</option>
              <option value="precio-asc" className="bg-slate-900">Precio Local (Menor → Mayor)</option>
              <option value="precio-desc" className="bg-slate-900">Precio Local (Mayor → Menor)</option>
            </select>
            <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 space-y-4">
              {[...Array(itemsPerPage)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="w-14 h-14 rounded-lg" />
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
        </div>
      ) : (
        <>
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
                    <th className="p-4 font-medium text-slate-300">Precio Local</th>
                    <th className="p-4 font-medium text-slate-300">Precio Web</th>
                    <th className="p-4 font-medium text-slate-300">Original</th>
                    <th className="p-4 font-medium text-slate-300">Stock</th>
                    <th className="p-4 font-medium text-slate-300 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentItems.map((producto) => (
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          <Tag className="w-3 h-3" />
                          {producto.categoriaProducto}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-emerald-400">
                        ${getLocalPrice(producto).toLocaleString('es-CL')}
                      </td>
                      <td className="p-4 font-medium text-sky-400">
                        ${getWebPrice(producto).toLocaleString('es-CL')}
                      </td>
                      <td className="p-4 text-slate-500 line-through text-sm">
                        ${Number(producto.precioOriginal || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Package className={`w-4 h-4 ${getStockColor(producto.cantidadProducto)}`} />
                          <span className={`font-medium ${getStockColor(producto.cantidadProducto)}`}>
                            {producto.cantidadProducto}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/editar/${producto.id}`)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(producto)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
            </div>
          </Card>

          {/* Pagination Controls */}
          {filteredProducts.length > 0 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <p className="text-sm text-slate-400">
                Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, filteredProducts.length)} de {filteredProducts.length} productos
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5) {
                      if (currentPage > 3) {
                        pageNum = currentPage - 2 + i;
                      }
                    }
                    if (pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${currentPage === pageNum
                          ? 'bg-primary text-white'
                          : 'text-slate-400 hover:bg-white/5'
                          }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Confirmar Eliminación"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            ¿Estás seguro de que deseas eliminar el producto <span className="font-semibold text-white">{productToDelete?.nombreProducto}</span>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-lg shadow-red-500/20"
            >
              Eliminar Producto
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ProductList
