import { useState, useRef, useEffect } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, getDocs, query, where, writeBatch, doc, Timestamp, updateDoc, orderBy } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Search, Trash2, ShoppingCart, CreditCard, Banknote, User, Package, Minus, Plus, AlertTriangle, FileText } from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'
import { SPRING, PRESS } from '../../lib/motion'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { printer } from '../../lib/printer'
import { sounds } from '../../lib/sounds'
import { useTheme } from '../../context/ThemeContext'

function Sales() {
    const { settings } = useTheme()
    const [cart, setCart] = usePersistedState('roncamotors_pos_cart', [])
    const [productId, setProductId] = useState('')
    const [loading, setLoading] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [paymentType, setPaymentType] = usePersistedState('roncamotors_pos_payment_type', 'efectivo')
    const [isPrinterConnected, setIsPrinterConnected] = useState(false)
    const inputRef = useRef(null)
    const listRef = useRef(null)
    const reduce = useReducedMotion()

    // El lector puede disparar dos escaneos antes de que responda el primero.
    // Con `cart` del closure el segundo pisa al primero, así que el carrito vive
    // también en un ref y toda escritura pasa por aquí.
    const cartRef = useRef(cart)
    useEffect(() => { cartRef.current = cart }, [cart])
    const commitCart = (updater) => {
        const next = typeof updater === 'function' ? updater(cartRef.current) : updater
        cartRef.current = next
        setCart(next)
        return next
    }

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
    const [stockReason, setStockReason] = useState('insuficiente')
    const [cotizando, setCotizando] = useState(false)

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

    // Escanear algo que cae fuera de la vista no confirma nada.
    useEffect(() => {
        const el = listRef.current
        if (!el) return
        el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
    }, [cart.length, reduce])

    const addToCart = async (e) => {
        e.preventDefault()
        const code = productId.trim()
        if (!code) return

        // El evento causal es el escaneo, no la respuesta de Firestore: el
        // acuse suena ahora y la caja queda libre para el siguiente código.
        sounds.playScan()
        setProductId('')
        setLoading(true)

        try {
            const q = query(collection(db, 'productos'), where('idProducto', '==', code))
            const querySnapshot = await getDocs(q)

            if (querySnapshot.empty) {
                toast.error('Producto no encontrado', { description: code })
                sounds.playError()
                return
            }

            const docSnapshot = querySnapshot.docs[0]
            const productData = { ...docSnapshot.data(), id: docSnapshot.id }
            const current = cartRef.current
            const existingItemIndex = current.findIndex(item => item.idProducto === productData.idProducto)

            if (existingItemIndex >= 0) {
                if (current[existingItemIndex].cantidad + 1 > productData.cantidadProducto) {
                    sounds.playError()
                    setStockReason('insuficiente')
                    setPendingProduct(productData)
                    setNewStockValue(productData.cantidadProducto.toString())
                    setIsStockModalOpen(true)
                    return
                }
                commitCart(current.map((item, i) =>
                    i === existingItemIndex ? { ...item, cantidad: item.cantidad + 1 } : item
                ))
            } else {
                if (productData.cantidadProducto < 1) {
                    sounds.playError()
                    setStockReason('agotado')
                    setPendingProduct(productData)
                    setNewStockValue('')
                    setIsStockModalOpen(true)
                    return
                }
                commitCart([...current, { ...productData, cantidad: 1 }])
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
                const current = cartRef.current
                const existingItemIndex = current.findIndex(item => item.idProducto === pendingProduct.idProducto)
                if (existingItemIndex >= 0) {
                    if (current[existingItemIndex].cantidad < newStock) {
                        commitCart(current.map((item, i) => i === existingItemIndex
                            ? { ...item, cantidad: item.cantidad + 1, cantidadProducto: newStock }
                            : item
                        ))
                        toast.info('Producto agregado al carrito')
                    }
                } else {
                    commitCart([...current, { ...pendingProduct, cantidadProducto: newStock, cantidad: 1 }])
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

    // Nada de confirmaciones para quitar: se deshace, que es más rápido y no
    // entrena a la gente a aceptar diálogos sin leerlos.
    const removeFromCart = (index) => {
        const snapshot = cartRef.current
        const item = snapshot[index]
        if (!item) return
        commitCart(snapshot.filter((_, i) => i !== index))
        toast('Producto quitado', {
            description: item.nombreProducto,
            action: { label: 'Deshacer', onClick: () => commitCart(snapshot) }
        })
    }

    const clearCart = () => {
        const snapshot = cartRef.current
        if (!snapshot.length) return
        commitCart([])
        toast('Carrito vaciado', {
            description: `${snapshot.length} ${snapshot.length === 1 ? 'producto' : 'productos'}`,
            duration: 6000,
            action: { label: 'Deshacer', onClick: () => commitCart(snapshot) }
        })
    }

    const updateQuantity = (index, delta) => {
        const snapshot = cartRef.current
        const item = snapshot[index]
        if (!item) return
        const newQuantity = item.cantidad + delta

        if (delta > 0 && newQuantity > item.cantidadProducto) {
            toast.warning('Límite de stock alcanzado', {
                description: `Solo hay ${item.cantidadProducto} disponibles.`
            })
            return
        }
        if (newQuantity < 1) return

        commitCart(snapshot.map((it, i) => i === index ? { ...it, cantidad: newQuantity } : it))
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

            commitCart([])
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

            commitCart([])
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

    const handleCotizar = async () => {
        if (!cartRef.current.length || cotizando) return
        setCotizando(true)
        try {
            const { generarCotizacion, compartirODescargar } = await import('../../lib/cotizacion')
            const { doc: pdf, folio, total } = await generarCotizacion({
                cart: cartRef.current,
                precioDe: getLocalPrice,
                settings
            })
            const { via, nombre, url } = await compartirODescargar(pdf, folio, settings.businessName)
            if (via === 'cancelado') return

            toast.success(
                via === 'compartido' ? 'Cotización compartida' : 'Cotización guardada en Descargas',
                {
                    description: `${nombre} · ${formatCLP(total)}`,
                    duration: 8000,
                    action: url
                        ? { label: 'Abrir', onClick: () => window.open(url, '_blank', 'noopener') }
                        : undefined
                }
            )
        } catch (error) {
            console.error('Error al generar la cotización:', error)
            toast.error('No se pudo generar la cotización')
        } finally {
            setCotizando(false)
        }
    }

    const filteredClients = clients.filter(client =>
        client.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.phone?.includes(clientSearch)
    )

    return (
        // Dos columnas ya desde sm: en móvil apaisado (667×375) apilar deja la
        // lista sin altura. El eje de la altura sigue a md, que es donde el
        // Layout deja de poner barra superior.
        <div className="page-fit flex flex-col sm:flex-row gap-3 md:gap-4">
            {/* Stock Adjustment Modal */}
            <Modal
                isOpen={isStockModalOpen}
                onClose={() => setIsStockModalOpen(false)}
                title={stockReason === 'agotado' ? 'Producto sin stock' : 'Stock insuficiente'}
                dismissible={!updatingStock}
            >
                <form
                    className="space-y-4"
                    onSubmit={(e) => { e.preventDefault(); handleUpdateStock() }}
                >
                    <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                        </div>
                        <p className="text-slate-200 leading-relaxed">
                            <span className="font-semibold text-white">{pendingProduct?.nombreProducto}</span>
                            {stockReason === 'agotado'
                                ? ' figura sin unidades en el inventario.'
                                : ` tiene ${pendingProduct?.cantidadProducto} ${pendingProduct?.cantidadProducto === 1 ? 'unidad' : 'unidades'} y el carrito ya las usa todas.`}
                            {' '}¿Cuántas hay realmente?
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="stock-real" className="text-sm font-medium text-slate-300">
                            Stock real
                        </label>
                        <Input
                            id="stock-real"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={newStockValue}
                            onChange={(e) => setNewStockValue(e.target.value)}
                            placeholder="Cantidad contada en bodega"
                            autoFocus
                        />
                        <p className="text-xs text-slate-400">
                            Se corrige el inventario y, si alcanza, el producto entra al carrito.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsStockModalOpen(false)}
                            disabled={updatingStock}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={updatingStock || newStockValue === ''}>
                            {updatingStock ? 'Actualizando...' : 'Guardar y Agregar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Client Selection Modal for Debt */}
            <Modal
                isOpen={isDebtModalOpen}
                onClose={() => setIsDebtModalOpen(false)}
                title="Seleccionar Cliente"
                className="max-w-md"
                dismissible={!processing}
                // Lo dispara el botón de cobro, abajo a la izquierda: nace de ahí.
                origin="bottom left"
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
                                    aria-pressed={selectedClientId === client.id}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg border transition-colors", PRESS,
                                        selectedClientId === client.id
                                            ? "bg-primary/20 border-primary text-white"
                                            : "bg-slate-950/40 border-white/10 text-slate-200 hover:bg-slate-950/60"
                                    )}
                                >
                                    <div className="font-semibold">{client.name}</div>
                                    <div className="text-xs flex justify-between mt-0.5">
                                        <span className="text-slate-400">{client.phone || 'Sin teléfono'}</span>
                                        <span className={cn(client.currentDebt > 0 ? "text-amber-300" : "text-emerald-300")}>
                                            Deuda: {formatCLP(client.currentDebt || 0)}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-4">
                        <Button variant="secondary" onClick={() => setIsDebtModalOpen(false)} disabled={processing}>Cancelar</Button>
                        <Button
                            onClick={handleDebtSale}
                            disabled={!selectedClientId || processing}
                            className="bg-amber-600 hover:bg-amber-500 shadow-amber-500/25"
                        >
                            {processing ? 'Guardando...' : 'Confirmar Fiado'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Caja: primera en el DOM para que en móvil quede arriba, a la
                derecha en pantallas anchas. Ancho fijo — su contenido no crece,
                el sobrante es para la lista. */}
            <div className="order-1 sm:order-2 w-full sm:w-[300px] lg:w-[340px] 2xl:w-[380px]
                            shrink-0 flex flex-col min-h-0 max-h-[62%] sm:max-h-none">
                <Card className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col p-3 lg:p-5">
                    <div className="hidden sm:flex items-center justify-between mb-4">
                        <h2 className="text-lg lg:text-2xl font-bold text-white flex items-center gap-2 tracking-[-0.01em]">
                            <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6 text-primary shrink-0" />
                            Punto de Venta
                        </h2>
                    </div>

                    <form onSubmit={addToCart} className="mb-3 lg:mb-6">
                        <div className="relative">
                            {/* Sin `disabled`: el lector no espera a Firestore. */}
                            <Input
                                ref={inputRef}
                                value={productId}
                                onChange={(e) => setProductId(e.target.value)}
                                placeholder="Escanear..."
                                className="pl-10 h-12 text-lg"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            {loading && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full
                                                 border-2 border-white/20 border-t-white/80 animate-spin
                                                 motion-reduce:animate-none" />
                            )}
                        </div>
                        <Button
                            type="submit"
                            className="w-full mt-3 h-12 text-base lg:text-lg"
                            disabled={!productId}
                        >
                            Agregar Producto
                        </Button>
                    </form>

                    <div className="mt-auto space-y-2.5 lg:space-y-4">
                        {/* Oscuro, no otro velo claro sobre el cristal de la Card.
                            En pantallas bajas la cifra va en línea para no comerse
                            la altura de la lista. */}
                        <div className="bg-slate-950/50 rounded-xl px-3 py-2.5 lg:p-4 border border-white/10
                                        reduce-transparency:bg-slate-950
                                        flex items-baseline justify-between gap-2 lg:block">
                            <p className="text-slate-300 text-xs lg:text-sm lg:mb-1 tracking-[0.01em] shrink-0">Total a Pagar</p>
                            <p className="text-2xl lg:text-4xl font-bold text-emerald-400 tracking-[-0.02em] tabular-nums truncate">
                                {formatCLP(calculateTotal())}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 lg:gap-3">
                            {[
                                { id: 'efectivo', label: 'Efectivo', Icon: Banknote },
                                { id: 'tarjeta', label: 'Tarjeta', Icon: CreditCard }
                            ].map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setPaymentType(id)}
                                    aria-pressed={paymentType === id}
                                    className={cn(
                                        "flex flex-col items-center justify-center min-h-[56px] lg:min-h-[72px] p-2 lg:p-4",
                                        "rounded-xl border transition-colors", PRESS,
                                        paymentType === id
                                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                            : "bg-slate-950/50 border-white/10 text-slate-300 hover:bg-slate-950/70"
                                    )}
                                >
                                    <Icon className="w-5 h-5 lg:w-6 lg:h-6 mb-1 lg:mb-2" />
                                    <span className="text-xs lg:text-sm font-medium">{label}</span>
                                </button>
                            ))}
                            {/* Ámbar, no rojo: fiar es una venta normal. El rojo queda
                                reservado a error y a destructivo. */}
                            <button
                                onClick={() => setPaymentType('fiado')}
                                aria-pressed={paymentType === 'fiado'}
                                className={cn(
                                    "col-span-2 flex flex-row items-center justify-center gap-2 lg:gap-3",
                                    "min-h-[48px] p-2 lg:p-3 rounded-xl border transition-colors", PRESS,
                                    paymentType === 'fiado'
                                        ? "bg-amber-500/20 border-amber-500 text-amber-200 shadow-lg shadow-amber-500/10"
                                        : "bg-slate-950/50 border-white/10 text-slate-300 hover:bg-slate-950/70"
                                )}
                            >
                                <User className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
                                <span className="text-xs lg:text-sm font-medium">Cargar a Cuenta (Fiado)</span>
                            </button>
                        </div>

                        <Button
                            onClick={handleCheckout}
                            className={cn(
                                "w-full h-12 lg:h-14 text-base lg:text-xl font-bold shadow-lg transition-colors tracking-[-0.01em]",
                                paymentType === 'fiado'
                                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20"
                                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                            )}
                            disabled={cart.length === 0 || processing}
                        >
                            {processing ? 'Procesando...' : paymentType === 'fiado' ? 'Seleccionar Cliente' : 'Finalizar Venta'}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Lista: a la izquierda en pantallas anchas, se queda con todo el
                espacio que la caja no necesita. */}
            <div className="order-2 sm:order-1 flex-1 min-w-0 min-h-0">
                <Card className="h-full flex flex-col p-0 overflow-hidden">
                    <div className="p-3 md:p-4 flex justify-between items-center gap-2 shrink-0">
                        <h3 className="font-medium text-slate-200 text-sm md:text-base truncate">
                            Productos ({cart.reduce((acc, item) => acc + item.cantidad, 0)})
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="secondary"
                                onClick={handleCotizar}
                                disabled={cart.length === 0 || cotizando}
                                className="text-xs h-8 px-3 inline-flex items-center gap-1.5"
                                title="Genera un PDF con el logo y los productos del carrito"
                            >
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                {cotizando ? 'Generando…' : 'Cotización'}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={clearCart}
                                disabled={cart.length === 0}
                                className="text-xs h-8 px-3"
                            >
                                Limpiar
                            </Button>
                        </div>
                    </div>

                    {/* Degradado donde el contenido cruza el chrome, en vez de un filo de 1px */}
                    <div
                        ref={listRef}
                        /* @container: las filas responden al ancho de la lista, no
                           al del viewport. Con el sidebar desplegado, a 1024px la
                           lista mide ~356px y un breakpoint de pantalla mentiría. */
                        className="@container flex-1 overflow-y-auto px-2 md:px-4 pb-2 md:pb-4 space-y-2 md:space-y-3 custom-scrollbar"
                        style={{
                            maskImage: "linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 20px), transparent 100%)",
                            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 20px), transparent 100%)"
                        }}
                    >
                        <AnimatePresence mode='popLayout'>
                            {cart.length === 0 ? (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={SPRING}
                                    className="h-full flex flex-col items-center justify-center text-slate-400"
                                >
                                    <ShoppingCart className="w-12 h-12 md:w-16 md:h-16 mb-2 md:mb-4 opacity-40" />
                                    <p className="text-base md:text-lg font-medium">Carrito vacío</p>
                                    <p className="text-xs md:text-sm text-slate-500">Escanea productos</p>
                                </motion.div>
                            ) : (
                                cart.map((item, index) => (
                                    <motion.div
                                        key={`${item.id}-${index}`}
                                        layout
                                        initial={{ opacity: 0, x: 24 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        // Sale por donde entró.
                                        exit={{ opacity: 0, x: 24 }}
                                        transition={SPRING}
                                        className="flex items-center gap-2.5 @md:gap-4 p-2 @md:p-3 rounded-xl
                                                   bg-slate-950/50 border border-white/10 hover:border-white/20
                                                   transition-colors reduce-transparency:bg-slate-950
                                                   flex-wrap @md:flex-nowrap"
                                    >
                                        <div className="w-11 h-11 @md:w-14 @md:h-14 rounded-lg bg-white/[0.07] overflow-hidden shrink-0 grid place-items-center">
                                            {item.imagenProducto ? (
                                                <img
                                                    src={item.imagenProducto}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Package className="w-5 h-5 text-slate-500" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-white truncate text-sm @md:text-base">{item.nombreProducto}</h4>
                                            <p className="text-xs text-slate-400 truncate">{item.marcaProducto}</p>
                                            <div className="text-[11px] text-slate-500 mt-0.5 font-mono tracking-[0.02em] truncate">{item.idProducto}</div>
                                        </div>

                                        {/* Estrecho: los controles bajan a su propia línea en lugar
                                            de comprimir el nombre hasta lo ilegible. */}
                                        <div className="flex items-center gap-2 @md:gap-3 w-full @md:w-auto justify-end shrink-0">
                                            <div className="flex items-center bg-slate-950 rounded-lg border border-white/10 h-10">
                                                <button
                                                    onClick={() => updateQuantity(index, -1)}
                                                    disabled={item.cantidad <= 1}
                                                    aria-label="Quitar una unidad"
                                                    className="w-10 h-full grid place-items-center rounded-l-lg text-slate-300
                                                               hover:text-white hover:bg-white/10 transition-colors
                                                               disabled:opacity-25 disabled:pointer-events-none"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <span className="w-8 text-center font-mono text-sm tabular-nums">{item.cantidad}</span>
                                                <button
                                                    onClick={() => updateQuantity(index, 1)}
                                                    aria-label="Añadir una unidad"
                                                    className="w-10 h-full grid place-items-center rounded-r-lg text-slate-300
                                                               hover:text-white hover:bg-white/10 transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="text-right min-w-[76px] @md:min-w-[88px] ml-auto @md:ml-0">
                                                <p className="font-bold text-white text-sm @md:text-base tabular-nums tracking-[-0.01em]">
                                                    {formatCLP(getLocalPrice(item) * item.cantidad)}
                                                </p>
                                                <p className="text-[11px] text-slate-500 tabular-nums tracking-[0.01em]">
                                                    {formatCLP(getLocalPrice(item))} c/u
                                                </p>
                                            </div>

                                            {/* Separado del ± : es el vecino destructivo */}
                                            <button
                                                onClick={() => removeFromCart(index)}
                                                aria-label={`Quitar ${item.nombreProducto}`}
                                                className={cn(
                                                    "ml-1 h-10 w-10 grid place-items-center rounded-lg text-slate-400",
                                                    "hover:text-red-400 hover:bg-red-500/10 transition-colors", PRESS
                                                )}
                                            >
                                                <Trash2 className="w-4 h-4 @md:w-5 @md:h-5" />
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