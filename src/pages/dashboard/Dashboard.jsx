import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, getDocs, orderBy, query, where, Timestamp } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { useCatalogo } from '../../lib/catalogo'
import { Card } from '../../components/ui/Card'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts'
import { 
    DollarSign, ShoppingBag, TrendingUp, CreditCard, Calendar, 
    User, Wallet, AlertCircle, Clock, Package, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'
import { Skeleton, SkeletonCard, SkeletonKpis, SkeletonHeader } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { useTheme } from '../../context/ThemeContext'
import { useAppearance } from '../../context/AppearanceContext'
import { chartTheme } from '../../lib/chartTheme'

function Dashboard() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const mostrarSkeleton = useDelayedLoading(loading)
    const { settings } = useTheme()
    const ct = chartTheme(useAppearance().resolved)
    const { productos } = useCatalogo()
    // Bajo stock (< 5) sale del catálogo compartido: sin lecturas extra por rango.
    const lowStockCount = productos.filter(p => (p.cantidadProducto || 0) < 5).length
    
    const [metrics, setMetrics] = useState({
        totalCashFlow: 0,
        totalCreditSales: 0,
        totalPendingDebt: 0,
        totalProfit: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        profitMargin: 0,
    })

    const [chartsData, setChartsData] = useState({
        salesOverTime: [],
        topProducts: [],
        hourlySales: [],
    })

    // Date Filter State
    const [dateRange, setDateRange] = usePersistedState('roncamotors_dashboard_range', 'week')
    const [customStart, setCustomStart] = usePersistedState('roncamotors_dashboard_desde', '')
    const [customEnd, setCustomEnd] = usePersistedState('roncamotors_dashboard_hasta', '')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                let startDate = new Date()
                let endDate = new Date()
                endDate.setHours(23, 59, 59, 999)

                // Calculate Date Range
                if (dateRange === 'week') {
                    startDate.setDate(startDate.getDate() - 7)
                    startDate.setHours(0, 0, 0, 0)
                } else if (dateRange === 'month') {
                    startDate.setDate(1)
                    startDate.setHours(0, 0, 0, 0)
                } else if (dateRange === '3months') {
                    startDate.setMonth(startDate.getMonth() - 3)
                    startDate.setHours(0, 0, 0, 0)
                } else if (dateRange === 'year') {
                    startDate.setMonth(0, 1)
                    startDate.setHours(0, 0, 0, 0)
                } else if (dateRange === 'custom' && customStart && customEnd) {
                    startDate = new Date(customStart + 'T00:00:00')
                    endDate = new Date(customEnd + 'T23:59:59')
                }

                // 1. Fetch Sales
                const qSales = query(
                    collection(db, 'sales'),
                    where('fechaVenta', '>=', Timestamp.fromDate(startDate)),
                    where('fechaVenta', '<=', Timestamp.fromDate(endDate)),
                    orderBy('fechaVenta', 'desc')
                )
                const salesSnapshot = await getDocs(qSales)
                const salesData = []
                salesSnapshot.forEach((doc) => {
                    salesData.push({ id: doc.id, ...doc.data() })
                })

                // 2. Fetch Clients (Snapshot)
                const qClients = query(collection(db, 'clients'))
                const clientsSnapshot = await getDocs(qClients)
                const clientsData = []
                clientsSnapshot.forEach((doc) => {
                    clientsData.push({ id: doc.id, ...doc.data() })
                })

                setSales(salesData)
                processMetrics(salesData, clientsData)
            } catch (error) {
                console.error("Error fetching dashboard data:", error)
                toast.error('No se pudieron cargar los datos del dashboard')
            } finally {
                setLoading(false)
            }
        }

        if (dateRange !== 'custom' || (customStart && customEnd)) {
            fetchData()
        }
    }, [dateRange, customStart, customEnd])

    const processMetrics = (salesData, clientsData) => {
        // --- Financial Metrics ---
        const totalCashFlow = salesData.reduce((acc, curr) => {
            if (curr.tipoPago === 'efectivo' || curr.tipoPago === 'tarjeta' || curr.tipoPago === 'abono' || curr.isAbono) {
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

        const totalPendingDebt = clientsData.reduce((acc, curr) => acc + (curr.currentDebt || 0), 0)

        const totalProfit = salesData.reduce((acc, curr) => {
            if (curr.tipoPago === 'abono' || curr.isAbono) return acc
            return acc + (curr.totalGanancia || 0)
        }, 0)

        const totalOrders = salesData.filter(s => s.tipoPago !== 'abono' && !s.isAbono).length
        const averageOrderValue = totalOrders > 0 ? (totalCashFlow + totalCreditSales) / totalOrders : 0
        const totalRevenueVolume = totalCashFlow + totalCreditSales
        const profitMargin = totalRevenueVolume > 0 ? (totalProfit / totalRevenueVolume) * 100 : 0
        
        setMetrics({
            totalCashFlow,
            totalCreditSales,
            totalPendingDebt,
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
            if (sale.tipoPago === 'abono' || sale.isAbono) return

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
            if (!sale.fechaVenta) return
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
            if (sale.tipoPago === 'abono' || sale.isAbono) return
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
        <div className="flex flex-col gap-3 lg:h-[calc(100dvh-2rem)] lg:min-h-0">
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
                        <option value="3months">3 Meses</option>
                        <option value="year">Este Año</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-1.5 pr-1">
                            <input
                                type="date"
                                value={customStart}
                                max={customEnd || undefined}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-primary [color-scheme:dark]"
                            />
                            <span className="text-slate-500">–</span>
                            <input
                                type="date"
                                value={customEnd}
                                min={customStart || undefined}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-primary [color-scheme:dark]"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Bento lg (12 col): fila de cifras a su altura natural (auto) y dos
                filas iguales para gráficas y listas. Así una cifra no estira su
                tarjeta hasta dejar aire vacío. Bajo lg: 2 columnas, scroll normal. */}
            <div className="grid grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_1fr_1fr] gap-3 flex-1 lg:min-h-0">
                <Kpi label="Ingresos Reales" value={formatCLP(metrics.totalCashFlow)} tag="En Caja" color="emerald" Icon={Wallet} className="lg:col-span-2" />
                <Kpi label="Ganancia Estimada" value={formatCLP(metrics.totalProfit)} tag={`Margen ${metrics.profitMargin.toFixed(1)}%`} color="purple" Icon={TrendingUp} className="lg:col-span-2" />
                <Kpi label="Ventas Fiadas" value={formatCLP(metrics.totalCreditSales)} tag="Por Cobrar" color="red" Icon={CreditCard} className="lg:col-span-2" />
                <Kpi label="Deuda Clientes" value={formatCLP(metrics.totalPendingDebt)} tag="Saldo Global" color="blue" Icon={User} className="lg:col-span-2" />

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
                                                    {sale.productos.length} items
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
                                                    sale.tipoPago === 'fiado' ? "bg-red-500/20 text-red-400" : "text-slate-400"
                                                )}>
                                                    {sale.tipoPago}
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
        </div>
    )
}

const KPI_COLORES = {
    emerald: { borde: "border-l-emerald-500", icono: "text-emerald-500", tag: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    purple:  { borde: "border-l-purple-500",  icono: "text-purple-500",  tag: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    red:     { borde: "border-l-red-500",     icono: "text-red-500",     tag: "bg-red-500/10 text-red-400 border-red-500/20" },
    blue:    { borde: "border-l-blue-500",    icono: "text-blue-500",    tag: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
}

function Kpi({ label, value, tag, color, Icon, className }) {
    const c = KPI_COLORES[color]
    return (
        <Card className={cn(
            "px-3.5 py-3 border-l-4 bg-slate-900/50 relative overflow-hidden group hover:bg-slate-900/80 transition-all",
            "flex flex-col justify-center min-h-0 min-w-0 gap-0.5", c.borde, className
        )}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider truncate">{label}</p>
                <Icon className={cn("w-4 h-4 shrink-0 opacity-70", c.icono)} />
            </div>
            <h3 className="text-xl font-bold text-white truncate leading-tight">{value}</h3>
            <span className={cn("text-[10px] px-1.5 py-px rounded-full border self-start", c.tag)}>{tag}</span>
        </Card>
    )
}

function Mini({ Icon, label, value, alerta }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("p-1.5 rounded-lg shrink-0", alerta ? "bg-orange-500/20 text-orange-400" : "bg-slate-800 text-slate-300")}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-slate-400 truncate">{label}</p>
                <p className={cn("text-sm font-bold truncate leading-tight", alerta ? "text-orange-400" : "text-white")}>{value}</p>
            </div>
        </div>
    )
}

export default Dashboard
