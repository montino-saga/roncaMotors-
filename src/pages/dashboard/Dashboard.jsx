import { useState, useEffect } from 'react'
import { collection, getDocs, orderBy, query, limit, where, Timestamp } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { DollarSign, ShoppingBag, TrendingUp, CreditCard, Calendar, Percent, Clock } from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'

function Dashboard() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        totalProfit: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        profitMargin: 0
    })
    const [chartsData, setChartsData] = useState({
        salesOverTime: [],
        topProducts: [],
        paymentMethods: [],
        categorySales: [],
        hourlySales: [],
        categoryProfit: []
    })

    // Date Filter State
    const [dateRange, setDateRange] = useState('week') // week, month, 3months, 6months, year, custom
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

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
                } else if (dateRange === '6months') {
                    startDate.setMonth(startDate.getMonth() - 6)
                    startDate.setHours(0, 0, 0, 0)
                } else if (dateRange === 'year') {
                    startDate.setMonth(0, 1) // Jan 1st
                    startDate.setHours(0, 0, 0, 0)
                } else if (dateRange === 'custom' && customStart && customEnd) {
                    startDate = new Date(customStart + 'T00:00:00')
                    endDate = new Date(customEnd + 'T23:59:59')
                }

                // Firestore Query
                const q = query(
                    collection(db, 'sales'),
                    where('fechaVenta', '>=', Timestamp.fromDate(startDate)),
                    where('fechaVenta', '<=', Timestamp.fromDate(endDate)),
                    orderBy('fechaVenta', 'desc')
                )

                const querySnapshot = await getDocs(q)
                const salesData = []

                querySnapshot.forEach((doc) => {
                    salesData.push({ id: doc.id, ...doc.data() })
                })

                setSales(salesData)
                processMetrics(salesData)
            } catch (error) {
                console.error("Error fetching dashboard data:", error)
            } finally {
                setLoading(false)
            }
        }

        if (dateRange !== 'custom' || (customStart && customEnd)) {
            fetchData()
        }
    }, [dateRange, customStart, customEnd])

    const processMetrics = (data) => {
        // 1. KPI Metrics
        const totalRevenue = data.reduce((acc, curr) => acc + (curr.totalVenta || 0), 0)
        const totalProfit = data.reduce((acc, curr) => acc + (curr.totalGanancia || 0), 0)
        const totalOrders = data.length
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

        setMetrics({
            totalRevenue,
            totalProfit,
            totalOrders,
            averageOrderValue,
            profitMargin
        })

        // 2. Sales Over Time (Last 7 Days)
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - i)
            // Use local date string YYYY-MM-DD
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        }).reverse()

        const salesOverTime = last7Days.map(dateStr => {
            const daySales = data.filter(sale => {
                if (!sale.fechaVenta) return false
                const d = sale.fechaVenta.toDate()
                const year = d.getFullYear()
                const month = String(d.getMonth() + 1).padStart(2, '0')
                const day = String(d.getDate()).padStart(2, '0')
                const saleDateStr = `${year}-${month}-${day}`
                return saleDateStr === dateStr
            })

            // Create date object treating the string as local time
            const [y, m, d] = dateStr.split('-').map(Number)
            const localDate = new Date(y, m - 1, d)

            return {
                date: localDate.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }),
                ventas: daySales.reduce((acc, curr) => acc + (curr.totalVenta || 0), 0)
            }
        })

        // 3. Top Products
        const productSales = {}
        data.forEach(sale => {
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
            .slice(0, 5)

        // 4. Payment Methods
        const paymentMethodsCount = { efectivo: 0, tarjeta: 0 }
        data.forEach(sale => {
            const type = sale.tipoPago || 'efectivo'
            paymentMethodsCount[type] = (paymentMethodsCount[type] || 0) + 1
        })

        const paymentMethods = [
            { name: 'Efectivo', value: paymentMethodsCount.efectivo },
            { name: 'Tarjeta', value: paymentMethodsCount.tarjeta }
        ]

        // 5. Category Sales
        const categorySalesObj = {}
        data.forEach(sale => {
            sale.productos.forEach(prod => {
                const cat = prod.categoriaProducto || 'Sin Categoría'
                const price = Number(prod.precioVentaLocal ?? prod.precioProducto ?? 0)
                if (categorySalesObj[cat]) {
                    categorySalesObj[cat] += (price * prod.cantidad)
                } else {
                    categorySalesObj[cat] = (price * prod.cantidad)
                }
            })
        })

        const categorySales = Object.entries(categorySalesObj)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)

        setChartsData({
            salesOverTime,
            topProducts,
            paymentMethods,
            categorySales
        })
    }

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Dashboard Analytics</h2>
                    <p className="text-slate-400">Resumen general de tu negocio.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                        <option value="week" className="bg-slate-900">Semana</option>
                        <option value="month" className="bg-slate-900">Mes</option>
                        <option value="3months" className="bg-slate-900">Últimos 3 meses</option>
                        <option value="6months" className="bg-slate-900">Últimos 6 meses</option>
                        <option value="year" className="bg-slate-900">Año</option>
                        <option value="custom" className="bg-slate-900">Personalizado</option>
                    </select>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                            <span className="text-slate-500">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <Card className="p-6 border-l-4 border-l-blue-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-400 bg-white/5 px-2 py-1 rounded">Total</span>
                    </div>
                    <p className="text-slate-400 text-sm">Ingresos Totales</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{formatCLP(metrics.totalRevenue)}</h3>
                </Card>

                <Card className="p-6 border-l-4 border-l-emerald-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-400 bg-white/5 px-2 py-1 rounded">Neto</span>
                    </div>
                    <p className="text-slate-400 text-sm">Ganancia Total</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{formatCLP(metrics.totalProfit)}</h3>
                </Card>

                <Card className="p-6 border-l-4 border-l-purple-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-purple-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-400 bg-white/5 px-2 py-1 rounded">Ventas</span>
                    </div>
                    <p className="text-slate-400 text-sm">Total Pedidos</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{metrics.totalOrders}</h3>
                </Card>

                <Card className="p-6 border-l-4 border-l-orange-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-orange-500/10 rounded-lg">
                            <CreditCard className="w-6 h-6 text-orange-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-400 bg-white/5 px-2 py-1 rounded">Promedio</span>
                    </div>
                    <p className="text-slate-400 text-sm">Ticket Promedio</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{formatCLP(metrics.averageOrderValue)}</h3>
                </Card>

                <Card className="p-6 border-l-4 border-l-pink-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-pink-500/10 rounded-lg">
                            <Percent className="w-6 h-6 text-pink-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-400 bg-white/5 px-2 py-1 rounded">Eficiencia</span>
                    </div>
                    <p className="text-slate-400 text-sm">Margen de Ganancia</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{metrics.profitMargin.toFixed(1)}%</h3>
                </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Ventas de la Semana</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartsData.salesOverTime}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                    formatter={(value) => [formatCLP(value), 'Ventas']}
                                />
                                <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Horarios Punta (Pedidos por Hora)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartsData.hourlySales}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} interval={2} />
                                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 lg:col-span-1">
                    <h3 className="text-lg font-semibold text-white mb-6">Métodos de Pago</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartsData.paymentMethods}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartsData.paymentMethods.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-6 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-6">Rentabilidad por Categoría</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartsData.categoryProfit} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} tickFormatter={(value) => `$${value / 1000}k`} />
                                <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    formatter={(value) => [formatCLP(value), 'Ganancia']}
                                />
                                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Recent Sales Table */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Ventas Recientes</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="p-3 text-sm font-medium text-slate-400">Fecha</th>
                                <th className="p-3 text-sm font-medium text-slate-400">Productos</th>
                                <th className="p-3 text-sm font-medium text-slate-400">Pago</th>
                                <th className="p-3 text-sm font-medium text-slate-400 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sales.slice(0, 5).map((sale) => (
                                <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-sm text-slate-300">
                                        {sale.fechaVenta?.toDate().toLocaleDateString('es-CL')}
                                    </td>
                                    <td className="p-3 text-sm text-white">
                                        {sale.productos.length} items
                                    </td>
                                    <td className="p-3 text-sm">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full text-xs font-medium capitalize",
                                            sale.tipoPago === 'efectivo'
                                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                                : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                        )}>
                                            {sale.tipoPago}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm font-medium text-emerald-400 text-right">
                                        {formatCLP(sale.totalVenta)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

export default Dashboard
