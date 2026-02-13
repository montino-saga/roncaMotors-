import { useMemo } from 'react'
import { Card } from '../../components/ui/Card'
import { formatCLP } from '../../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, CreditCard } from 'lucide-react'

export function SalesAnalytics({ sales, dateRange }) {
    
    // 1. Calcular KPIs
    const kpis = useMemo(() => {
        const totalSales = sales.reduce((acc, sale) => acc + (sale.totalVenta || 0), 0)
        const totalProfit = sales.reduce((acc, sale) => acc + (sale.totalGanancia || 0), 0)
        const totalCount = sales.length
        const averageTicket = totalCount > 0 ? totalSales / totalCount : 0
        const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

        // Calcular ticket promedio efectivo vs tarjeta
        const cashSales = sales.filter(s => s.tipoPago === 'efectivo')
        const cardSales = sales.filter(s => s.tipoPago === 'tarjeta')
        
        return {
            totalSales,
            totalProfit,
            totalCount,
            averageTicket,
            profitMargin,
            cashCount: cashSales.length,
            cardCount: cardSales.length,
            cashTotal: cashSales.reduce((acc, s) => acc + (s.totalVenta || 0), 0),
            cardTotal: cardSales.reduce((acc, s) => acc + (s.totalVenta || 0), 0),
        }
    }, [sales])

    // 2. Preparar datos para gráficos
    const chartData = useMemo(() => {
        if (sales.length === 0) return []

        const dataMap = {}

        sales.forEach(sale => {
            let key
            const date = sale.fechaVenta.toDate() // Firestore Timestamp

            if (dateRange === 'day') {
                // Agrupar por hora (00:00 - 23:00)
                const hour = date.getHours()
                key = `${hour.toString().padStart(2, '0')}:00`
            } else {
                // Agrupar por día (YYYY-MM-DD)
                // Usar locale date string para agrupar correctamente
                key = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
            }

            if (!dataMap[key]) {
                dataMap[key] = { name: key, ventas: 0, ganancia: 0, cantidad: 0 }
            }

            dataMap[key].ventas += (sale.totalVenta || 0)
            dataMap[key].ganancia += (sale.totalGanancia || 0)
            dataMap[key].cantidad += 1
        })

        // Ordenar datos
        return Object.values(dataMap).sort((a, b) => {
            if (dateRange === 'day') {
                return a.name.localeCompare(b.name)
            } else {
                // Para fechas DD/MM, necesitamos un sort un poco más inteligente o asumir que vienen en orden si iteramos fechas
                // Simple string compare works for DD/MM within same month/year usually, but let's rely on standard sort for now
                // Actually, if spanning years, DD/MM might not sort correctly numerically.
                // However, for visualization simple sort is often enough or we can use the timestamp logic.
                // Let's stick to simple sort for simplicity as keys are unique.
                return 0 // Recharts might just plot in order of array. Object.values order isn't guaranteed.
                // Better to sort by the original timestamp min value.
                // Re-doing the map to keep a sortable value.
            }
        }).sort((a, b) => {
             // Basic alphanumeric sort for keys like "09:00", "10:00" or "01/02", "02/02"
             // Note: DD/MM format sorts by day first, which is correct for within-month.
             // For cross-month "28/02" vs "01/03", string sort "01/03" comes before "28/02" which is WRONG.
             // We need to fix this for date ranges > 1 month.
             // BUT for now let's leave it simple, or user can fix if they notice issues with long ranges.
             // Ideally we use a real Date object for sorting.
             return dateRange === 'day' ? a.name.localeCompare(b.name) : 0 // Rely on insert order if possible or fix later
        })
        
        // Correct sorting strategy:
        // We should sort by the underlying date value.
        // Let's re-process sales sorted by date first, then the aggregation will be naturally ordered if we iterate chronologically? 
        // No, aggregation into map loses order.
        // Let's just sort the final array.
        // For day range: "HH:00" sorts correctly.
        // For other ranges: We need to parse "DD/MM" back or store a sortable key.
        
    }, [sales, dateRange])
    
    // Improved Chart Data Logic with Sorting
    const processedChartData = useMemo(() => {
         if (sales.length === 0) return []
         
         const grouped = {}
         
         sales.forEach(sale => {
             const date = sale.fechaVenta.toDate()
             let key, sortKey
             
             if (dateRange === 'day') {
                 const hour = date.getHours()
                 key = `${hour.toString().padStart(2, '0')}:00`
                 sortKey = hour
             } else {
                 const day = date.getDate().toString().padStart(2, '0')
                 const month = (date.getMonth() + 1).toString().padStart(2, '0')
                 key = `${day}/${month}`
                 // Sort by timestamp (midnight of that day)
                 const d = new Date(date)
                 d.setHours(0,0,0,0)
                 sortKey = d.getTime()
             }
             
             if (!grouped[key]) {
                 grouped[key] = { name: key, sortKey, ventas: 0, ganancia: 0, count: 0 }
             }
             grouped[key].ventas += (sale.totalVenta || 0)
             grouped[key].ganancia += (sale.totalGanancia || 0)
             grouped[key].count += 1
         })
         
         return Object.values(grouped).sort((a, b) => a.sortKey - b.sortKey)
    }, [sales, dateRange])

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-xl">
                    <p className="text-white font-medium mb-1">{label}</p>
                    <p className="text-emerald-400 text-sm">
                        Ventas: {formatCLP(payload[0].value)}
                    </p>
                    {payload[1] && (
                        <p className="text-cyan-400 text-sm">
                            Ganancia: {formatCLP(payload[1].value)}
                        </p>
                    )}
                    <p className="text-slate-400 text-xs mt-1">
                        {payload[0].payload.count} transacciones
                    </p>
                </div>
            )
        }
        return null
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-emerald-400/80">Ventas Totales</p>
                            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{formatCLP(kpis.totalSales)}</h3>
                        </div>
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-xs text-emerald-400/60 mt-2">
                        {kpis.totalCount} transacciones
                    </p>
                </Card>

                <Card className="p-4 bg-cyan-500/10 border-cyan-500/20">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-cyan-400/80">Ganancia Neta</p>
                            <h3 className="text-2xl font-bold text-cyan-400 mt-1">{formatCLP(kpis.totalProfit)}</h3>
                        </div>
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-cyan-400" />
                        </div>
                    </div>
                    <p className="text-xs text-cyan-400/60 mt-2">
                        Margen: {kpis.profitMargin.toFixed(1)}%
                    </p>
                </Card>

                <Card className="p-4 bg-purple-500/10 border-purple-500/20">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-purple-400/80">Ticket Promedio</p>
                            <h3 className="text-2xl font-bold text-purple-400 mt-1">{formatCLP(kpis.averageTicket)}</h3>
                        </div>
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <ShoppingBag className="w-5 h-5 text-purple-400" />
                        </div>
                    </div>
                     <div className="flex gap-2 mt-2">
                         <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            Efectivo: {((kpis.cashCount / kpis.totalCount) * 100 || 0).toFixed(0)}%
                         </span>
                         <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            Tarjeta: {((kpis.cardCount / kpis.totalCount) * 100 || 0).toFixed(0)}%
                         </span>
                     </div>
                </Card>
                
                 <Card className="p-4 bg-orange-500/10 border-orange-500/20">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-orange-400/80">Costo Estimado</p>
                            <h3 className="text-2xl font-bold text-orange-400 mt-1">{formatCLP(kpis.totalSales - kpis.totalProfit)}</h3>
                        </div>
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <TrendingDown className="w-5 h-5 text-orange-400" />
                        </div>
                    </div>
                    <p className="text-xs text-orange-400/60 mt-2">
                        Costo de Mercadería
                    </p>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6 flex flex-col h-[400px]">
                    <h3 className="text-lg font-medium text-white mb-6">Tendencia de Ventas</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={processedChartData}>
                                <defs>
                                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#94a3b8" 
                                    tick={{fontSize: 12}}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    stroke="#94a3b8" 
                                    tick={{fontSize: 12}}
                                    tickFormatter={(value) => `$${value/1000}k`}
                                    tickLine={false}
                                    axisLine={false}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffffff20' }} />
                                <Area 
                                    type="monotone" 
                                    dataKey="ventas" 
                                    stroke="#10b981" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorVentas)" 
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="ganancia" 
                                    stroke="#06b6d4" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorGanancia)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Payment Distribution (Simple Bar) */}
                <Card className="p-6 flex flex-col h-[400px]">
                     <h3 className="text-lg font-medium text-white mb-6">Métodos de Pago</h3>
                     <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Efectivo', value: kpis.cashTotal, count: kpis.cashCount, fill: '#10b981' },
                                { name: 'Tarjeta', value: kpis.cardTotal, count: kpis.cardCount, fill: '#a855f7' }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" axisLine={false} tickLine={false} />
                                <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${value/1000}k`} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{fill: '#ffffff10'}}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 border border-white/10 p-2 rounded shadow-xl">
                                                    <p className="text-white">{payload[0].payload.name}</p>
                                                    <p className="font-bold" style={{color: payload[0].payload.fill}}>
                                                        {formatCLP(payload[0].value)}
                                                    </p>
                                                    <p className="text-xs text-slate-400">{payload[0].payload.count} ventas</p>
                                                </div>
                                            )
                                        }
                                        return null
                                    }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                </Card>
            </div>
        </div>
    )
}