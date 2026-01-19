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

  const totalValue = filteredProducts.reduce((acc, p) => acc + (getLocalPrice(p) * (parseInt(p.cantidadProducto) || 0)), 0)
  const totalCount = filteredProducts.length

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Lista de Productos</h2>
          <p className="text-slate-400 text-sm">Gestiona tu inventario y precios.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Stats Summary */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
              <div className="bg-emerald-500/20 p-1.5 rounded-lg text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider leading-none">Valor Total</p>
                <p className="text-lg font-bold text-emerald-400 leading-tight">
                  ${totalValue.toLocaleString('es-CL')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider leading-none">Productos</p>
                <p className="text-lg font-bold text-white leading-tight">
                  {totalCount}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9 pr-4 h-10 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-48 transition-colors"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 h-10">
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
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
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
          <Card className="overflow-hidden p-0 border-white/10">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 sticky top-0 z-10">
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm">Imagen</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm hidden lg:table-cell">ID</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm">Nombre</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm hidden md:table-cell">Marca</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm hidden sm:table-cell">Categoría</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm">Precio Local</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm hidden xl:table-cell">Web</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm hidden xl:table-cell">Original</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm">Stock</th>
                    <th className="px-4 py-3 font-medium text-slate-300 text-sm text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentItems.map((producto) => (
                    <tr key={producto.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                          <img
                            src={producto.imagenProducto || 'https://via.placeholder.com/48'}
                            alt={producto.nombreProducto}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[10px] hidden lg:table-cell">
                        {producto.idProducto || producto.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-sm">{producto.nombreProducto}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm hidden md:table-cell">{producto.marcaProducto}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                          <Tag className="w-3 h-3" />
                          {producto.categoriaProducto}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-400 text-sm">
                        ${getLocalPrice(producto).toLocaleString('es-CL')}
                      </td>
                      <td className="px-4 py-3 font-medium text-sky-400 text-sm hidden xl:table-cell">
                        ${getWebPrice(producto).toLocaleString('es-CL')}
                      </td>
                      <td className="px-4 py-3 text-slate-500 line-through text-xs hidden xl:table-cell">
                        ${Number(producto.precioOriginal || 0).toLocaleString('es-CL')}
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
