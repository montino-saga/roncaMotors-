import { useState, useRef, useEffect } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, getDocs, query, where, writeBatch, doc, Timestamp, updateDoc, orderBy } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Search, Trash2, ShoppingCart, CreditCard, Banknote, User } from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { printer } from '../../lib/printer'
import { sounds } from '../../lib/sounds'

function Sales() {
    const [cart, setCart] = usePersistedState('montino_pos_cart', [])
    const [productId, setProductId] = useState('')
    const [loading, setLoading] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [paymentType, setPaymentType] = usePersistedState('montino_pos_payment_type', 'efectivo')
    const [isPrinterConnected, setIsPrinterConnected] = useState(false)
    const inputRef = useRef(null)

    // Attempt to connect printer automatically on mount (optional, nice to have if button is gone)
    useEffect(() => {
        const autoConnect = async () => {
            const connected = await printer.connect()
            if (connected) setIsPrinterConnected(true)
        }
        // autoConnect() // Uncomment if auto-connect is desired behavior
    }, [])

    const getLocalPrice = (item) => Number(item?.precioVentaLocal ?? item?.precioProducto ?? 0)

    // Stock Adjustment Modal State
    const [isStockModalOpen, setIsStockModalOpen] = useState(false)
    const [pendingProduct, setPendingProduct] = useState(null)
    const [newStockValue, setNewStockValue] = useState('')
    const [updatingStock, setUpdatingStock] = useState(false)

    // Debt State
    const [isDebtModalOpen, setIsDebtModalOpen] = useState(false)
    const [clients, setClients] = useState([])
    const [selectedClientId, setSelectedClientId] = useState('')
    const [clientSearch, setClientSearch] = useState('')
    const [loadingClients, setLoadingClients] = useState(false)

    // Focus input on mount and after adding product
    useEffect(() => {
        if (!isStockModalOpen && !isDebtModalOpen) {
            inputRef.current?.focus()
        }
    }, [cart, isStockModalOpen, isDebtModalOpen])

    const addToCart = async (e) => {
        e.preventDefault()
        if (!productId.trim()) return

        setLoading(true)
        try {
            // Search by idProducto (custom ID)
            const q = query(collection(db, 'productos'), where('idProducto', '==', productId))
            const querySnapshot = await getDocs(q)

            if (!querySnapshot.empty) {
                const docSnapshot = querySnapshot.docs[0]
                const productData = { ...docSnapshot.data(), id: docSnapshot.id }
                const existingItemIndex = cart.findIndex(item => item.idProducto === productData.idProducto)

                if (existingItemIndex >= 0) {
                    // Check stock limit
                    if (cart[existingItemIndex].cantidad + 1 > productData.cantidadProducto) {
                        toast.error('Stock insuficiente', {
                            description: `Solo quedan ${productData.cantidadProducto} unidades.`
                        })
                        setPendingProduct(productData)
                        setNewStockValue(productData.cantidadProducto.toString())
                        setIsStockModalOpen(true)
                        setProductId('')
                        return
                    }
                    // Increment quantity if already in cart
                    const newCart = [...cart]
                    newCart[existingItemIndex].cantidad += 1
                    setCart(newCart)
                    sounds.playScan()
                } else {
                    // Check stock limit
                    if (productData.cantidadProducto < 1) {
                        toast.error('Producto sin stock', {
                            description: '¿Deseas actualizar el inventario?',
                            action: {
                                label: 'Actualizar',
                                onClick: () => {
                                    setPendingProduct(productData)
                                    setNewStockValue('0')
                                    setIsStockModalOpen(true)
                                }
                            }
                        })
                        setProductId('')
                        return
                    }
                    // Add new item
                    setCart([...cart, { ...productData, cantidad: 1 }])
                    sounds.playScan()
                }
                setProductId('')
            } else {
                toast.error('Producto no encontrado')
                sounds.playError()
            }
        } catch (error) {
            console.error("Error searching product:", error)
            toast.error('Error al buscar producto')
            sounds.playError()
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStock = async () => {
        if (!pendingProduct || !newStockValue) return

        setUpdatingStock(true)
        try {
            const productRef = doc(db, 'productos', pendingProduct.id)
            const newStock = Number(newStockValue)

            await updateDoc(productRef, {
                cantidadProducto: newStock
            })

            toast.success('Stock actualizado', {
                description: `El nuevo stock es ${newStock}`
            })

            // Add to cart automatically if stock allows
            if (newStock > 0) {
                const existingItemIndex = cart.findIndex(item => item.idProducto === pendingProduct.idProducto)
                if (existingItemIndex >= 0) {
                    const newCart = [...cart]
                    // Only increment if we are within new limits (logic simplified for now)
                    if (newCart[existingItemIndex].cantidad < newStock) {
                        newCart[existingItemIndex].cantidad += 1
                        setCart(newCart)
                        toast.info('Producto agregado al carrito')
                    }
                } else {
                    setCart([...cart, { ...pendingProduct, cantidadProducto: newStock, cantidad: 1 }])
                    toast.info('Producto agregado al carrito')
                }
            }

            setIsStockModalOpen(false)
            setPendingProduct(null)
            setNewStockValue('')
        } catch (error) {
            console.error("Error updating stock:", error)
            toast.error('Error al actualizar stock')
        } finally {
            setUpdatingStock(false)
        }
    }

    const removeFromCart = (index) => {
        const newCart = [...cart]
        newCart.splice(index, 1)
        setCart(newCart)
    }

    const updateQuantity = (index, delta) => {
        const newCart = [...cart]
        const item = newCart[index]
        const newQuantity = item.cantidad + delta

        // Check stock limit when increasing
        if (delta > 0 && newQuantity > item.cantidadProducto) {
            toast.warning('Límite de stock alcanzado', {
                description: `Solo hay ${item.cantidadProducto} disponibles.`
            })
            return
        }

        if (newQuantity > 0) {
            newCart[index].cantidad = newQuantity
            setCart(newCart)
        }
    }

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (getLocalPrice(item) * item.cantidad), 0)
    }

    const calculateProfit = () => {
        return cart.reduce((total, item) => {
            const cost = item.precioOriginal || 0
            const price = getLocalPrice(item)
            return total + ((price - cost) * item.cantidad)
        }, 0)
    }

    const handleCheckout = async () => {
        if (cart.length === 0) return

        if (paymentType === 'fiado') {
            setIsDebtModalOpen(true)
            fetchClients()
            return
        }
        
        await executeSale()
    }

    const fetchClients = async () => {
        setLoadingClients(true)
        try {
            const q = query(collection(db, 'clients'), orderBy('name', 'asc'))
            const querySnapshot = await getDocs(q)
            const clientsData = []
            querySnapshot.forEach((doc) => {
                clientsData.push({ id: doc.id, ...doc.data() })
            })
            setClients(clientsData)
        } catch (error) {
            console.error("Error fetching clients:", error)
            toast.error('Error al cargar clientes')
        } finally {
            setLoadingClients(false)
        }
    }

    const executeSale = async () => {
        setProcessing(true)
        try {
            const batch = writeBatch(db)

            // 1. Create Sale Document
            const saleRef = doc(collection(db, 'sales'))
            const saleData = {
                fechaVenta: Timestamp.now(),
                idUsuario: "rSgG4AQYn5OU5hvLGfuLTCpnCWS2", // Hardcoded as requested
                productos: cart.map(item => ({
                    idProducto: item.idProducto,
                    nombreProducto: item.nombreProducto,
                    marcaProducto: item.marcaProducto || '',
                    categoriaProducto: item.categoriaProducto || '',
                    precioVentaLocal: Number(getLocalPrice(item)),
                    precioVentaWeb: Number(item.precioVentaWeb || 0),
                    precioProducto: Number(getLocalPrice(item)),
                    precioOriginal: Number(item.precioOriginal || 0),
                    cantidadProducto: Number(item.cantidadProducto || 0),
                    cantidad: item.cantidad
                })),
                tipoPago: paymentType,
                totalVenta: calculateTotal(),
                totalGanancia: calculateProfit()
            }
            batch.set(saleRef, saleData)

            // 2. Update Stock for each product
            cart.forEach(item => {
                const productRef = doc(db, 'productos', item.id)
                const newStock = item.cantidadProducto - item.cantidad
                batch.update(productRef, { cantidadProducto: newStock })
            })

            // 3. Commit Batch
            await batch.commit()
            sounds.playSuccess()

            // 4. Print Receipt (Silent)
            if (isPrinterConnected) {
                try {
                    await printer.printReceipt(saleData)
                } catch (printError) {
                    console.error("Print error:", printError)
                    toast.error("Venta guardada, pero falló la impresión")
                }
            }

            toast.success('Venta realizada con éxito', {
                description: `Total: ${formatCLP(saleData.totalVenta)} - Pago: ${paymentType}`,
                duration: 3000
            })

            setCart([])
            setPaymentType('efectivo')
        } catch (error) {
            console.error("Error processing sale:", error)
            toast.error('Error al procesar la venta')
        } finally {
            setProcessing(false)
            inputRef.current?.focus()
        }
    }

    const handleDebtSale = async () => {
        if (!selectedClientId) {
            toast.error('Debes seleccionar un cliente')
            return
        }

        setProcessing(true)
        try {
            const batch = writeBatch(db)
            const total = calculateTotal()

            // 1. Create Sale Document
            const saleRef = doc(collection(db, 'sales'))
            const clientDoc = clients.find(c => c.id === selectedClientId)
            
            const saleData = {
                fechaVenta: Timestamp.now(),
                idUsuario: "rSgG4AQYn5OU5hvLGfuLTCpnCWS2", // Hardcoded as requested
                productos: cart.map(item => ({
                    idProducto: item.idProducto,
                    nombreProducto: item.nombreProducto,
                    marcaProducto: item.marcaProducto || '',
                    categoriaProducto: item.categoriaProducto || '',
                    precioVentaLocal: Number(getLocalPrice(item)),
                    precioVentaWeb: Number(item.precioVentaWeb || 0),
                    precioProducto: Number(getLocalPrice(item)),
                    precioOriginal: Number(item.precioOriginal || 0),
                    cantidadProducto: Number(item.cantidadProducto || 0),
                    cantidad: item.cantidad
                })),
                tipoPago: 'fiado',
                totalVenta: calculateTotal(),
                totalGanancia: calculateProfit(),
                idCliente: selectedClientId,
                nombreCliente: clientDoc?.name || 'Cliente Desconocido',
                isFiado: true
            }
            batch.set(saleRef, saleData)

            // 2. Create Movement in Client's Subcollection (Keep for client history)
            const movementRef = doc(collection(db, `clients/${selectedClientId}/movements`))
            batch.set(movementRef, {
                type: 'purchase',
                amount: total,
                date: Timestamp.now(),
                products: cart.map(item => ({
                    idProducto: item.idProducto,
                    nombreProducto: item.nombreProducto,
                    cantidad: item.cantidad,
                    precio: getLocalPrice(item)
                })),
                saleId: saleRef.id // Link to main sale
            })

            // 3. Update Client Debt
            const clientRef = doc(db, 'clients', selectedClientId)
            const currentDebt = clientDoc?.currentDebt || 0
            batch.update(clientRef, {
                currentDebt: currentDebt + total,
                lastUpdated: Timestamp.now()
            })

            // 4. Update Stock for each product (Inventory only)
            cart.forEach(item => {
                const productRef = doc(db, 'productos', item.id)
                const newStock = item.cantidadProducto - item.cantidad
                batch.update(productRef, { cantidadProducto: newStock })
            })

            // 5. Commit Batch
            await batch.commit()
            sounds.playSuccess()

            toast.success('Fiado registrado correctamente', {
                description: `Cliente: ${clientDoc?.name} - Total: ${formatCLP(total)}`,
                duration: 4000
            })

            setCart([])
            setPaymentType('efectivo')
            setIsDebtModalOpen(false)
            setSelectedClientId('')
            setClientSearch('')
        } catch (error) {
            console.error("Error processing debt sale:", error)
            toast.error('Error al registrar fiado')
        } finally {
            setProcessing(false)
            inputRef.current?.focus()
        }
    }

    const filteredClients = clients.filter(client => 
        client.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.phone?.includes(clientSearch)
    )

    return (
        <div className="h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-3 md:gap-4 p-2 md:p-0">
            {/* Stock Adjustment Modal */}
            <Modal
                isOpen={isStockModalOpen}
                onClose={() => setIsStockModalOpen(false)}
                title="Actualizar Stock"
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        El producto <span className="font-bold text-white">{pendingProduct?.nombreProducto}</span> no tiene suficiente stock.
                    </p>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Nuevo Stock</label>
                        <Input
                            type="number"
                            value={newStockValue}
                            onChange={(e) => setNewStockValue(e.target.value)}
                            placeholder="Ingrese la cantidad real..."
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setIsStockModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateStock} disabled={updatingStock}>
                            {updatingStock ? 'Actualizando...' : 'Guardar y Agregar'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Client Selection Modal for Debt */}
            <Modal
                isOpen={isDebtModalOpen}
                onClose={() => setIsDebtModalOpen(false)}
                title="Seleccionar Cliente"
                className="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-slate-300">
                        Busca al cliente para cargar la venta de <span className="font-bold text-white">{formatCLP(calculateTotal())}</span>.
                    </p>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="pl-9"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                        {loadingClients ? (
                            <p className="text-center text-slate-500 py-4">Cargando clientes...</p>
                        ) : filteredClients.length === 0 ? (
                            <p className="text-center text-slate-500 py-4">No se encontraron clientes.</p>
                        ) : (
                            filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => setSelectedClientId(client.id)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg border transition-all",
                                        selectedClientId === client.id
                                            ? "bg-primary/20 border-primary text-white"
                                            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                                    )}
                                >
                                    <div className="font-bold">{client.name}</div>
                                    <div className="text-xs opacity-70 flex justify-between">
                                        <span>{client.phone || 'Sin teléfono'}</span>
                                        <span className={cn(client.currentDebt > 0 ? "text-red-300" : "text-emerald-300")}>
                                            Deuda: {formatCLP(client.currentDebt || 0)}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-4">
                        <Button variant="secondary" onClick={() => setIsDebtModalOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleDebtSale} 
                            disabled={!selectedClientId || processing}
                            className="bg-red-600 hover:bg-red-500"
                        >
                            {processing ? 'Guardando...' : 'Confirmar Fiado'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Left Side: Input & Product Entry */}
            <div className="w-full md:w-[35%] flex flex-col gap-4">
                <Card className="flex-1 flex flex-col p-3 md:p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                            Punto de Venta
                        </h2>
                    </div>

                    <form onSubmit={addToCart} className="mb-4 md:mb-6">
                        <div className="relative">
                            <Input
                                ref={inputRef}
                                value={productId}
                                onChange={(e) => setProductId(e.target.value)}
                                placeholder="Escanear..."
                                className="pl-10 h-12 text-lg"
                                disabled={loading || processing}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        </div>
                        <Button
                            type="submit"
                            className="w-full mt-3 h-12 text-base md:text-lg"
                            disabled={loading || processing || !productId}
                        >
                            {loading ? 'Buscando...' : 'Agregar Producto'}
                        </Button>
                    </form>

                    <div className="mt-auto space-y-3 md:space-y-4">
                        <div className="bg-white/5 rounded-xl p-3 md:p-4 border border-white/10">
                            <p className="text-slate-400 text-xs md:text-sm mb-1">Total a Pagar</p>
                            <p className="text-3xl md:text-4xl font-bold text-emerald-400">{formatCLP(calculateTotal())}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 md:gap-3">
                            <button
                                onClick={() => setPaymentType('efectivo')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-2 md:p-4 rounded-xl border transition-all",
                                    paymentType === 'efectivo'
                                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                )}
                            >
                                <Banknote className="w-5 h-5 md:w-6 md:h-6 mb-1 md:mb-2" />
                                <span className="text-xs md:text-sm font-medium">Efectivo</span>
                            </button>
                            <button
                                onClick={() => setPaymentType('tarjeta')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-2 md:p-4 rounded-xl border transition-all",
                                    paymentType === 'tarjeta'
                                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                )}
                            >
                                <CreditCard className="w-5 h-5 md:w-6 md:h-6 mb-1 md:mb-2" />
                                <span className="text-xs md:text-sm font-medium">Tarjeta</span>
                            </button>
                            <button
                                onClick={() => setPaymentType('fiado')}
                                className={cn(
                                    "col-span-2 flex flex-row items-center justify-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border transition-all",
                                    paymentType === 'fiado'
                                        ? "bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/10"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                )}
                            >
                                <User className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="text-xs md:text-sm font-medium">Cargar a Cuenta (Fiado)</span>
                            </button>
                        </div>

                        <Button
                            onClick={handleCheckout}
                            className={cn(
                                "w-full h-12 md:h-14 text-lg md:text-xl font-bold shadow-lg transition-colors",
                                paymentType === 'fiado' 
                                    ? "bg-red-600 hover:bg-red-500 shadow-red-500/20"
                                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                            )}
                            disabled={cart.length === 0 || processing}
                        >
                            {processing ? 'Procesando...' : paymentType === 'fiado' ? 'Seleccionar Cliente' : 'Finalizar Venta'}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Right Side: Cart List */}
            <div className="w-full md:w-[65%]">
                <Card className="h-full flex flex-col p-0 overflow-hidden">
                    <div className="p-3 md:p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h3 className="font-medium text-slate-300 text-sm md:text-base">Productos ({cart.reduce((acc, item) => acc + item.cantidad, 0)})</h3>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCart([])}
                            disabled={cart.length === 0}
                            className="text-xs h-7 md:h-8"
                        >
                            Limpiar
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3">
                        <AnimatePresence mode='popLayout'>
                            {cart.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50"
                                >
                                    <ShoppingCart className="w-12 h-12 md:w-16 md:h-16 mb-2 md:mb-4" />
                                    <p className="text-base md:text-lg">Carrito vacío</p>
                                    <p className="text-xs md:text-sm">Escanea productos</p>
                                </motion.div>
                            ) : (
                                cart.map((item, index) => (
                                    <motion.div
                                        key={`${item.id}-${index}`}
                                        layout
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex items-center gap-3 md:gap-4 p-2 md:p-4 rounded-xl bg-white/5 border border-white/10 group hover:border-white/20 transition-colors"
                                    >
                                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                                            <img
                                                src={item.imagenProducto || 'https://via.placeholder.com/64'}
                                                alt={item.nombreProducto}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-white truncate text-sm md:text-base">{item.nombreProducto}</h4>
                                            <p className="text-xs text-slate-400">{item.marcaProducto}</p>
                                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{item.idProducto}</div>
                                        </div>

                                        <div className="flex items-center gap-2 md:gap-3">
                                            <div className="flex items-center bg-slate-900 rounded-lg border border-white/10 h-8 md:h-9">
                                                <button
                                                    onClick={() => updateQuantity(index, -1)}
                                                    className="w-7 md:w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-l-lg transition-colors"
                                                >
                                                    -
                                                </button>
                                                <span className="w-7 md:w-8 text-center font-mono text-sm">{item.cantidad}</span>
                                                <button
                                                    onClick={() => updateQuantity(index, 1)}
                                                    className="w-7 md:w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-r-lg transition-colors"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <div className="text-right min-w-[70px] md:min-w-[80px]">
                                                <p className="font-bold text-white text-sm md:text-base">{formatCLP(getLocalPrice(item) * item.cantidad)}</p>
                                                <p className="text-[10px] md:text-xs text-slate-500">{formatCLP(getLocalPrice(item))} c/u</p>
                                            </div>

                                            <button
                                                onClick={() => removeFromCart(index)}
                                                className="p-1.5 md:p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default Sales