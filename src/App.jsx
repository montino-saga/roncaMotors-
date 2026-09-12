import { useLayoutEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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
import Settings from './pages/settings/Settings'
import { Layout } from './components/Layout'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppearanceProvider, useAppearance } from './context/AppearanceContext'

// Wrapper de cada vista: remonta al cambiar de ruta (key) y numera las Cards
// en orden de documento para escalonar su entrada (--i en .card-entra).
// Pasada la entrada, la vista se marca asentada: las Cards que lleguen después
// (datos de Firestore) aparecen sin animar, si no cada carga parecía lenta.
function Vista({ children }) {
    const ref = useRef(null)
    useLayoutEffect(() => {
        ref.current?.querySelectorAll('.card-entra').forEach((el, i) => el.style.setProperty('--i', i))
    })
    useLayoutEffect(() => {
        const el = ref.current
        const t = setTimeout(() => el?.setAttribute('data-asentada', ''), 700)
        return () => clearTimeout(t)
    }, [])
    return <div ref={ref} className="vista-entra">{children}</div>
}

function Panel() {
    const { resolved } = useAppearance()
    const { pathname } = useLocation()
    return (
        <ThemeProvider>
            {/* Fuera del Layout: su <main> vive bajo un transform con contain:paint,
                que convierte el fixed del toaster en relativo y lo recorta bajo la
                barra móvil. Arriba a la derecha: abajo tapaba "Finalizar Venta". */}
            <Toaster
                position="top-right"
                theme={resolved}
                richColors
                mobileOffset={{ top: 64, right: 12, left: 12 }}
            />
            <Layout>
                <Vista key={pathname}>
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
                    <Route path="/configuracion" element={<Settings />} />
                </Routes>
                </Vista>
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
        <AppearanceProvider>
            <AuthProvider>
                <Gate />
            </AuthProvider>
        </AppearanceProvider>
    )
}

export default App
