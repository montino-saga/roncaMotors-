import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../db/firebase'

function ProductList() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  const obtenerProductos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'productos'))
      const docs = []
      querySnapshot.forEach((doc) => {
        docs.push({ ...doc.data(), id: doc.id })
      })
      setProductos(docs)
    } catch (error) {
      console.error("Error al obtener productos:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    obtenerProductos()
  }, [])

  return (
    <div>
      <h2>Lista de Productos</h2>
      {loading ? (
        <p>Cargando productos...</p>
      ) : (
        <div style={{ padding: '20px', overflowX: 'auto' }}>
          <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: '#333' }}>
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
                  <td style={{ padding: '10px' }}>
                    <img 
                      src={producto.imagenProducto || 'https://via.placeholder.com/50'} 
                      alt={producto.nombreProducto} 
                      style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} 
                    />
                  </td>
                  <td style={{ padding: '10px' }}>{producto.idProducto || producto.id}</td>
                  <td style={{ padding: '10px' }}>{producto.nombreProducto}</td>
                  <td style={{ padding: '10px' }}>{producto.marcaProducto}</td>
                  <td style={{ padding: '10px' }}>{producto.categoriaProducto}</td>
                  <td style={{ padding: '10px' }}>${producto.precioProducto}</td>
                  <td style={{ padding: '10px', textDecoration: 'line-through', color: '#888' }}>
                    ${producto.precioOriginal}
                  </td>
                  <td style={{ padding: '10px' }}>{producto.cantidadProducto}</td>
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

