import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import CreateProducts from './pages/createProducts/CreateProducts'
import EditProduct from './pages/editProduct/EditProduct'
import ProductList from './pages/productList/ProductList'
import Sales from './pages/sales/Sales'
import SalesHistory from './pages/salesHistory/SalesHistory'
import Dashboard from './pages/dashboard/Dashboard'
import WebOrders from './pages/webOrders/WebOrders'
import CashClose from './pages/cashClose/CashClose'
import Clients from './pages/clients/Clients'
import { Layout } from './components/Layout'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Toaster position="bottom-right" theme="dark" richColors />
        <Routes>
          <Route path="/" element={<CashClose />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/productos" element={<ProductList />} />
          <Route path="/crear" element={<CreateProducts onProductCreated={() => window.location.href = '/productos'} />} />
          <Route path="/editar/:id" element={<EditProduct />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/historial" element={<SalesHistory />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pedidos-web" element={<WebOrders />} />
          <Route path="/cierre-caja" element={<CashClose />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

export default App
