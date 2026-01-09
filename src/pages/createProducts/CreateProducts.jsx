import { useState } from 'react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../../db/firebase'

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
    <div style={{ backgroundColor: '#333', padding: '20px', borderRadius: '8px', marginBottom: '40px', maxWidth: '500px', margin: '0 auto 40px auto' }}>
      <h2>Crear Nuevo Producto</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input name="nombreProducto" placeholder="Nombre del Producto" value={nuevoProducto.nombreProducto} onChange={handleChange} required />
        <input name="marcaProducto" placeholder="Marca" value={nuevoProducto.marcaProducto} onChange={handleChange} />
        <input name="categoriaProducto" placeholder="Categoría" value={nuevoProducto.categoriaProducto} onChange={handleChange} />
        <input name="precioProducto" type="number" placeholder="Precio" value={nuevoProducto.precioProducto} onChange={handleChange} required />
        <input name="precioOriginal" type="number" placeholder="Precio Original" value={nuevoProducto.precioOriginal} onChange={handleChange} />
        <input name="cantidadProducto" type="number" placeholder="Stock / Cantidad" value={nuevoProducto.cantidadProducto} onChange={handleChange} />
        <input name="imagenProducto" placeholder="URL de la Imagen" value={nuevoProducto.imagenProducto} onChange={handleChange} />
        <input name="idProducto" placeholder="ID personalizado (opcional)" value={nuevoProducto.idProducto} onChange={handleChange} />
        <button type="submit" style={{ marginTop: '10px', backgroundColor: '#4CAF50', color: 'white' }}>Crear Producto</button>
      </form>
    </div>
  )
}

export default CreateProducts

