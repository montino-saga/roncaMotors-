import { useState, useEffect } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, getDocs, orderBy, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Search, Eye, Calendar, DollarSign, CreditCard, Banknote, Filter, Save, X } from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'

function SalesHistory() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedSale, setSelectedSale] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDate, setSelectedDate] = usePersistedState('montino_sales_date', () => {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    })

    // Payment Filter & Edit State
    const [paymentFilter, setPaymentFilter] = usePersistedState('montino_sales_filter', 'todos')
    const [isEditingPayment, setIsEditingPayment] = useState(false)
    const [newPaymentMethod, setNewPaymentMethod] = useState('')


    const getLocalPrice = (prod) => Number(prod?.precioVentaLocal ?? prod?.precioProducto ?? 0)

    // Format date
    const formatDate = (timestamp) => {
        if (!timestamp) return ''
        return timestamp.toDate().toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true)
            try {
                // Parse selectedDate (YYYY-MM-DD) as local time
                const [year, month, day] = selectedDate.split('-').map(Number)

                const start = new Date(year, month - 1, day, 0, 0, 0, 0)
                const end = new Date(year, month - 1, day, 23, 59, 59, 999)

                const q = query(
                    collection(db, 'sales'),
                    where('fechaVenta', '>=', start),
                    where('fechaVenta', '<=', end),
                    orderBy('fechaVenta', 'desc')
                )

                const querySnapshot = await getDocs(q)
                const salesData = []

                querySnapshot.forEach((doc) => {
                    salesData.push({ id: doc.id, ...doc.data() })
                })

                setSales(salesData)
            } catch (error) {
                console.error("Error fetching sales history:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchSales()
    }, [selectedDate])

    const handleViewDetails = (sale) => {
        setSelectedSale(sale)
        setNewPaymentMethod(sale.tipoPago)
        setIsEditingPayment(false)
        setIsModalOpen(true)
    }

    const handleUpdatePayment = async () => {
        if (!selectedSale || !newPaymentMethod) return

        try {
            const saleRef = doc(db, 'sales', selectedSale.id)
            await updateDoc(saleRef, {
                tipoPago: newPaymentMethod
            })

            // Update local state
            const updatedSales = sales.map(s =>
                s.id === selectedSale.id ? { ...s, tipoPago: newPaymentMethod } : s
            )
            setSales(updatedSales)
            setSelectedSale({ ...selectedSale, tipoPago: newPaymentMethod })
            setIsEditingPayment(false)
            toast.success('Método de pago actualizado')
        } catch (error) {
            console.error('Error updating payment method:', error)
            toast.error('Error al actualizar método de pago')
        }
    }

    const filteredSales = sales.filter(sale => {
        if (paymentFilter === 'todos') return true
        return sale.tipoPago === paymentFilter
    })

    const totalSalesAmount = filteredSales.reduce((acc, sale) => acc + (sale.totalVenta || 0), 0)
    const totalSalesCount = filteredSales.length

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-40" />
                    </div>
                </div>
                <Card className="p-0 overflow-hidden">
                    <div className="p-4 space-y-4">
                        {[...Array(8)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full rounded-xl" />
                        ))}
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Historial de Ventas</h2>
                    <p className="text-slate-400 text-sm">Registro de transacciones del día.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Stats Card */}
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                        <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                            <div className="bg-emerald-500/20 p-1.5 rounded-lg text-emerald-400">
                                <DollarSign className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider leading-none">Total</p>
                                <p className="text-lg font-bold text-emerald-400 leading-tight">
                                    {formatCLP(totalSalesAmount)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
                                <Search className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider leading-none">Ventas</p>
                                <p className="text-lg font-bold text-white leading-tight">
                                    {totalSalesCount}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 h-10">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none text-sm [&>option]:bg-slate-900"
                            >
                                <option value="todos">Todos</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 h-10">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none text-sm [&::-webkit-calendar-picker-indicator]:invert"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Card className="overflow-hidden p-0 border-white/10">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-4 py-3 font-medium text-slate-300 text-sm">Fecha</th>
                                <th className="px-4 py-3 font-medium text-slate-300 text-sm hidden sm:table-cell">ID</th>
                                <th className="px-4 py-3 font-medium text-slate-300 text-sm">Items</th>
                                <th className="px-4 py-3 font-medium text-slate-300 text-sm">Pago</th>
                                <th className="px-4 py-3 font-medium text-slate-300 text-sm text-right">Total</th>
                                <th className="px-4 py-3 font-medium text-slate-300 text-sm text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredSales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-4 py-3 text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-500" />
                                            {formatDate(sale.fechaVenta)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden sm:table-cell">
                                        {sale.id.slice(0, 8)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                        {sale.productos.length} items
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize",
                                            sale.tipoPago === 'efectivo'
                                                ? "bg-primary/10 text-primary border-primary/20"
                                                : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                        )}>
                                            {sale.tipoPago === 'efectivo' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                                            {sale.tipoPago}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-bold text-emerald-400 text-right">
                                        {formatCLP(sale.totalVenta)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleViewDetails(sale)}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                            title="Ver Detalle"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Sale Details Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Detalle de Venta #${selectedSale?.id.slice(0, 8)}`}
                className="max-w-2xl"
            >
                {selectedSale && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                <p className="text-slate-400 mb-1">Fecha</p>
                                <p className="text-white font-medium">{formatDate(selectedSale.fechaVenta)}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-slate-400">Método de Pago</p>
                                    {!isEditingPayment ? (
                                        <button
                                            onClick={() => setIsEditingPayment(true)}
                                            className="text-xs text-primary hover:text-primary/80"
                                        >
                                            Editar
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleUpdatePayment}
                                                className="text-emerald-400 hover:text-emerald-300"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setIsEditingPayment(false)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditingPayment ? (
                                    <select
                                        value={newPaymentMethod}
                                        onChange={(e) => setNewPaymentMethod(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-primary"
                                    >
                                        <option value="efectivo">Efectivo</option>
                                        <option value="tarjeta">Tarjeta</option>
                                    </select>
                                ) : (
                                    <p className="text-white font-medium capitalize">{selectedSale.tipoPago}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-slate-300 mb-3">Productos</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {selectedSale.productos.map((prod, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div>
                                            <p className="text-white font-medium">{prod.nombreProducto}</p>
                                            <p className="text-xs text-slate-400">
                                                {prod.cantidad} x {formatCLP(getLocalPrice(prod))}
                                            </p>
                                        </div>
                                        <p className="text-white font-medium">
                                            {formatCLP(prod.cantidad * getLocalPrice(prod))}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                            <p className="text-slate-400">Total Pagado</p>
                            <p className="text-2xl font-bold text-emerald-400">{formatCLP(selectedSale.totalVenta)}</p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default SalesHistory
