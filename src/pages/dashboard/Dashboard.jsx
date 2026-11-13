import { toast } from 'sonner'
import { useState, useEffect, useMemo } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { esAbono, esIngresoReal, obtenerVentas, rangoDeVentas } from '../../lib/ventas'
import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { useCatalogo } from '../../lib/catalogo'
import { Card } from '../../components/ui/Card'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts'
import {
    DollarSign, ShoppingBag, TrendingUp, CreditCard, Calendar,
    User, Wallet, AlertCircle, Clock, Package, ArrowUpRight, ArrowDownRight,
    Receipt, Users, Boxes, ChartNoAxesCombined
} from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'
import { Skeleton, SkeletonCard, SkeletonKpis, SkeletonHeader } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { useTheme } from '../../context/ThemeContext'
import { useAppearance } from '../../context/AppearanceContext'
import { chartTheme } from '../../lib/chartTheme'
import { ClientesTab, DashboardTab, GastosTab, Kpi, Mini, ProductosTab } from './DashboardTabs'

const isoLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const hoyISO = () => isoLocal(new Date())

const METRICAS_VACIAS = {
    totalCashFlow: 0,
    totalCreditSales: 0,
    totalProfit: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    profitMargin: 0,
}

function Dashboard() {
    const [sales, setSales] = useState([])
    const [gastos, setGastos] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadingClientes, setLoadingClientes] = useState(true)
    const mostrarSkeleton = useDelayedLoading(loading)
    const { settings } = useTheme()
    const ct = chartTheme(useAppearance().resolved)
    const { productos } = useCatalogo()
    // Bajo stock (< 5) sale del catálogo compartido: sin lecturas extra por rango.
    const lowStockCount = productos.filter(p => (p.cantidadProducto || 0) < 5).length
    // La deuda es un saldo global, no del rango: sale de los clientes, no de las ventas.
    // Solo lo que se debe: un saldo a favor no descuenta la deuda de otro cliente.
    const deudaClientes = clientes.reduce((acc, c) => acc + Math.max(0, Number(c.currentDebt) || 0), 0)
    
    const [metrics, setMetrics] = useState(METRICAS_VACIAS)

    const [chartsData, setChartsData] = useState({
        salesOverTime: [],
        topProducts: [],
        hourlySales: [],
    })

    // Date Filter State
    const [dateRange, setDateRange] = usePersistedState('roncamotors_dashboard_range', 'week')
    const [customStart, setCustomStart] = usePersistedState('roncamotors_dashboard_desde', '')
    const [customEnd, setCustomEnd] = usePersistedState('roncamotors_dashboard_hasta', '')
    const [customStartDraft, setCustomStartDraft] = useState(customStart)
    const [customEndDraft, setCustomEndDraft] = useState(customEnd)
    const [activeTab, setActiveTab] = usePersistedState('roncamotors_dashboard_tab', 'ventas')
    const maxDate = hoyISO()
    const rangoPersonalizadoValido = Boolean(
        customStartDraft && customEndDraft && customStartDraft <= customEndDraft &&
        customStartDraft <= maxDate && customEndDraft <= maxDate
    )

    useEffect(() => {
        setCustomStartDraft(customStart)
        setCustomEndDraft(customEnd)
    }, [customStart, customEnd])

    useEffect(() => {
        const max = hoyISO()
        if (customStart > max) setCustomStart(max)
        if (customEnd > max) setCustomEnd(max)
    }, [customStart, customEnd, setCustomStart, setCustomEnd])

    // Un rango nulo = personalizado incompleto: ni se consulta ni se grafica.
    const rango = useMemo(
        () => (dateRange === 'custom' && (!customStart || !customEnd))
            ? null
            : rangoDeVentas(dateRange, new Date(), customStart, customEnd),
        [dateRange, customStart, customEnd]
    )

    useEffect(() => {
        let vivo = true
        const cargarClientes = async () => {
            try {
                const snapshot = await getDocs(query(collection(db, 'clients')))
                if (vivo) setClientes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
            } catch (error) {
                console.error('Error cargando clientes del dashboard:', error)
                toast.error('No se pudieron cargar los clientes')
            } finally {
                if (vivo) setLoadingClientes(false)
            }
        }
        cargarClientes()
        return () => { vivo = false }
    }, [])

    useEffect(() => {
        let vivo = true
        const fetchData = async () => {
            setLoading(true)
            try {
                const [salesData, gastosSnapshot] = await Promise.all([
                    obtenerVentas(rango.desde, rango.hasta),
                    getDocs(query(
                        collection(db, 'gastos'),
                        where('fecha', '>=', Timestamp.fromDate(rango.desde)),
                        where('fecha', '<=', Timestamp.fromDate(rango.hasta)),
                        orderBy('fecha', 'desc'),
                    )),
                ])

                if (vivo) {
                    setSales(salesData)
                    setGastos(gastosSnapshot.docs.map(d => ({ id: d.id, ...d.data() })))
                    processMetrics(salesData)
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error)
                if (vivo) toast.error('No se pudieron cargar los datos del dashboard')
            } finally {
                if (vivo) setLoading(false)
            }
        }

        if (rango) fetchData()
        else {
            // Rango personalizado a medio escribir: nada que pedir todavía.
            setSales([])
            setGastos([])
            setMetrics(METRICAS_VACIAS)
            setChartsData({ salesOverTime: [], topProducts: [], hourlySales: [] })
            setLoading(false)
        }
        return () => { vivo = false }
    }, [rango])

    const processMetrics = (salesData) => {
        // --- Financial Metrics ---
        const totalCashFlow = salesData.reduce((acc, curr) => {
            if (esIngresoReal(curr)) {
                return acc + (curr.totalVenta || 0)
            }
            return acc
        }, 0)

        const totalCreditSales = salesData.reduce((acc, curr) => {
            if (curr.tipoPago === 'fiado') {
                return acc + (curr.totalVenta || 0)
            }
            return acc
        }, 0)

        const totalProfit = salesData.reduce((acc, curr) => {
            if (esAbono(curr)) return acc
            return acc + (curr.totalGanancia || 0)
        }, 0)

        const totalOrders = salesData.filter(s => !esAbono(s)).length
        const totalRevenueVolume = salesData.reduce((acc, sale) =>
            esAbono(sale) ? acc : acc + (sale.totalVenta || 0), 0)
        const averageOrderValue = totalOrders > 0 ? totalRevenueVolume / totalOrders : 0
        const profitMargin = totalRevenueVolume > 0 ? (totalProfit / totalRevenueVolume) * 100 : 0
        
        setMetrics({
            totalCashFlow,
            totalCreditSales,
            totalProfit,
            totalOrders,
            averageOrderValue,
            profitMargin
        })

        // --- Charts Data ---

        // 1. Sales Over Time
        const salesByDay = {}
        salesData.forEach(sale => {
            if (!sale.fechaVenta) return
            if (esAbono(sale)) return

            const date = sale.fechaVenta.toDate().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
            if (!salesByDay[date]) salesByDay[date] = 0
            salesByDay[date] += sale.totalVenta
        })

        const salesOverTime = Object.entries(salesByDay)
            .map(([date, ventas]) => ({ date, ventas }))
            .sort((a, b) => {
                const [da, ma] = a.date.split('/')
                const [db, mb] = b.date.split('/')
                return new Date(2024, ma - 1, da) - new Date(2024, mb - 1, db)
            })

        // 2. Hourly Sales
        const hourlyCount = Array(24).fill(0)
        salesData.forEach(sale => {
            if (!sale.fechaVenta || esAbono(sale)) return
            const hour = sale.fechaVenta.toDate().getHours()
            hourlyCount[hour]++
        })
        
        // Filter only hours with sales to clean up chart
        const hourlySales = hourlyCount
            .map((count, hour) => ({ hour: `${hour}:00`, count }))
            .filter(item => item.count > 0)

        // 3. Top Products
        const productSales = {}
        salesData.forEach(sale => {
            if (esAbono(sale)) return
            sale.productos.forEach(prod => {
                if (productSales[prod.nombreProducto]) {
                    productSales[prod.nombreProducto] += prod.cantidad
                } else {
                    productSales[prod.nombreProducto] = prod.cantidad
                }
            })
        })
        const topProducts = Object.entries(productSales)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)

        setChartsData({
            salesOverTime,
            hourlySales,
            topProducts
        })
    }

    if (loading) {
        if (!mostrarSkeleton) return null
        return (
            <div className="space-y-6 pb-8" aria-busy="true" aria-label="Cargando dashboard">
                <SkeletonHeader actions={1} />
                <SkeletonKpis />
                <SkeletonKpis count={3} className="lg:grid-cols-3" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <SkeletonCard lines={0} className="p-6 min-h-[300px]" />
                        <SkeletonCard lines={0} className="p-6 min-h-[250px]" />
                    </div>
                    <div className="space-y-6">
                        <SkeletonCard lines={4} className="p-6" />
                        <SkeletonCard lines={6} className="p-6" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="vista-fija flex flex-col gap-3">
            {/* --- Header & Filters --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white leading-tight">Resumen General</h2>
                    <p className="text-slate-400 text-xs">Estado actual de tu negocio en tiempo real.</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/10">
                    <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="bg-transparent border-none text-white focus:outline-none text-sm py-1.5 pr-8 [&>option]:bg-slate-900 cursor-pointer"
                    >
                        <option value="week">Última Semana</option>
                        <option value="month">Este Mes</option>
                        <option value="3months">Últimos 3 Meses</option>
                        <option value="year">Este Año</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    {dateRange === 'custom' && (
                        <div className="flex flex-wrap items-center gap-1.5 pr-1">
                            <input
                                aria-label="Desde"
                                type="date"
                                value={customStartDraft}
                                max={maxDate}
                                onChange={(e) => setCustomStartDraft(e.target.value)}
                                className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-primary [color-scheme:dark]"
                            />
                            <span className="text-slate-500">–</span>
                            <input
                                aria-label="Hasta"
                                type="date"
                                value={customEndDraft}
                                max={maxDate}
                                onChange={(e) => setCustomEndDraft(e.target.value)}
                                className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-primary [color-scheme:dark]"
                            />
                            <button
                                type="button"
                                disabled={!rangoPersonalizadoValido}
                                onClick={() => {
                                    setCustomStart(customStartDraft)
                                    setCustomEnd(customEndDraft)
                                }}
                                className="px-3 py-1.5 rounded-lg bg-primary text-on-accent text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Aplicar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div role="tablist" aria-label="Secciones del dashboard" className="flex w-full overflow-x-auto gap-1 rounded-xl border border-white/10 bg-slate-900/50 p-1 shrink-0">
                <DashboardTab id="ventas" activeTab={activeTab} onSelect={setActiveTab} Icon={ChartNoAxesCombined}>Ventas</DashboardTab>
                <DashboardTab id="productos" activeTab={activeTab} onSelect={setActiveTab} Icon={Boxes}>Productos</DashboardTab>
                <DashboardTab id="gastos" activeTab={activeTab} onSelect={setActiveTab} Icon={Receipt}>Gastos</DashboardTab>
                <DashboardTab id="clientes" activeTab={activeTab} onSelect={setActiveTab} Icon={Users}>Clientes</DashboardTab>
            </div>

            {/* Bento lg (12 col): fila de cifras a su altura natural (auto) y dos
                filas iguales para gráficas y listas. Así una cifra no estira su
                tarjeta hasta dejar aire vacío. Bajo lg: 2 columnas, scroll normal. */}
            {activeTab === 'ventas' && (
            <div
                role="tabpanel"
                id="panel-ventas"
                aria-labelledby="tab-ventas"
                className="grid grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_1fr_1fr] gap-3 flex-1 lg:min-h-0"
            >
                <Kpi label="Ingresos Reales" value={formatCLP(metrics.totalCashFlow)} tag="En Caja" color="emerald" Icon={Wallet} className="lg:col-span-2" />
                <Kpi label="Ganancia Estimada" value={formatCLP(metrics.totalProfit)} tag={`Margen ${metrics.profitMargin.toFixed(1)}%`} color="purple" Icon={TrendingUp} className="lg:col-span-2" />
                <Kpi label="Ventas Fiadas" value={formatCLP(metrics.totalCreditSales)} tag="Por Cobrar" color="red" Icon={CreditCard} className="lg:col-span-2" />
                <Kpi label="Deuda Clientes" value={formatCLP(deudaClientes)} tag="Saldo Global" color="blue" Icon={User} className="lg:col-span-2" />

                {/* Operativo: tres cifras rápidas en una tira */}
                <Card className="col-span-2 lg:col-span-4 p-3 bg-slate-900/50 grid grid-cols-3 gap-2 items-center min-h-0">
                    <Mini Icon={ShoppingBag} label="Pedidos" value={metrics.totalOrders} />
                    <Mini Icon={DollarSign} label="Ticket Promedio" value={formatCLP(metrics.averageOrderValue)} />
                    <Mini Icon={AlertCircle} label="Stock Bajo" value={`${lowStockCount} prod.`} alerta={lowStockCount > 0} />
                </Card>

                {/* Tendencia */}
                <Card className="col-span-2 lg:col-span-8 p-4 bg-slate-900/50 flex flex-col min-h-0">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2 shrink-0">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Tendencia de Ventas
                    </h3>
                    <div className="h-56 lg:h-auto lg:flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartsData.salesOverTime} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={settings.primaryColor} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={settings.primaryColor} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                                <XAxis dataKey="date" stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} />
                                <YAxis stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={ct.tooltip}
                                    formatter={(value) => [formatCLP(value), 'Ventas']}
                                />
                                <Area type="monotone" dataKey="ventas" stroke={settings.primaryColor} fillOpacity={1} fill="url(#colorVentas)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Top productos */}
                <Card className="col-span-2 sm:col-span-1 lg:col-span-4 p-0 bg-slate-900/50 overflow-hidden flex flex-col min-h-0 h-72 lg:h-auto">
                    <div className="px-3 py-2 border-b border-white/10 bg-white/5 shrink-0">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            <Package className="w-4 h-4 text-purple-400" />
                            Productos Top
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-0">
                        {chartsData.topProducts.map((prod, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className={cn(
                                        "w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0",
                                        idx === 0 ? "bg-yellow-500/20 text-yellow-400" :
                                        idx === 1 ? "bg-slate-500/20 text-slate-300" :
                                        idx === 2 ? "bg-orange-700/20 text-orange-400" :
                                        "bg-slate-800 text-slate-500"
                                    )}>
                                        {idx + 1}
                                    </div>
                                    <span className="text-sm text-slate-200 truncate">{prod.name}</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded shrink-0">
                                    {prod.count}
                                </span>
                            </div>
                        ))}
                        {chartsData.topProducts.length === 0 && (
                            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                Sin datos
                            </div>
                        )}
                    </div>
                </Card>

                {/* Horarios */}
                <Card className="col-span-2 lg:col-span-8 p-4 bg-slate-900/50 flex flex-col min-h-0">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2 shrink-0">
                        <Clock className="w-4 h-4 text-orange-400" />
                        Horarios Punta
                    </h3>
                    <div className="h-48 lg:h-auto lg:flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartsData.hourlySales} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                                <XAxis dataKey="hour" stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={ct.tooltip}
                                    cursor={{ fill: ct.cursor }}
                                />
                                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Ventas" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Últimas ventas */}
                <Card className="col-span-2 sm:col-span-1 lg:col-span-4 p-0 bg-slate-900/50 overflow-hidden flex flex-col min-h-0 h-72 lg:h-auto">
                    <div className="px-3 py-2 border-b border-white/10 bg-white/5 shrink-0">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                            Últimas Ventas
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-white/5">
                                {sales.slice(0, 12).map((sale) => (
                                    <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-2.5">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-white font-medium">
                                                    {esAbono(sale) ? `Abono${sale.nombreCliente ? ` · ${sale.nombreCliente}` : ''}` : `${sale.productos.length} items`}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {sale.fechaVenta?.toDate().toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-2.5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-emerald-400">
                                                    {formatCLP(sale.totalVenta)}
                                                </span>
                                                <span className={cn(
                                                    "text-[10px] capitalize px-1.5 rounded-sm",
                                                    sale.tipoPago === 'fiado' ? "bg-red-500/20 text-red-400" : esAbono(sale) ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"
                                                )}>
                                                    {esAbono(sale) ? `abono · ${sale.tipoPago}` : sale.tipoPago}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sales.length === 0 && (
                                    <tr><td className="p-6 text-center text-slate-500 text-sm">Sin ventas</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            )}
            {activeTab === 'productos' && <ProductosTab productos={productos} ventasTop={chartsData.topProducts} />}
            {activeTab === 'gastos' && <GastosTab gastos={gastos} ingresos={metrics.totalCashFlow} />}
            {activeTab === 'clientes' && <ClientesTab clientes={clientes} loading={loadingClientes} rango={rango} />}
        </div>
    )
}

export default Dashboard
