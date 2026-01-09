import { Routes, Route, Link } from 'react-router-dom'
import CreateProducts from './pages/createProducts/CreateProducts'
import ProductList from './pages/productList/ProductList'
import './App.css'

function App() {
  return (
    <div className="App" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Placeholder para el Sidebar futuro */}
      <nav style={{ width: '200px', backgroundColor: '#1a1a1a', padding: '20px', borderRight: '1px solid #333' }}>
        <h3>Menú</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '10px' }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>📦 Productos</Link>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <Link to="/crear" style={{ color: 'white', textDecoration: 'none' }}>➕ Crear Producto</Link>
          </li>
        </ul>
      </nav>

      {/* Contenido Principal */}
      <main style={{ flex: 1, padding: '20px' }}>
        <h1>Gestión de Montino App</h1>
        
        <Routes>
          <Route path="/" element={<ProductList />} />
          <Route path="/crear" element={<CreateProducts onProductCreated={() => window.location.href = '/'} />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
