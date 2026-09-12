import { useState, useEffect } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, getDoc, getDocs, orderBy, query, where, doc, writeBatch, increment, Timestamp } from 'firebase/firestore'
import { refProductoPorCodigo, useCatalogo } from '../../lib/catalogo'
import { descuentoItemsVenta, ventaConDescuento } from '../../lib/descuentos'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Search, Eye, Calendar, DollarSign, CreditCard, Banknote, Filter, Save, X, Trash2, AlertTriangle, ChevronDown, BarChart3, List, User, Pencil, Percent } from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { SalesAnalytics } from './SalesAnalytics'

function SalesHistory() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedSale, setSelectedSale] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    
    // View Mode State
    const [viewMode, setViewMode] = usePersistedState('roncamotors_sales_view', 'list') // 'list' | 'analytics'

    // Date Range State
    const [dateRange, setDateRange] = useState('day') // day, week, month, 3months, 6months, year
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    })

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('')
    const [paymentFilter, setPaymentFilter] = usePersistedState('roncamotors_sales_filter', 'todos')
    
    // Edit Payment State
    const [isEditingPayment, setIsEditingPayment] = useState(false)
    const [newPaymentMethod, setNewPaymentMethod] = useState('')

    // Delete Sale Modal State
    const [showDeleteSaleModal, setShowDeleteSaleModal] = useState(false)
    const [saleToDeleteId, setSaleToDeleteId] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Return Product Modal State
    const [showReturnProductModal, setShowReturnProductModal] = useState(false)
    const [productToReturn, setProductToReturn] = useState(null)
    const [quantityToReturn, setQuantityToReturn] = useState(1)


    const getLocalPrice = (prod) => Number(prod?.precioVentaLocal ?? prod?.precioProducto ?? 0)
    // Calienta el catálogo compartido: así restaurar stock no consulta al servidor.
    useCatalogo()

    const descuentoItems = descuentoItemsVenta
    const tieneDescuento = ventaConDescuento

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
                
                let start = new Date(year, month - 1, day, 0, 0, 0, 0)
                let end = new Date(year, month - 1, day, 23, 59, 59, 999)

                // Adjust start date based on range
                if (dateRange !== 'day') {
                    // Reset start to beginning of day
                    start = new Date(year, month - 1, day, 0, 0, 0, 0)
                    
                    const anchorDate = new Date(year, month - 1, day, 23, 59, 59, 999)
                    end = anchorDate
                    
                    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
                    
                    switch (dateRange) {
                        case 'week':
                            startDate.setDate(startDate.getDate() - 6) // 7 days total including today
                            break
                        case 'month':
                            startDate.setMonth(startDate.getMonth() - 1)
                            break
                        case '3months':
                            startDate.setMonth(startDate.getMonth() - 3)
                            break
                        case '6months':
                            startDate.setMonth(startDate.getMonth() - 6)
                            break
                        case 'year':
                            startDate.setFullYear(startDate.getFullYear() - 1)
                            break
                    }
                    start = startDate
                }

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
    }, [selectedDate, dateRange])

    const handleViewDetails = (sale) => {
        setSelectedSale(sale)
        setNewPaymentMethod(sale.tipoPago)
        setIsEditingPayment(false)
        setIsModalOpen(true)
    }

    // Deja la deuda del cliente y su historial coherentes al sacar una venta
    // del fiado (borrada o pagada de otra forma).
    const revertirFiado = async (batch, sale) => {
        if (sale.tipoPago !== 'fiado' || !sale.idCliente) return
        const clientRef = doc(db, 'clients', sale.idCliente)
        // El cliente puede haberse borrado y sus ventas siguen existiendo: update() a un doc ausente rompe el batch.
        if ((await getDoc(clientRef)).exists()) {
            batch.update(clientRef, {
                currentDebt: increment(-(sale.totalVenta || 0)),
                lastUpdated: Timestamp.now()
            })
        }
        const movs = await getDocs(query(
            collection(db, `clients/${sale.idCliente}/movements`),
            where('saleId', '==', sale.id)
        ))
        movs.forEach(m => { if (m.data().type === 'purchase') batch.delete(m.ref) })
    }

    const registrarFiado = async (batch, sale) => {
        const clientRef = doc(db, 'clients', sale.idCliente)
        if (!(await getDoc(clientRef)).exists()) throw new Error('cliente inexistente')
        batch.update(clientRef, {
            currentDebt: increment(sale.totalVenta || 0),
            lastUpdated: Timestamp.now()
        })
        const movementRef = doc(collection(db, `clients/${sale.idCliente}/movements`))
        batch.set(movementRef, {
            type: 'purchase',
            amount: sale.totalVenta || 0,
            date: Timestamp.now(),
            products: sale.productos.map(p => ({
                idProducto: p.idProducto,
                nombreProducto: p.nombreProducto,
                cantidad: p.cantidad,
                precio: getLocalPrice(p)
            })),
            descuentoTotal: sale.descuentoTotal || 0,
            saleId: sale.id
        })
    }

    const handleUpdatePayment = async () => {
        if (!selectedSale || !newPaymentMethod || newPaymentMethod === selectedSale.tipoPago) {
            setIsEditingPayment(false)
            return
        }
        if (newPaymentMethod === 'fiado' && !selectedSale.idCliente) {
            toast.error('La venta no tiene cliente: no se puede pasar a fiado')
            return
        }

        try {
            const batch = writeBatch(db)
            const saleRef = doc(db, 'sales', selectedSale.id)
            batch.update(saleRef, { tipoPago: newPaymentMethod, isFiado: newPaymentMethod === 'fiado' })

            if (selectedSale.tipoPago === 'fiado') await revertirFiado(batch, selectedSale)
            else if (newPaymentMethod === 'fiado') await registrarFiado(batch, selectedSale)

            await batch.commit()

            const updatedSale = { ...selectedSale, tipoPago: newPaymentMethod, isFiado: newPaymentMethod === 'fiado' }
            setSales(sales.map(s => s.id === selectedSale.id ? updatedSale : s))
            setSelectedSale(updatedSale)
            setIsEditingPayment(false)
            toast.success('Método de pago actualizado')
        } catch (error) {
            console.error('Error updating payment method:', error)
            toast.error('Error al actualizar método de pago')
        }
    }

    // --- Delete Sale Logic ---
    const confirmDeleteSale = (saleId) => {
        setSaleToDeleteId(saleId)
        setShowDeleteSaleModal(true)
    }

    const executeDeleteSale = async () => {
        if (!saleToDeleteId) return

        setIsDeleting(true)
        const saleId = saleToDeleteId
        const saleToDelete = sales.find(s => s.id === saleId)
        
        if (!saleToDelete) {
            setIsDeleting(false)
            setShowDeleteSaleModal(false)
            return
        }

        try {
            const batch = writeBatch(db)

            // 1. Restaurar stock
            // increment(): suma sobre el stock real del servidor, no sobre una lectura previa.
            for (const prod of saleToDelete.productos) {
                const productRef = await refProductoPorCodigo(prod.idProducto)
                if (productRef) batch.update(productRef, { cantidadProducto: increment(prod.cantidad) })
            }

            // 2. Si era fiado, descontar deuda y borrar el movimiento del cliente
            await revertirFiado(batch, saleToDelete)

            // 3. Eliminar venta
            const saleRef = doc(db, 'sales', saleId)
            batch.delete(saleRef)

            await batch.commit()

            // Update local state
            setSales(sales.filter(s => s.id !== saleId))
            if (selectedSale?.id === saleId) {
                setIsModalOpen(false)
                setSelectedSale(null)
            }
            toast.success('Venta eliminada y stock restaurado')
        } catch (error) {
            console.error('Error deleting sale:', error)
            toast.error('Error al eliminar la venta')
        } finally {
            setIsDeleting(false)
            setShowDeleteSaleModal(false)
            setSaleToDeleteId(null)
        }
    }

    // --- Return Product Logic ---
    const initiateReturnProduct = (index) => {
        if (!selectedSale) return
        const product = selectedSale.productos[index]
        setProductToReturn({ 
            index, 
            product, 
            maxQuantity: product.cantidad 
        })
        setQuantityToReturn(1) // Default to returning 1
        setShowReturnProductModal(true)
    }

    const executeReturnProduct = async () => {
        if (!selectedSale || !productToReturn) return

        const qty = Number(quantityToReturn)
        if (qty <= 0 || qty > productToReturn.maxQuantity) {
            toast.error('Cantidad inválida')
            return
        }

        setIsDeleting(true)
        const productIndex = productToReturn.index
        const productToRemove = selectedSale.productos[productIndex]
        
        try {
            const batch = writeBatch(db)

            // 1. Restaurar stock (cantidad devuelta)
            const productRef = await refProductoPorCodigo(productToRemove.idProducto)
            if (productRef) batch.update(productRef, { cantidadProducto: increment(qty) })

            // 2. Actualizar venta
            const newProducts = [...selectedSale.productos]
            
            if (qty === productToReturn.maxQuantity) {
                // Eliminar producto completo si se devuelve todo
                newProducts.splice(productIndex, 1)
            } else {
                // Reducir cantidad
                newProducts[productIndex] = {
                    ...productToRemove,
                    cantidad: productToRemove.cantidad - qty
                }
            }

            // Si no quedan productos, eliminamos la venta completa
            if (newProducts.length === 0) {
                await revertirFiado(batch, selectedSale)
                const saleRef = doc(db, 'sales', selectedSale.id)
                batch.delete(saleRef)
                
                await batch.commit()
                
                setSales(sales.filter(s => s.id !== selectedSale.id))
                setIsModalOpen(false)
                setSelectedSale(null)
                toast.success('Venta eliminada por no tener productos')
                return
            }

            // Recalcular totales
            // Recalcular total venta sumando todos los items
            const newSubtotal = newProducts.reduce((acc, p) => acc + (p.cantidad * getLocalPrice(p)), 0)
            const newDescuentoTotal = Math.min(selectedSale.descuentoTotal || 0, newSubtotal)
            const newTotalVenta = newSubtotal - newDescuentoTotal
            
            // Recalcular ganancia
            // Restamos la ganancia proporcional a la cantidad devuelta
            const profitPerUnit = (getLocalPrice(productToRemove) - (productToRemove.precioOriginal || 0))
            const profitToRemove = profitPerUnit * qty
            // Si el descuento al total se recorta, esa parte vuelve a ser ganancia.
            const newTotalGanancia = (selectedSale.totalGanancia || 0) - profitToRemove
                + ((selectedSale.descuentoTotal || 0) - newDescuentoTotal)

            const saleRef = doc(db, 'sales', selectedSale.id)
            batch.update(saleRef, {
                productos: newProducts,
                subtotal: newSubtotal,
                descuentoTotal: newDescuentoTotal,
                totalVenta: newTotalVenta,
                totalGanancia: newTotalGanancia
            })

            await batch.commit()

            // Update local state
            const updatedSale = { 
                ...selectedSale, 
                productos: newProducts, 
                subtotal: newSubtotal,
                descuentoTotal: newDescuentoTotal,
                totalVenta: newTotalVenta, 
                totalGanancia: newTotalGanancia 
            }
            
            setSelectedSale(updatedSale)
            setSales(sales.map(s => s.id === selectedSale.id ? updatedSale : s))
            toast.success(`Se devolvieron ${qty} unidad(es) al inventario`)

        } catch (error) {
            console.error('Error removing product from sale:', error)
            toast.error('Error al actualizar la venta')
        } finally {
            setIsDeleting(false)
            setShowReturnProductModal(false)
            setProductToReturn(null)
        }
    }

    const filteredSales = sales.filter(sale => {
        // Payment Filter
        if (paymentFilter !== 'todos' && sale.tipoPago !== paymentFilter) {
            return false
        }
        
        // Search Filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim()
            const idMatch = sale.id.toLowerCase().includes(term)
            const clientMatch = sale.nombreCliente?.toLowerCase().includes(term)
            const productMatch = sale.productos.some(p => 
                p.nombreProducto.toLowerCase().includes(term) ||
                (p.idProducto && p.idProducto.toString().toLowerCase().includes(term))
            )
            
            if (!idMatch && !productMatch && !clientMatch) return false
        }

        return true
    })

    const totalSalesAmount = filteredSales.reduce((acc, sale) => {
        // No sumar fiado al total
        if (sale.tipoPago === 'fiado') return acc
        return acc + (sale.totalVenta || 0)
    }, 0)
    const totalSalesCount = filteredSales.length

    return (
        <div className="space-y-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Historial de Ventas</h2>
                    <p className="text-slate-400 text-sm">Registro de transacciones.</p>
                </div>

                <div className="flex flex-col gap-3 w-full xl:w-auto">
                    {/* Top Row of Filters: Stats + View Toggle + Search */}
                    <div className="flex flex-col sm:flex-row gap-3">
                         {/* View Toggle - NEW */}
                         <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0 h-[42px]">
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    "flex items-center gap-2 px-3 rounded-lg text-sm font-medium transition-all",
                                    viewMode === 'list' 
                                        ? "bg-primary text-on-accent shadow" 
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <List className="w-4 h-4" />
                                <span className="hidden sm:inline">Lista</span>
                            </button>
                            <button
                                onClick={() => setViewMode('analytics')}
                                className={cn(
                                    "flex items-center gap-2 px-3 rounded-lg text-sm font-medium transition-all",
                                    viewMode === 'analytics' 
                                        ? "bg-primary text-on-accent shadow" 
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <BarChart3 className="w-4 h-4" />
                                <span className="hidden sm:inline">Gráficos</span>
                            </button>
                        </div>

                         {/* Stats Card - Hidden on mobile if analytics view active to save space? No, keep it. */}
                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2 min-h-[42px] whitespace-nowrap">
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                                <div className="bg-emerald-500/20 p-1.5 rounded-lg text-emerald-400">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider leading-none">Total</p>
                                    <p className="text-lg font-bold text-emerald-400 leading-tight">
                                        {loading ? '...' : formatCLP(totalSalesAmount)}
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
                                        {loading ? '...' : totalSalesCount}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Buscar por ID o producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-[42px] bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                    </div>

                    {/* Bottom Row of Filters: Selects + Date */}
                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 h-10 flex-1 min-w-[120px]">
                            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="w-full bg-transparent border-none text-white focus:outline-none text-sm [&>option]:bg-slate-900"
                            >
                                <option value="todos">Todos los pagos</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="fiado">Fiado</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 h-10 flex-1 min-w-[140px]">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="w-full bg-transparent border-none text-white focus:outline-none text-sm [&>option]:bg-slate-900"
                            >
                                <option value="day">Día específico</option>
                                <option value="week">Última semana</option>
                                <option value="month">Último mes</option>
                                <option value="3months">Últimos 3 meses</option>
                                <option value="6months">Últimos 6 meses</option>
                                <option value="year">Último año</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 h-10 flex-1 min-w-[130px]">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none text-sm [&::-webkit-calendar-picker-indicator]:invert w-full"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                 <div className="space-y-4">
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
            ) : (
                <>
                    {viewMode === 'list' ? (
                        <Card className="overflow-hidden p-0 border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/5">
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm">Fecha</th>
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm hidden sm:table-cell">ID</th>
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm">Cliente</th>
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm">Items</th>
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm">Pago</th>
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm text-right hidden md:table-cell">Descuento</th>
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm text-right">Total</th>
                                            <th className="px-4 py-3 font-medium text-slate-300 text-sm text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredSales.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                                                    {searchTerm ? 'No se encontraron resultados para tu búsqueda' : 'No se encontraron ventas para este período'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredSales.map((sale) => (
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
                                                    <td className="px-4 py-3">
                                                        {sale.nombreCliente ? (
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-white text-sm">{sale.nombreCliente}</span>
                                                                {sale.tipoPago === 'fiado' && (
                                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                                                        Deudor
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300">
                                                        {sale.productos.length} items
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize",
                                                            sale.tipoPago === 'efectivo'
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : sale.tipoPago === 'tarjeta'
                                                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                                    : sale.tipoPago === 'fiado'
                                                                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                                        )}>
                                                            {sale.tipoPago === 'efectivo' ? <Banknote className="w-3 h-3" /> : 
                                                             sale.tipoPago === 'fiado' ? <User className="w-3 h-3" /> :
                                                             <CreditCard className="w-3 h-3" />}
                                                            {sale.tipoPago}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                                                        {tieneDescuento(sale) ? (
                                                            <span
                                                                title={(sale.descuentoTotal || 0) > 0 && descuentoItems(sale) > 0
                                                                    ? `Por producto −${formatCLP(descuentoItems(sale))} · al total −${formatCLP(sale.descuentoTotal)}`
                                                                    : (sale.descuentoTotal || 0) > 0 ? 'Descuento al total' : 'Descuento por producto'}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                                                                           bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                                            >
                                                                <Percent className="w-3 h-3" />
                                                                −{formatCLP((sale.descuentoTotal || 0) + descuentoItems(sale))}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-emerald-400 text-right tabular-nums">
                                                        {formatCLP(sale.totalVenta)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleViewDetails(sale)}
                                                                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                                title="Editar Tipo de Pago / Ver Detalle"
                                                            >
                                                                <Pencil className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => confirmDeleteSale(sale.id)}
                                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Eliminar Venta"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ) : (
                        <SalesAnalytics sales={filteredSales} dateRange={dateRange} />
                    )}
                </>
            )}

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
                                        {selectedSale.idCliente && <option value="fiado">Fiado</option>}
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
                                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
                                        <div>
                                            <p className="text-white font-medium">{prod.nombreProducto}</p>
                                            <p className="text-xs text-slate-400 tabular-nums">
                                                {prod.cantidad} x {formatCLP(getLocalPrice(prod))}
                                                {prod.descuento > 0 && (
                                                    <>
                                                        <span className="line-through ml-1.5 text-slate-500">{formatCLP(prod.precioLista)}</span>
                                                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                            −{Math.round((prod.descuento / prod.precioLista) * 100)}%
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className={cn("font-medium tabular-nums", prod.descuento > 0 ? "text-amber-300" : "text-white")}>
                                                {formatCLP(prod.cantidad * getLocalPrice(prod))}
                                            </p>
                                            <button
                                                onClick={() => initiateReturnProduct(index)}
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Devolver producto"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/10 space-y-1.5 tabular-nums">
                            {tieneDescuento(selectedSale) && (
                                <>
                                    {descuentoItems(selectedSale) > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <p className="text-slate-400">Descuentos por producto</p>
                                            <p className="text-amber-300">−{formatCLP(descuentoItems(selectedSale))}</p>
                                        </div>
                                    )}
                                    {(selectedSale.descuentoTotal || 0) > 0 && (
                                        <>
                                            <div className="flex justify-between text-sm">
                                                <p className="text-slate-400">Subtotal</p>
                                                <p className="text-slate-300">{formatCLP(selectedSale.subtotal ?? selectedSale.totalVenta + selectedSale.descuentoTotal)}</p>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <p className="text-slate-400 inline-flex items-center gap-1.5">
                                                    <Percent className="w-3.5 h-3.5 text-amber-300" /> Descuento al total
                                                </p>
                                                <p className="text-amber-300">−{formatCLP(selectedSale.descuentoTotal)}</p>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                            <div className="flex justify-between items-center pt-1">
                                <p className="text-slate-400">Total Pagado</p>
                                <p className="text-2xl font-bold text-emerald-400">{formatCLP(selectedSale.totalVenta)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirm Delete Sale Modal */}
            <Modal
                isOpen={showDeleteSaleModal}
                onClose={() => setShowDeleteSaleModal(false)}
                title="Eliminar Venta"
                className="max-w-md"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-medium text-white">¿Estás seguro?</h3>
                        <p className="text-slate-400 text-sm">
                            Esta acción eliminará la venta permanentemente y devolverá todos los productos al inventario.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowDeleteSaleModal(false)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-red-500 hover:bg-red-600 text-on-accent border-none" 
                            onClick={executeDeleteSale} 
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar Venta'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Return/Reduce Product Modal */}
            <Modal
                isOpen={showReturnProductModal}
                onClose={() => setShowReturnProductModal(false)}
                title="Devolver Producto"
                className="max-w-md"
            >
                {productToReturn && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <p className="text-white font-medium">{productToReturn.product.nombreProducto}</p>
                            <p className="text-slate-400 text-sm">
                                Cantidad comprada: <span className="text-white font-mono">{productToReturn.maxQuantity}</span>
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Cantidad a devolver al inventario</label>
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="secondary" 
                                    className="w-10 h-10 p-0"
                                    onClick={() => setQuantityToReturn(Math.max(1, quantityToReturn - 1))}
                                >
                                    -
                                </Button>
                                <Input
                                    type="number"
                                    min="1"
                                    max={productToReturn.maxQuantity}
                                    value={quantityToReturn}
                                    onChange={(e) => setQuantityToReturn(Number(e.target.value))}
                                    className="text-center font-mono"
                                />
                                <Button 
                                    variant="secondary" 
                                    className="w-10 h-10 p-0"
                                    onClick={() => setQuantityToReturn(Math.min(productToReturn.maxQuantity, quantityToReturn + 1))}
                                >
                                    +
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {quantityToReturn === productToReturn.maxQuantity 
                                    ? "Se eliminará el producto de la venta."
                                    : `Quedarán ${productToReturn.maxQuantity - quantityToReturn} unidad(es) en la venta.`
                                }
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="secondary" onClick={() => setShowReturnProductModal(false)} disabled={isDeleting}>
                                Cancelar
                            </Button>
                            <Button 
                                className="bg-red-500 hover:bg-red-600 text-on-accent border-none" 
                                onClick={executeReturnProduct} 
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Procesando...' : 'Confirmar Devolución'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default SalesHistory