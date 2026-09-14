import { lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from './pages/login/Login'
import { VistaSkeleton } from './components/ui/Skeleton'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AvisoConexion } from './components/AvisoConexion'
import { AvisoActualizacion } from './components/AvisoActualizacion'
import NotFound from './pages/notFound/NotFound'

// Un chunk por vista: el bundle único pesaba 1.7 MB y el móvil lo bajaba
// entero para abrir el POS. Login va eager: es lo primero que se ve.
const CreateProducts = lazy(() => import('./pages/createProducts/CreateProducts'))
const EditProduct = lazy(() => import('./pages/editProduct/EditProduct'))
const ProductList = lazy(() => import('./pages/productList/ProductList'))
const Sales = lazy(() => import('./pages/sales/Sales'))
const SalesHistory = lazy(() => import('./pages/salesHistory/SalesHistory'))
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const WebOrders = lazy(() => import('./pages/webOrders/WebOrders'))
const CashClose = lazy(() => import('./pages/cashClose/CashClose'))
const Clients = lazy(() => import('./pages/clients/Clients'))
const ClientDetails = lazy(() => import('./pages/clients/ClientDetails'))
const Settings = lazy(() => import('./pages/settings/Settings'))
const Analisis = lazy(() => import('./pages/analisis/Analisis'))
const Gastos = lazy(() => import('./pages/gastos/Gastos'))
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
            <AvisoConexion />
            <Layout>
                <Vista key={pathname}>
                <ErrorBoundary>
                <Suspense fallback={<VistaSkeleton />}>
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
                    <Route path="/analisis" element={<Analisis />} />
                    <Route path="/pedidos-web" element={<WebOrders />} />
                    <Route path="/gastos" element={<Gastos />} />
                    <Route path="/cierre-caja" element={<CashClose />} />
                    <Route path="/configuracion" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
                </ErrorBoundary>
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
                {/* Fuera del Gate: el SW se registra desde el login, si no Chrome no ofrece instalar hasta entrar. */}
                <AvisoActualizacion />
                <Gate />
            </AuthProvider>
        </AppearanceProvider>
    )
}

export default App
