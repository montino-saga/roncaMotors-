import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import CreateProducts from './pages/createProducts/CreateProducts'
import ProductList from './pages/productList/ProductList'
import Sales from './pages/sales/Sales'
import { Layout } from './components/Layout'

function App() {
  return (
    <Layout>
      <Toaster position="bottom-right" theme="dark" richColors />
      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/crear" element={<CreateProducts onProductCreated={() => window.location.href = '/'} />} />
        <Route path="/ventas" element={<Sales />} />
      </Routes>
    </Layout>
  )
}

export default App
