import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, doc, where, getDoc, getDocs, query, orderBy, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { 
    ArrowLeft, 
    User, 
    Phone,
    Mail,
    IdCard,
    DollarSign, 
    Calendar, 
    History, 
    CreditCard, 
    Package, 
    Receipt, 
    ChevronDown, 
    ChevronUp, 
    TrendingUp, 
    ShoppingBag, 
    ChevronLeft, 
    ChevronRight, 
    Trash2, 
    AlertTriangle 
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCLP, cn } from '../../lib/utils'

function ClientDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [client, setClient] = useState(null)
    const [loading, setLoading] = useState(true)
    const [clientMovements, setClientMovements] = useState([])
    const [loadingMovements, setLoadingMovements] = useState(false)
    
    const [activeTab, setActiveTab] = useState('purchases')
    const [expandedSaleId, setExpandedSaleId] = useState(null)

    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('efectivo')
    const [processingPayment, setProcessingPayment] = useState(false)

    const [showDeleteClientModal, setShowDeleteClientModal] = useState(false)
    const [showDeleteMovementModal, setShowDeleteMovementModal] = useState(false)
    const [showReturnProductModal, setShowReturnProductModal] = useState(false)
    const [itemToDelete, setItemToDelete] = useState(null)
    const [productToReturn, setProductToReturn] = useState(null)
    const [quantityToReturn, setQuantityToReturn] = useState(1)
    const [isDeleting, setIsDeleting] = useState(false)

    const getLocalPrice = (prod) => Number(prod?.precioVentaLocal ?? prod?.precio ?? 0)

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
            
            // 3. Register as a Sale (Abono) for History first to get ID
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

            batch.set(movementRef, {
                type: 'payment',
                amount: amount,
                paymentMethod: paymentMethod,
                date: Timestamp.now(),
                note: `Abono (${paymentMethod})`,
                saleId: saleRef.id // Link to main sale
            })

            // 2. Update client debt
            const clientRef = doc(db, 'clients', client.id)
            const newDebt = (client.currentDebt || 0) - amount
            batch.update(clientRef, {
                currentDebt: newDebt,
                lastUpdated: Timestamp.now()
            })

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

    const handleDeleteClient = async () => {
        if (!client) return
        setIsDeleting(true)
        try {
            const batch = writeBatch(db)
            
            // Delete client document
            const clientRef = doc(db, 'clients', client.id)
            batch.delete(clientRef)

            // Note: Subcollections (movements) are NOT automatically deleted in Firestore.
            // For a small app, we might leave them or delete them one by one if we fetched them.
            // Since we have clientMovements loaded, we can try to delete them.
            clientMovements.forEach(mov => {
                const movRef = doc(db, `clients/${client.id}/movements`, mov.id)
                batch.delete(movRef)
            })

            await batch.commit()
            toast.success('Cliente eliminado correctamente')
            navigate('/clientes')
        } catch (error) {
            console.error("Error deleting client:", error)
            toast.error('Error al eliminar cliente')
        } finally {
            setIsDeleting(false)
            setShowDeleteClientModal(false)
        }
    }

    const initiateDeleteMovement = (movement) => {
        setItemToDelete(movement)
        setShowDeleteMovementModal(true)
    }

    const executeDeleteMovement = async () => {
        if (!itemToDelete || !client) return
        setIsDeleting(true)
        
        try {
            const batch = writeBatch(db)
            const movementRef = doc(db, `clients/${client.id}/movements`, itemToDelete.id)
            
            // 1. Delete movement doc
            batch.delete(movementRef)

            // 2. Delete linked sale doc if exists
            if (itemToDelete.saleId) {
                const saleRef = doc(db, 'sales', itemToDelete.saleId)
                batch.delete(saleRef)
            }

            // 3. Update Client Debt
            let debtChange = 0
            if (itemToDelete.type === 'purchase') {
                // Deleting a purchase -> Decrease debt
                debtChange = -itemToDelete.amount
                
                // 4. Restore Stock (only for purchases)
                if (itemToDelete.products) {
                    for (const prod of itemToDelete.products) {
                        // Query 'productos' collection by 'idProducto' to find the document ID
                        const q = query(collection(db, 'productos'), where('idProducto', '==', prod.idProducto))
                        const querySnapshot = await getDocs(q)
                        if (!querySnapshot.empty) {
                            const productDoc = querySnapshot.docs[0]
                            const currentStock = productDoc.data().cantidadProducto || 0
                            const productRef = doc(db, 'productos', productDoc.id)
                            batch.update(productRef, { 
                                cantidadProducto: currentStock + prod.cantidad 
                            })
                        }
                    }
                }
            } else if (itemToDelete.type === 'payment') {
                // Deleting a payment -> Increase debt (revert payment)
                debtChange = itemToDelete.amount
            }

            const clientRef = doc(db, 'clients', client.id)
            batch.update(clientRef, {
                currentDebt: (client.currentDebt || 0) + debtChange,
                lastUpdated: Timestamp.now()
            })

            await batch.commit()
            
            toast.success('Movimiento eliminado y saldo actualizado')
            setClient(prev => ({ ...prev, currentDebt: (prev.currentDebt || 0) + debtChange }))
            fetchMovements(client.id)

        } catch (error) {
            console.error("Error deleting movement:", error)
            toast.error('Error al eliminar movimiento')
        } finally {
            setIsDeleting(false)
            setShowDeleteMovementModal(false)
            setItemToDelete(null)
        }
    }

    const initiateReturnProduct = (movement, productIndex) => {
        const product = movement.products[productIndex]
        setProductToReturn({
            movement,
            index: productIndex,
            product,
            maxQuantity: product.cantidad
        })
        setQuantityToReturn(1)
        setShowReturnProductModal(true)
    }

    const executeReturnProduct = async () => {
        if (!productToReturn || !client) return
        
        const qty = Number(quantityToReturn)
        if (qty <= 0 || qty > productToReturn.maxQuantity) {
            toast.error('Cantidad inválida')
            return
        }

        setIsDeleting(true)
        const { movement, index, product } = productToReturn

        try {
            const batch = writeBatch(db)

            // 1. Restore Stock
            const q = query(collection(db, 'productos'), where('idProducto', '==', product.idProducto))
            const querySnapshot = await getDocs(q)
            if (!querySnapshot.empty) {
                const productDoc = querySnapshot.docs[0]
                const currentStock = productDoc.data().cantidadProducto || 0
                const productRef = doc(db, 'productos', productDoc.id)
                batch.update(productRef, { 
                    cantidadProducto: currentStock + qty 
                })
            }

            // 2. Update Movement
            const newProducts = [...movement.products]
            let amountToReduce = 0
            const productPrice = getLocalPrice(product)

            if (qty === productToReturn.maxQuantity) {
                newProducts.splice(index, 1)
                amountToReduce = productPrice * qty
            } else {
                newProducts[index] = {
                    ...product,
                    cantidad: product.cantidad - qty
                }
                amountToReduce = productPrice * qty
            }

            // If no products left, delete the whole movement
            if (newProducts.length === 0) {
                // Reuse delete logic? simpler to just do it here to avoid state complexity
                const movementRef = doc(db, `clients/${client.id}/movements`, movement.id)
                batch.delete(movementRef)
                
                if (movement.saleId) {
                    const saleRef = doc(db, 'sales', movement.saleId)
                    batch.delete(saleRef)
                }
            } else {
                const movementRef = doc(db, `clients/${client.id}/movements`, movement.id)
                batch.update(movementRef, {
                    products: newProducts,
                    amount: movement.amount - amountToReduce
                })

                // Update linked sale if exists
                if (movement.saleId) {
                    const saleRef = doc(db, 'sales', movement.saleId)
                    // We need to fetch the sale to update it properly, but here we can try to assume structure match
                    // Ideally we fetch, but for batch efficiency we might skip if we trust sync.
                    // Let's just update totals for now on sale doc, updating products array is harder without reading.
                    // Actually, let's read the sale doc to be safe if possible, but we are inside a function.
                    // For now, let's just update the totals on the sale doc to keep financial stats correct.
                    // Updating the products array inside the sale doc would require reading it first or duplicating logic.
                    // Given complexity, let's just update the movement and debt, and try to update sale totals.
                    // NOTE: This might leave sale.products out of sync with movement.products if we don't update it.
                    // Let's try to update it blindly assuming same index? No, risky.
                    // Let's just decrement the totalVenta.
                    // Ideally we should update the products array in sale doc too.
                    
                    // Let's do a read inside this try block, it's fine.
                    const saleDocRef = doc(db, 'sales', movement.saleId)
                    const saleSnap = await getDoc(saleDocRef)
                    if (saleSnap.exists()) {
                        const saleData = saleSnap.data()
                        const saleProducts = [...saleData.productos]
                        // Find product in sale products (by idProducto)
                        const saleProdIndex = saleProducts.findIndex(p => p.idProducto === product.idProducto)
                        
                        if (saleProdIndex !== -1) {
                            if (qty === productToReturn.maxQuantity) {
                                saleProducts.splice(saleProdIndex, 1)
                            } else {
                                saleProducts[saleProdIndex].cantidad -= qty
                            }
                            
                            batch.update(saleDocRef, {
                                productos: saleProducts,
                                totalVenta: saleData.totalVenta - amountToReduce,
                                totalGanancia: (saleData.totalGanancia || 0) - ((productPrice - (product.precioOriginal || 0)) * qty)
                            })
                        }
                    }
                }
            }

            // 3. Update Client Debt
            const clientRef = doc(db, 'clients', client.id)
            batch.update(clientRef, {
                currentDebt: (client.currentDebt || 0) - amountToReduce,
                lastUpdated: Timestamp.now()
            })

            await batch.commit()
            toast.success(`Se devolvieron ${qty} unidad(es)`)
            setClient(prev => ({ ...prev, currentDebt: (prev.currentDebt || 0) - amountToReduce }))
            fetchMovements(client.id)

        } catch (error) {
            console.error("Error returning product:", error)
            toast.error('Error al devolver producto')
        } finally {
            setIsDeleting(false)
            setShowReturnProductModal(false)
            setProductToReturn(null)
        }
    }

    const totalPurchased = clientMovements
        .filter(m => m.type === 'purchase')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0)

    const totalPaid = clientMovements
        .filter(m => m.type === 'payment')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0)

    const lastPurchaseDate = clientMovements.find(m => m.type === 'purchase')?.date

    const filteredMovements = clientMovements.filter(mov => {
        if (activeTab === 'purchases') return mov.type === 'purchase';
        if (activeTab === 'payments') return mov.type === 'payment';
        return true;
    })

    const displayData = filteredMovements
    const isProductView = false

    const totalPages = Math.ceil(displayData.length / itemsPerPage)
    const paginatedData = displayData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    useEffect(() => {
        setCurrentPage(1)
    }, [activeTab])

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Cargando perfil...</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
            {/* Header: la ficha del cliente es una tarjeta más, no texto suelto. */}
            <Card className="p-4 md:p-5 bg-slate-900/50 border-white/10 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                        <Button variant="ghost" onClick={() => navigate('/clientes')} className="p-2 shrink-0" aria-label="Volver a clientes">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 grid place-items-center
                                        text-white text-xl font-bold shrink-0">
                            {client.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 min-w-0">
                                <span className="truncate">{client.name}</span>
                                <span className="text-xs font-normal text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 shrink-0">
                                    Cliente
                                </span>
                                <button
                                    onClick={() => setShowDeleteClientModal(true)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                                    title="Eliminar Cliente"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </h2>
                            <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3.5 h-3.5" />
                                Registrado el {client.createdAt?.toDate().toLocaleDateString('es-CL')}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-3 lg:w-auto lg:min-w-[520px]">
                        {[
                            { Icon: Phone, label: 'Teléfono', value: client.phone, tone: 'bg-emerald-500/15 text-emerald-400' },
                            { Icon: IdCard, label: 'RUT', value: client.rut, tone: 'bg-purple-500/15 text-purple-400', mono: true },
                            { Icon: Mail, label: 'Correo', value: client.email, tone: 'bg-sky-500/15 text-sky-400' },
                        ].map(({ Icon, label, value, tone, mono }) => (
                            <div key={label} className="flex items-center gap-2.5 rounded-xl bg-slate-950/50 border border-white/10 px-3 py-2 min-w-0">
                                <div className={cn("w-8 h-8 rounded-lg grid place-items-center shrink-0", tone)}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</p>
                                    <p className={cn("text-sm truncate", value ? "text-white font-medium" : "text-slate-500", mono && value && "font-mono")} title={value || undefined}>
                                        {value || 'No registrado'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 px-8 lg:px-10 h-14 text-lg font-bold transition-all hover:scale-105 shrink-0"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            <span>ABONAR</span>
                        </div>
                    </Button>
                </div>
            </Card>

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
                                    {activeTab !== 'purchases' && <th className="px-4 py-3">Tipo</th>}
                                    <th className="px-4 py-3 w-[45%]">
                                        {activeTab === 'purchases' ? 'Items' : 'Detalle / Nota'}
                                    </th>
                                    <th className="px-4 py-3 text-right">Monto</th>
                                    {activeTab === 'purchases' && <th className="px-4 py-3 w-10"></th>}
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {paginatedData.map((item, idx) => {
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
                                                <td className="px-4 py-3 text-right align-middle">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            initiateDeleteMovement(mov)
                                                        }}
                                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Eliminar Movimiento"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                            {/* Expanded Details for Purchases Tab */}
                                            {activeTab === 'purchases' && expandedSaleId === mov.id && (
                                                <tr className="bg-white/5 border-b border-white/10">
                                                    <td colSpan="5" className="px-4 py-3">
                                                        <div className="bg-slate-950/50 rounded-lg p-3 border border-white/5">
                                                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detalle de Productos</h5>
                                                            <div className="space-y-2">
                                                                {mov.products && mov.products.map((p, idx) => (
                                                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0 group/prod">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-xs font-mono">
                                                                                {p.cantidad}x
                                                                            </span>
                                                                            <span className="text-slate-200">{p.nombreProducto}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-slate-400 font-mono">
                                                                                {formatCLP(p.precio * p.cantidad)}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => initiateReturnProduct(mov, idx)}
                                                                                className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover/prod:opacity-100 transition-opacity"
                                                                                title="Devolver Producto"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
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

            {/* Confirm Delete Client Modal */}
            <Modal
                isOpen={showDeleteClientModal}
                onClose={() => setShowDeleteClientModal(false)}
                title="Eliminar Cliente"
                className="max-w-md"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-medium text-white">¿Estás seguro?</h3>
                        <p className="text-slate-400 text-sm">
                            Esta acción eliminará al cliente <span className="text-white font-bold">{client.name}</span> y todo su historial de movimientos.
                            <br/><br/>
                            <span className="text-red-400">¡Esta acción no se puede deshacer!</span>
                        </p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowDeleteClientModal(false)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-red-500 hover:bg-red-600 text-white border-none" 
                            onClick={handleDeleteClient} 
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar Cliente'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Delete Movement Modal */}
            <Modal
                isOpen={showDeleteMovementModal}
                onClose={() => setShowDeleteMovementModal(false)}
                title="Eliminar Movimiento"
                className="max-w-md"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-medium text-white">¿Eliminar este movimiento?</h3>
                        <p className="text-slate-400 text-sm">
                            {itemToDelete?.type === 'purchase' 
                                ? "Se eliminará la venta, se restaurará el stock de los productos y se descontará de la deuda del cliente."
                                : "Se eliminará el abono y la deuda del cliente aumentará."
                            }
                        </p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowDeleteMovementModal(false)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-red-500 hover:bg-red-600 text-white border-none" 
                            onClick={executeDeleteMovement} 
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Return Product Modal */}
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
                                className="bg-red-500 hover:bg-red-600 text-white border-none" 
                                onClick={executeReturnProduct} 
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Procesando...' : 'Confirmar Devolución'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

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