import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../db/firebase'
import './productList.css'

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
    <div>
      <div className="header">
        <h2>Lista de Productos</h2>

        <div className="toolbar">
          <div className="select-wrapper">
            <select
              value={orden}
              onChange={(e) => ordenarProductos(e.target.value)}
              className="order-select"
            >
              <option value="">Ordenar por...</option>
              <option value="nombre-asc">Nombre (A → Z)</option>
              <option value="nombre-desc">Nombre (Z → A)</option>
              <option value="precio-asc">Precio (Menor → Mayor)</option>
              <option value="precio-desc">Precio (Mayor → Menor)</option>
            </select>
            <span className="select-arrow">▾</span>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Cargando productos...</p>
      ) : (
        <div className="table-container">
          <table className="product-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>ID</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Original</th>
                <th>Stock</th>
              </tr>
            </thead>

            <tbody>
              {productos.map((producto) => (
                <tr key={producto.id}>
                  <td>
                    <img
                      src={
                        producto.imagenProducto ||
                        'https://via.placeholder.com/56'
                      }
                      alt={producto.nombreProducto}
                      className="product-image"
                    />
                  </td>
                  <td>{producto.idProducto || producto.id}</td>
                  <td className="name">{producto.nombreProducto}</td>
                  <td>{producto.marcaProducto}</td>
                  <td className="category">
                    {producto.categoriaProducto}
                  </td>
                  <td className="price">${producto.precioProducto}</td>
                  <td className="original">
                    ${producto.precioOriginal}
                  </td>
                  <td className="stock">
                    {producto.cantidadProducto}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ProductList
