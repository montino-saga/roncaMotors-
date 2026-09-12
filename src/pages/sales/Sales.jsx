import { useState, useRef, useEffect, useMemo } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { collection, getDocs, getDoc, query, where, writeBatch, doc, Timestamp, updateDoc, orderBy } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Search, Trash2, ShoppingCart, CreditCard, Banknote, User, Package, Minus, Plus, AlertTriangle, FileText, Percent } from 'lucide-react'
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
    const [catalog, setCatalog] = useState([])
    const [activeIdx, setActiveIdx] = useState(0)
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

    const getListPrice = (item) => Number(item?.precioVentaLocal ?? item?.precioProducto ?? 0)
    // Un descuento vive en el ítem del carrito como precio unitario final, así
    // total, ganancia, boleta y cotización lo heredan sin tocar nada más.
    const getLocalPrice = (item) => item?.precioDescuento != null ? Number(item.precioDescuento) : getListPrice(item)

    // Descuento al total, aparte de los de cada ítem. Se guarda en CLP, no en %,
    // porque el vendedor pacta "te lo dejo en 10.000", no "un 7,3%".
    const [descuentoTotal, setDescuentoTotal] = usePersistedState('roncamotors_pos_discount', 0)

    const calculateSubtotal = () => cart.reduce((total, item) => total + (getLocalPrice(item) * item.cantidad), 0)
    const calculateTotal = () => Math.max(0, calculateSubtotal() - descuentoTotal)

    // Discount Modal State: índice del ítem, o 'total' para el carrito completo.
    const [discountIdx, setDiscountIdx] = useState(null)
    const [discountMode, setDiscountMode] = useState('pct')
    const [discountValue, setDiscountValue] = useState('')
    const esTotal = discountIdx === 'total'
    const discountItem = typeof discountIdx === 'number' ? cart[discountIdx] : null
    const discountOpen = esTotal || !!discountItem
    // Precio de referencia sobre el que se descuenta.
    const discountBase = esTotal ? calculateSubtotal() : discountItem ? getListPrice(discountItem) : 0
    const discountActual = esTotal ? descuentoTotal > 0 : discountItem?.precioDescuento != null
    const discountPreview = (() => {
        if (!discountOpen) return null
        const v = Number(discountValue)
        if (discountValue === '' || isNaN(v)) return null
        if (discountMode === 'pct') {
            if (v < 0 || v > 100) return null
            return Math.round(discountBase * (1 - v / 100))
        }
        return v >= 0 && v <= discountBase ? v : null
    })()

    const openDiscount = (target) => {
        setDiscountIdx(target)
        const actual = target === 'total'
            ? (descuentoTotal > 0 ? calculateSubtotal() - descuentoTotal : null)
            : cart[target]?.precioDescuento ?? null
        if (actual != null) {
            setDiscountMode('precio')
            setDiscountValue(String(actual))
        } else {
            setDiscountMode('pct')
            setDiscountValue('')
        }
    }

    const applyDiscount = (e) => {
        e.preventDefault()
        if (discountPreview == null || !discountOpen) return
        if (esTotal) {
            setDescuentoTotal(discountBase - discountPreview)
        } else {
            commitCart(cartRef.current.map((item, i) => {
                if (i !== discountIdx) return item
                if (discountPreview >= getListPrice(item)) {
                    const { precioDescuento: _omit, ...rest } = item
                    return rest
                }
                return { ...item, precioDescuento: discountPreview }
            }))
        }
        setDiscountIdx(null)
    }

    const clearDiscount = () => {
        if (esTotal) {
            setDescuentoTotal(0)
        } else {
            commitCart(cartRef.current.map((item, i) => {
                if (i !== discountIdx) return item
                const { precioDescuento: _omit, ...rest } = item
                return rest
            }))
        }
        setDiscountIdx(null)
    }

    // Sin carrito no hay a qué descontar; y si el carrito baja del descuento,
    // se recorta en vez de dejar un total negativo escondido.
    useEffect(() => {
        if (!cart.length && descuentoTotal) setDescuentoTotal(0)
        else if (descuentoTotal > calculateSubtotal()) setDescuentoTotal(calculateSubtotal())
    }, [cart]) // eslint-disable-line react-hooks/exhaustive-deps

    // Firestore no busca por subcadena: el catálogo vive en memoria y se filtra
    // aquí. El stock se relee del documento al agregar, así que da igual que
    // esta copia envejezca durante la sesión.
    useEffect(() => {
        getDocs(collection(db, 'productos'))
            .then(snap => setCatalog(snap.docs.map(d => ({ ...d.data(), id: d.id }))))
            .catch(err => console.error('Error cargando catálogo:', err))
    }, [])

    const term = productId.trim().toLowerCase()
    const suggestions = useMemo(() => {
        if (term.length < 2) return []
        // Coincidencia exacta de código = escaneo: no distraer con lista.
        if (catalog.some(p => p.idProducto?.toLowerCase() === term)) return []
        return catalog
            .filter(p =>
                p.nombreProducto?.toLowerCase().includes(term) ||
                p.idProducto?.toLowerCase().includes(term) ||
                p.marcaProducto?.toLowerCase().includes(term)
            )
            .slice(0, 8)
    }, [catalog, term])

    useEffect(() => { setActiveIdx(0) }, [term])

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
        if (!isStockModalOpen && !isDebtModalOpen && !discountOpen) {
            inputRef.current?.focus()
        }
    }, [cart, isStockModalOpen, isDebtModalOpen, discountOpen])

    // Escanear algo que cae fuera de la vista no confirma nada.
    useEffect(() => {
        const el = listRef.current
        if (!el) return
        el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
    }, [cart.length, reduce])

    const pushToCart = (productData) => {
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
    }

    // `code` es el escaneo/tecleo; `picked` la sugerencia elegida (si la hay).
    const addProduct = async (code, picked) => {
        // El evento causal es el escaneo, no la respuesta de Firestore: el
        // acuse suena ahora y la caja queda libre para el siguiente código.
        sounds.playScan()
        setProductId('')
        setLoading(true)

        try {
            let productData = null
            if (code) {
                const q = query(collection(db, 'productos'), where('idProducto', '==', code))
                const querySnapshot = await getDocs(q)
                if (!querySnapshot.empty) {
                    const docSnapshot = querySnapshot.docs[0]
                    productData = { ...docSnapshot.data(), id: docSnapshot.id }
                }
            }
            if (!productData && picked) {
                const snap = await getDoc(doc(db, 'productos', picked.id))
                if (snap.exists()) productData = { ...snap.data(), id: snap.id }
            }

            if (!productData) {
                toast.error('Producto no encontrado', { description: code })
                sounds.playError()
                return
            }
            pushToCart(productData)
        } catch (error) {
            console.error("Error searching product:", error)
            toast.error('Error al buscar producto')
            sounds.playError()
        } finally {
            setLoading(false)
        }
    }

    const addToCart = (e) => {
        e.preventDefault()
        const code = productId.trim()
        if (!code) return
        addProduct(code, suggestions[activeIdx] ?? suggestions[0])
    }

    const onSearchKeyDown = (e) => {
        if (!suggestions.length) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIdx(i => (i + 1) % suggestions.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length)
        } else if (e.key === 'Escape') {
            setProductId('')
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

    const calculateProfit = () => {
        return cart.reduce((total, item) => {
            const cost = item.precioOriginal || 0
            const price = getLocalPrice(item)
            return total + ((price - cost) * item.cantidad)
        }, 0) - Math.min(descuentoTotal, calculateSubtotal())
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
                    precioLista: Number(getListPrice(item)),
                    descuento: Number(getListPrice(item) - getLocalPrice(item)),
                    precioVentaWeb: Number(item.precioVentaWeb || 0),
                    precioProducto: Number(getLocalPrice(item)),
                    precioOriginal: Number(item.precioOriginal || 0),
                    cantidadProducto: Number(item.cantidadProducto || 0),
                    cantidad: item.cantidad
                })),
                tipoPago: paymentType,
                subtotal: calculateSubtotal(),
                descuentoTotal: Number(descuentoTotal) || 0,
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
                    precioLista: Number(getListPrice(item)),
                    descuento: Number(getListPrice(item) - getLocalPrice(item)),
                    precioVentaWeb: Number(item.precioVentaWeb || 0),
                    precioProducto: Number(getLocalPrice(item)),
                    precioOriginal: Number(item.precioOriginal || 0),
                    cantidadProducto: Number(item.cantidadProducto || 0),
                    cantidad: item.cantidad
                })),
                tipoPago: 'fiado',
                subtotal: calculateSubtotal(),
                descuentoTotal: Number(descuentoTotal) || 0,
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
                descuento: descuentoTotal,
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
                isOpen={discountOpen}
                onClose={() => setDiscountIdx(null)}
                title={esTotal ? 'Descuento al total' : 'Descuento'}
            >
                {discountOpen && (
                    <form className="space-y-4" onSubmit={applyDiscount}>
                        <p className="text-slate-200">
                            {esTotal ? (
                                <>
                                    <span className="font-semibold text-white">Toda la venta</span>
                                    <span className="text-slate-400"> · subtotal {formatCLP(discountBase)}</span>
                                </>
                            ) : (
                                <>
                                    <span className="font-semibold text-white">{discountItem.nombreProducto}</span>
                                    <span className="text-slate-400"> · lista {formatCLP(discountBase)} c/u</span>
                                </>
                            )}
                        </p>

                        <div className="flex rounded-lg bg-slate-950 border border-white/10 p-0.5" role="group">
                            {[['pct', '% de descuento'], ['precio', esTotal ? 'Total final' : 'Precio final c/u']].map(([k, txt]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => { setDiscountMode(k); setDiscountValue('') }}
                                    aria-pressed={discountMode === k}
                                    className={cn(
                                        "flex-1 h-9 text-xs font-medium rounded-md transition-colors", PRESS,
                                        discountMode === k ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                                    )}
                                >
                                    {txt}
                                </button>
                            ))}
                        </div>

                        {discountMode === 'pct' ? (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        inputMode="numeric"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        placeholder="10"
                                        className="h-12 text-lg pr-10 font-bold"
                                        autoFocus
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">%</span>
                                </div>
                                <div className="flex gap-1.5">
                                    {[5, 10, 15, 20, 30].map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => setDiscountValue(String(v))}
                                            className={cn(
                                                "flex-1 h-8 rounded-md text-xs font-medium transition-colors", PRESS,
                                                String(v) === discountValue ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                            )}
                                        >
                                            {v}%
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <CurrencyInput
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                placeholder={formatCLP(discountBase)}
                                className="h-12 text-lg font-bold"
                                autoFocus
                            />
                        )}

                        <div className="rounded-lg px-3 py-2 border border-white/10 bg-slate-950/50 text-sm tabular-nums">
                            {discountPreview != null ? (
                                <>
                                    <div className="flex justify-between gap-2">
                                        <span className="text-slate-400">Queda en</span>
                                        <span className="font-bold text-amber-300">{formatCLP(discountPreview)}{esTotal ? '' : ' c/u'}</span>
                                    </div>
                                    <div className="flex justify-between gap-2 mt-1 text-xs text-slate-500">
                                        <span>
                                            −{formatCLP(discountBase - discountPreview)} ·
                                            {' '}{discountBase > 0 ? Math.round((1 - discountPreview / discountBase) * 100) : 0}%
                                        </span>
                                        {!esTotal && (
                                            <span>× {discountItem.cantidad} = {formatCLP(discountPreview * discountItem.cantidad)}</span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <span className="text-slate-500 text-xs">
                                    {discountMode === 'pct' ? 'Entre 0 y 100%' : esTotal ? 'Un total menor o igual al subtotal' : 'Un precio menor o igual al de lista'}
                                </span>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {discountActual && (
                                <Button type="button" variant="secondary" onClick={clearDiscount} className="flex-1">
                                    Quitar descuento
                                </Button>
                            )}
                            <Button type="submit" disabled={discountPreview == null} className="flex-1">
                                Aplicar
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

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
                                onKeyDown={onSearchKeyDown}
                                placeholder="Escanear o buscar por nombre..."
                                className="pl-10 h-12 text-lg"
                                autoComplete="off"
                                role="combobox"
                                aria-expanded={suggestions.length > 0}
                                aria-controls="pos-sugerencias"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            {loading && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full
                                                 border-2 border-white/20 border-t-white/80 animate-spin
                                                 motion-reduce:animate-none" />
                            )}
                            {suggestions.length > 0 && (
                                <ul
                                    id="pos-sugerencias"
                                    role="listbox"
                                    className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-y-auto
                                               rounded-xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50
                                               reduce-transparency:bg-slate-950"
                                >
                                    {suggestions.map((p, i) => (
                                        <li
                                            key={p.id}
                                            role="option"
                                            aria-selected={i === activeIdx}
                                            // mousedown: el click normal llega tras el blur del input.
                                            onMouseDown={(e) => { e.preventDefault(); addProduct('', p) }}
                                            onMouseEnter={() => setActiveIdx(i)}
                                            className={cn(
                                                "flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer text-sm",
                                                i === activeIdx ? "bg-primary/20 text-white" : "text-slate-300 hover:bg-white/5"
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{p.nombreProducto}</p>
                                                <p className="text-xs text-slate-400 truncate">
                                                    {p.idProducto}{p.marcaProducto ? ` · ${p.marcaProducto}` : ''}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 tabular-nums">
                                                <p className="font-semibold text-emerald-400">{formatCLP(getLocalPrice(p))}</p>
                                                <p className={cn("text-xs", p.cantidadProducto < 1 ? "text-red-400" : "text-slate-400")}>
                                                    Stock: {p.cantidadProducto ?? 0}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
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
                            <div className="text-right lg:text-left min-w-0">
                                {descuentoTotal > 0 && (
                                    <p className="text-[11px] text-slate-500 tabular-nums line-through truncate">
                                        {formatCLP(calculateSubtotal())}
                                    </p>
                                )}
                                <p className={cn("text-2xl lg:text-4xl font-bold tracking-[-0.02em] tabular-nums truncate",
                                    descuentoTotal > 0 ? "text-amber-300" : "text-emerald-400")}>
                                    {formatCLP(calculateTotal())}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => openDiscount('total')}
                            disabled={!cart.length}
                            aria-pressed={descuentoTotal > 0}
                            className={cn(
                                "w-full min-h-[52px] lg:min-h-[60px] px-4 flex items-center justify-center gap-2.5 rounded-xl border-2",
                                "text-base lg:text-lg font-bold transition-colors", PRESS,
                                "disabled:opacity-30 disabled:pointer-events-none",
                                descuentoTotal > 0
                                    ? "bg-amber-500/20 border-amber-500 text-amber-200 shadow-lg shadow-amber-500/10"
                                    : "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500"
                            )}
                        >
                            <Percent className="w-5 h-5 lg:w-6 lg:h-6 shrink-0" />
                            {descuentoTotal > 0
                                ? `Descuento aplicado: −${formatCLP(descuentoTotal)}`
                                : 'Aplicar descuento al total'}
                        </button>

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
                                            <div className="text-right min-w-[84px] @md:min-w-[104px]">
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500">Precio c/u</p>
                                                {item.precioDescuento != null && (
                                                    <p className="text-[11px] text-slate-500 tabular-nums line-through leading-none">
                                                        {formatCLP(getListPrice(item))}
                                                    </p>
                                                )}
                                                <p className={cn("font-bold text-base @md:text-xl tabular-nums tracking-[-0.01em]",
                                                    item.precioDescuento != null ? "text-amber-300" : "text-white")}>
                                                    {formatCLP(getLocalPrice(item))}
                                                </p>
                                            </div>

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

                                            <div className="text-right min-w-[84px] @md:min-w-[104px]">
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500">Subtotal</p>
                                                <p className={cn("font-bold text-base @md:text-xl tabular-nums tracking-[-0.01em]",
                                                    item.precioDescuento != null ? "text-amber-300" : "text-emerald-400")}>
                                                    {formatCLP(getLocalPrice(item) * item.cantidad)}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => openDiscount(index)}
                                                aria-label={`Descuento para ${item.nombreProducto}`}
                                                aria-pressed={item.precioDescuento != null}
                                                className={cn(
                                                    "h-10 w-12 @md:w-14 grid place-items-center rounded-lg border-2 transition-colors", PRESS,
                                                    item.precioDescuento != null
                                                        ? "text-amber-200 bg-amber-500/25 border-amber-500"
                                                        : "text-amber-300 bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 hover:border-amber-500"
                                                )}
                                            >
                                                <Percent className="w-5 h-5 @md:w-6 @md:h-6" />
                                            </button>

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