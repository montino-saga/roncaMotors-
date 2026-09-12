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
import ClientDetails from './pages/clients/ClientDetails'
import Login from './pages/login/Login'
import { Layout } from './components/Layout'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'

function Panel() {
    return (
        <ThemeProvider>
            <Layout>
                {/* Arriba: abajo a la derecha tapaba "Finalizar Venta" en el POS. */}
                <Toaster position="top-right" theme="dark" richColors />
                <Routes>
                    <Route path="/" element={<CashClose />} />
                    <Route path="/clientes" element={<Clients />} />
                    <Route path="/clientes/:id" element={<ClientDetails />} />
                    <Route path="/productos" element={<ProductList />} />
                    <Route path="/crear" element={<CreateProducts />} />
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

function Gate() {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        )
    }

    return user ? <Panel /> : <Login />
}

function App() {
    return (
        <AuthProvider>
            <Gate />
        </AuthProvider>
    )
}

export default App
