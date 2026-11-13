import { useMemo } from 'react'
import { Card } from '../../components/ui/Card'
import { formatCLP } from '../../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, CreditCard } from 'lucide-react'
import { useAppearance } from '../../context/AppearanceContext'
import { chartTheme } from '../../lib/chartTheme'
import { esAbono, esIngresoReal } from '../../lib/ventas'

function CustomTooltip({ active, payload, label }) {
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

export function SalesAnalytics({ sales, dateRange }) {
    const ct = chartTheme(useAppearance().resolved)

    // 1. Calcular KPIs
    const kpis = useMemo(() => {
        const pedidos = sales.filter(sale => !esAbono(sale))
        const totalSales = pedidos.reduce((acc, sale) => acc + (sale.totalVenta || 0), 0)
        const totalProfit = pedidos.reduce((acc, sale) => acc + (sale.totalGanancia || 0), 0)
        const totalCount = pedidos.length
        const averageTicket = totalCount > 0 ? totalSales / totalCount : 0
        const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

        const cashSales = pedidos.filter(s => s.tipoPago === 'efectivo')
        const cardSales = pedidos.filter(s => s.tipoPago === 'tarjeta')
        const creditSales = pedidos.filter(s => s.tipoPago === 'fiado')
        const suma = (arr) => arr.reduce((acc, s) => acc + (s.totalVenta || 0), 0)
        const creditTotal = suma(creditSales)
        const collectedTotal = sales.filter(esIngresoReal).reduce((acc, s) => acc + (s.totalVenta || 0), 0)

        return {
            totalSales,
            totalProfit,
            totalCount,
            averageTicket,
            profitMargin,
            cashCount: cashSales.length,
            cardCount: cardSales.length,
            creditCount: creditSales.length,
            cashTotal: suma(cashSales),
            cardTotal: suma(cardSales),
            creditTotal,
            // Incluye abonos, igual que "Ingresos Reales" del dashboard.
            collectedTotal,
        }
    }, [sales])

    
    // Improved Chart Data Logic with Sorting
    const processedChartData = useMemo(() => {
         if (sales.length === 0) return []
         
         const grouped = {}
         
         sales.forEach(sale => {
             if (esAbono(sale)) return
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
                    <p className="text-xs text-emerald-400/60 tabular-nums">
                        cobrado {formatCLP(kpis.collectedTotal)} · fiado {formatCLP(kpis.creditTotal)}
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
                                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    stroke={ct.axis} 
                                    tick={{fontSize: 12}}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    stroke={ct.axis} 
                                    tick={{fontSize: 12}}
                                    tickFormatter={(value) => `$${value/1000}k`}
                                    tickLine={false}
                                    axisLine={false}
                                    dx={-10}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: ct.cursorStroke }} />
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
                                { name: 'Tarjeta', value: kpis.cardTotal, count: kpis.cardCount, fill: '#a855f7' },
                                { name: 'Fiado', value: kpis.creditTotal, count: kpis.creditCount, fill: '#f59e0b' }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                                <XAxis dataKey="name" stroke={ct.axis} axisLine={false} tickLine={false} />
                                <YAxis stroke={ct.axis} tickFormatter={(value) => `$${value/1000}k`} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{ fill: ct.cursor }}
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
