import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import CreateProducts from './pages/createProducts/CreateProducts'
import EditProduct from './pages/editProduct/EditProduct'
import ProductList from './pages/productList/ProductList'
import Sales from './pages/sales/Sales'
import SalesHistory from './pages/salesHistory/SalesHistory'
import Dashboard from './pages/dashboard/Dashboard'
import WebOrders from './pages/webOrders/WebOrders'
import { Layout } from './components/Layout'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Toaster position="bottom-right" theme="dark" richColors />
        <Routes>
          <Route path="/" element={<ProductList />} />
          <Route path="/crear" element={<CreateProducts onProductCreated={() => window.location.href = '/'} />} />
          <Route path="/editar/:id" element={<EditProduct />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/historial" element={<SalesHistory />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pedidos-web" element={<WebOrders />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

export default App
