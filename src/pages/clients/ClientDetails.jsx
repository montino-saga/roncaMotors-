import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, orderBy, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { ArrowLeft, User, Phone, DollarSign, Calendar, History, CreditCard, Package, Receipt, ChevronDown, ChevronUp, TrendingUp, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatCLP, cn } from '../../lib/utils'

function ClientDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [client, setClient] = useState(null)
    const [loading, setLoading] = useState(true)
    const [clientMovements, setClientMovements] = useState([])
    const [loadingMovements, setLoadingMovements] = useState(false)
    
    // View State
    const [activeTab, setActiveTab] = useState('history') // 'history', 'purchases', 'payments'
    const [purchaseViewMode, setPurchaseViewMode] = useState('sales') // 'sales', 'products'
    const [expandedSaleId, setExpandedSaleId] = useState(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Payment State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('efectivo')
    const [processingPayment, setProcessingPayment] = useState(false)

    useEffect(() => {
        const fetchClientData = async () => {
            setLoading(true)
            try {
                const clientDoc = await getDoc(doc(db, 'clients', id))
                if (clientDoc.exists()) {
                    setClient({ id: clientDoc.id, ...clientDoc.data() })
                    fetchMovements(clientDoc.id)
                } else {
                    toast.error('Cliente no encontrado')
                    navigate('/clientes')
                }
            } catch (error) {
                console.error("Error fetching client:", error)
                toast.error('Error al cargar cliente')
            } finally {
                setLoading(false)
            }
        }

        fetchClientData()
    }, [id, navigate])

    const fetchMovements = async (clientId) => {
        setLoadingMovements(true)
        try {
            const q = query(
                collection(db, `clients/${clientId}/movements`),
                orderBy('date', 'desc')
            )
            const querySnapshot = await getDocs(q)
            const movements = []
            querySnapshot.forEach((doc) => {
                movements.push({ id: doc.id, ...doc.data() })
            })
            setClientMovements(movements)
        } catch (error) {
            console.error("Error fetching movements:", error)
            toast.error('Error al cargar historial')
        } finally {
            setLoadingMovements(false)
        }
    }

    const handlePayment = async () => {
        if (!client || !paymentAmount || Number(paymentAmount) <= 0) return

        setProcessingPayment(true)
        try {
            const amount = Number(paymentAmount)
            const batch = writeBatch(db)

            // 1. Create movement
            const movementRef = doc(collection(db, `clients/${client.id}/movements`))
            batch.set(movementRef, {
                type: 'payment',
                amount: amount,
                paymentMethod: paymentMethod,
                date: Timestamp.now(),
                note: `Abono (${paymentMethod})`
            })

            // 2. Update client debt
            const clientRef = doc(db, 'clients', client.id)
            const newDebt = (client.currentDebt || 0) - amount
            batch.update(clientRef, {
                currentDebt: newDebt,
                lastUpdated: Timestamp.now()
            })

            // 3. Register as a Sale (Abono) for History
            const saleRef = doc(collection(db, 'sales'))
            const saleData = {
                fechaVenta: Timestamp.now(),
                productos: [{
                    idProducto: 'ABONO',
                    nombreProducto: `Abono Cliente: ${client.name}`,
                    cantidad: 1,
                    precioVentaLocal: amount,
                    precioProducto: amount,
                    precioOriginal: 0,
                    cantidadProducto: 0,
                    esAbono: true
                }],
                tipoPago: paymentMethod,
                totalVenta: amount,
                totalGanancia: 0,
                idCliente: client.id,
                nombreCliente: client.name,
                isAbono: true
            }
            batch.set(saleRef, saleData)

            await batch.commit()

            toast.success('Abono registrado correctamente')
            setIsPaymentModalOpen(false)
            setPaymentAmount('')
            
            // Refresh local state
            setClient(prev => ({ ...prev, currentDebt: newDebt }))
            fetchMovements(client.id)
        } catch (error) {
            console.error("Error processing payment:", error)
            toast.error('Error al registrar abono')
        } finally {
            setProcessingPayment(false)
        }
    }

    // Dashboard Stats Calculation
    const totalPurchased = clientMovements
        .filter(m => m.type === 'purchase')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0)

    const totalPaid = clientMovements
        .filter(m => m.type === 'payment')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0)

    const lastPurchaseDate = clientMovements.find(m => m.type === 'purchase')?.date

    // Filter and Pagination Logic
    const filteredMovements = clientMovements.filter(mov => {
        if (activeTab === 'history') return true;
        if (activeTab === 'purchases') return mov.type === 'purchase';
        if (activeTab === 'payments') return mov.type === 'payment';
        return true;
    })

    // Special case for 'purchases' tab with 'products' view mode
    // We need to flatten the products list first if we are in that mode
    let displayData = []
    let isProductView = false

    if (activeTab === 'purchases' && purchaseViewMode === 'products') {
        isProductView = true
        displayData = clientMovements
            .filter(m => m.type === 'purchase' && m.products)
            .flatMap(m => m.products.map(p => ({ ...p, date: m.date })))
    } else {
        displayData = filteredMovements
    }

    const totalPages = Math.ceil(displayData.length / itemsPerPage)
    const paginatedData = displayData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // Reset pagination when tab changes
    useEffect(() => {
        setCurrentPage(1)
    }, [activeTab, purchaseViewMode])

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Cargando perfil...</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/clientes')} className="p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {client.name}
                            <span className="text-sm font-normal text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                                Cliente
                            </span>
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {client.phone || 'Sin teléfono'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Registrado: {client.createdAt?.toDate().toLocaleDateString('es-CL')}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Prominent Payment Button */}
                <Button 
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 px-12 py-4 text-lg font-bold transition-all hover:scale-105"
                >
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span>ABONAR</span>
                    </div>
                </Button>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <Card className="p-4 bg-slate-900/50 border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Deuda Actual</p>
                            <p className={cn(
                                "text-xl font-bold font-mono",
                                client.currentDebt > 0 ? "text-red-400" : "text-emerald-400"
                            )}>
                                {formatCLP(client.currentDebt || 0)}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total Comprado</p>
                            <p className="text-xl font-bold text-white font-mono">
                                {formatCLP(totalPurchased)}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total Pagado</p>
                            <p className="text-xl font-bold text-white font-mono">
                                {formatCLP(totalPaid)}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Última Compra</p>
                            <p className="text-sm font-bold text-white">
                                {lastPurchaseDate ? lastPurchaseDate.toDate().toLocaleDateString('es-CL') : 'N/A'}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <div className="flex flex-col flex-1 min-h-0 bg-slate-950 border border-white/10 rounded-xl overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 p-4 bg-white/5 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('history')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                activeTab === 'history'
                                    ? "bg-primary text-white"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <History className="w-4 h-4" />
                            Historial
                        </button>
                        <button
                            onClick={() => setActiveTab('purchases')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                activeTab === 'purchases'
                                    ? "bg-red-500 text-white"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <CreditCard className="w-4 h-4" />
                            Fiados
                        </button>
                        <button
                            onClick={() => setActiveTab('payments')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                activeTab === 'payments'
                                    ? "bg-emerald-500 text-white"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <DollarSign className="w-4 h-4" />
                            Abonos
                        </button>
                    </div>

                    {/* Sub-Filters for 'purchases' tab */}
                    {activeTab === 'purchases' && (
                        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg self-start sm:self-auto border border-white/10">
                            <button
                                onClick={() => setPurchaseViewMode('sales')}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                    purchaseViewMode === 'sales'
                                        ? "bg-white/10 text-white shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                )}
                            >
                                <Receipt className="w-3 h-3" />
                                Por Venta
                            </button>
                            <button
                                onClick={() => setPurchaseViewMode('products')}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                    purchaseViewMode === 'products'
                                        ? "bg-white/10 text-white shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                )}
                            >
                                <Package className="w-3 h-3" />
                                Por Producto
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto">
                    {loadingMovements ? (
                        <div className="p-12 text-center text-slate-500">Cargando movimientos...</div>
                    ) : displayData.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">Sin movimientos registrados.</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-900 text-slate-400 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    {isProductView ? (
                                        <>
                                            <th className="px-4 py-3">Producto</th>
                                            <th className="px-4 py-3 text-right">Cant.</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                        </>
                                    ) : (
                                        <>
                                            {activeTab !== 'purchases' && <th className="px-4 py-3">Tipo</th>}
                                            <th className="px-4 py-3 w-[45%]">
                                                {activeTab === 'purchases' ? 'Items' : 'Detalle / Nota'}
                                            </th>
                                            <th className="px-4 py-3 text-right">Monto</th>
                                            {activeTab === 'purchases' && <th className="px-4 py-3 w-10"></th>}
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {paginatedData.map((item, idx) => {
                                    // Handle Product View
                                    if (isProductView) {
                                        return (
                                            <tr key={idx} className="hover:bg-white/5">
                                                <td className="px-4 py-3 text-slate-400">
                                                    {item.date?.toDate().toLocaleDateString('es-CL')}
                                                </td>
                                                <td className="px-4 py-3 text-slate-200">
                                                    {item.nombreProducto}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400 font-mono">
                                                    {item.cantidad}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-200 font-mono">
                                                    {formatCLP(item.precio * item.cantidad)}
                                                </td>
                                            </tr>
                                        )
                                    }

                                    // Handle Standard View
                                    const mov = item
                                    return (
                                        <>
                                            <tr 
                                                key={mov.id} 
                                                className={cn(
                                                    "hover:bg-white/5 group transition-colors border-b border-white/5 last:border-0",
                                                    activeTab === 'purchases' && "cursor-pointer"
                                                )}
                                                onClick={() => {
                                                    if (activeTab === 'purchases') {
                                                        setExpandedSaleId(expandedSaleId === mov.id ? null : mov.id)
                                                    }
                                                }}
                                            >
                                                <td className="px-4 py-3 text-slate-400 align-top whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-200 font-medium">
                                                            {mov.date?.toDate().toLocaleDateString('es-CL')}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {mov.date?.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                {activeTab !== 'purchases' && (
                                                    <td className="px-4 py-3 align-top">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border",
                                                            mov.type === 'purchase' 
                                                                ? "bg-red-500/10 text-red-400 border-red-500/20" 
                                                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                        )}>
                                                            {mov.type === 'purchase' ? (
                                                                <>
                                                                    <CreditCard className="w-3 h-3" />
                                                                    Fiado
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <DollarSign className="w-3 h-3" />
                                                                    Abono
                                                                </>
                                                            )}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 text-slate-300 align-top">
                                                    {activeTab === 'purchases' ? (
                                                        <span className="text-slate-400">
                                                            {mov.products?.length || 0} productos
                                                        </span>
                                                    ) : (
                                                        mov.products && mov.products.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {mov.products.map((p, idx) => (
                                                                    <div key={idx} className="flex justify-between items-start text-xs border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                                                        <span>
                                                                            <span className="text-slate-400 font-mono mr-1">{p.cantidad}x</span>
                                                                            {p.nombreProducto}
                                                                        </span>
                                                                        <span className="text-slate-500 font-mono">
                                                                            {formatCLP(p.precio * p.cantidad)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="italic text-slate-500">{mov.note || '-'}</span>
                                                        )
                                                    )}
                                                </td>
                                                <td className={cn(
                                                    "px-4 py-3 text-right font-mono font-medium text-lg align-top",
                                                    mov.type === 'purchase' ? "text-red-400" : "text-emerald-400"
                                                )}>
                                                    {mov.type === 'purchase' ? '+' : '-'}{formatCLP(mov.amount)}
                                                </td>
                                                {activeTab === 'purchases' && (
                                                    <td className="px-4 py-3 text-right align-middle">
                                                        {expandedSaleId === mov.id ? (
                                                            <ChevronUp className="w-4 h-4 text-slate-500" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-slate-500" />
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                            {/* Expanded Details for Purchases Tab */}
                                            {activeTab === 'purchases' && expandedSaleId === mov.id && (
                                                <tr className="bg-white/5 border-b border-white/10">
                                                    <td colSpan="5" className="px-4 py-3">
                                                        <div className="bg-slate-950/50 rounded-lg p-3 border border-white/5">
                                                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detalle de Productos</h5>
                                                            <div className="space-y-2">
                                                                {mov.products && mov.products.map((p, idx) => (
                                                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-xs font-mono">
                                                                                {p.cantidad}x
                                                                            </span>
                                                                            <span className="text-slate-200">{p.nombreProducto}</span>
                                                                        </div>
                                                                        <span className="text-slate-400 font-mono">
                                                                            {formatCLP(p.precio * p.cantidad)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/5 shrink-0">
                        <p className="text-sm text-slate-400">
                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, displayData.length)} de {displayData.length} registros
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm text-white font-medium px-2">
                                Página {currentPage} de {totalPages}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Registrar Abono"
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Ingresa el monto que el cliente <span className="font-bold text-white">{client.name}</span> está pagando.
                    </p>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Monto del Abono</label>
                        <Input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="Ej: 5000"
                            autoFocus
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Método de Pago</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('efectivo')}
                                className={cn(
                                    "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                                    paymentMethod === 'efectivo'
                                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                )}
                            >
                                <DollarSign className="w-4 h-4" />
                                Efectivo
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('tarjeta')}
                                className={cn(
                                    "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                                    paymentMethod === 'tarjeta'
                                        ? "bg-purple-500/20 border-purple-500 text-purple-400"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                )}
                            >
                                <CreditCard className="w-4 h-4" />
                                Tarjeta
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={handlePayment} 
                            disabled={processingPayment || !paymentAmount || Number(paymentAmount) <= 0}
                            className="bg-emerald-600 hover:bg-emerald-500"
                        >
                            {processingPayment ? 'Procesando...' : 'Confirmar Abono'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default ClientDetails