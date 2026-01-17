import { useState, useRef, useEffect } from 'react'
import { collection, getDocs, query, where, writeBatch, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Search, Trash2, ShoppingCart, DollarSign, CreditCard, Banknote } from 'lucide-react'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

function Sales() {
    const [cart, setCart] = useState([])
    const [productId, setProductId] = useState('')
    const [loading, setLoading] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [paymentType, setPaymentType] = useState('efectivo')
    const inputRef = useRef(null)

    // Stock Adjustment Modal State
    const [isStockModalOpen, setIsStockModalOpen] = useState(false)
    const [pendingProduct, setPendingProduct] = useState(null)
    const [newStockValue, setNewStockValue] = useState('')
    const [updatingStock, setUpdatingStock] = useState(false)

    // Focus input on mount and after adding product
    useEffect(() => {
        if (!isStockModalOpen) {
            inputRef.current?.focus()
        }
    }, [cart, isStockModalOpen])

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
                }
                setProductId('')
            } else {
                toast.error('Producto no encontrado')
            }
        } catch (error) {
            console.error("Error searching product:", error)
            toast.error('Error al buscar producto')
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
        return cart.reduce((total, item) => total + (item.precioProducto * item.cantidad), 0)
    }

    const calculateProfit = () => {
        return cart.reduce((total, item) => {
            const cost = item.precioOriginal || 0
            const price = item.precioProducto || 0
            return total + ((price - cost) * item.cantidad)
        }, 0)
    }

    const handleCheckout = async () => {
        if (cart.length === 0) return

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
                    precioProducto: Number(item.precioProducto),
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

            toast.success('Venta realizada con éxito', {
                description: `Total: $${saleData.totalVenta.toLocaleString()} - Pago: ${paymentType}`,
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

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6">
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

            {/* Left Side: Input & Product Entry */}
            <div className="w-full md:w-1/3 flex flex-col gap-6">
                <Card className="flex-1 flex flex-col p-6">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-blue-400" />
                        Punto de Venta
                    </h2>

                    <form onSubmit={addToCart} className="mb-8">
                        <div className="relative">
                            <Input
                                ref={inputRef}
                                value={productId}
                                onChange={(e) => setProductId(e.target.value)}
                                placeholder="Escanear o ingresar ID..."
                                className="pl-10 h-14 text-lg"
                                disabled={loading || processing}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        </div>
                        <Button
                            type="submit"
                            className="w-full mt-4 h-12 text-lg"
                            disabled={loading || processing || !productId}
                        >
                            {loading ? 'Buscando...' : 'Agregar Producto'}
                        </Button>
                    </form>

                    <div className="mt-auto space-y-4">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <p className="text-slate-400 text-sm mb-1">Total a Pagar</p>
                            <p className="text-4xl font-bold text-emerald-400">${calculateTotal().toLocaleString()}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPaymentType('efectivo')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border transition-all",
                                    paymentType === 'efectivo'
                                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                )}
                            >
                                <Banknote className="w-6 h-6 mb-2" />
                                <span className="text-sm font-medium">Efectivo</span>
                            </button>
                            <button
                                onClick={() => setPaymentType('tarjeta')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border transition-all",
                                    paymentType === 'tarjeta'
                                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                )}
                            >
                                <CreditCard className="w-6 h-6 mb-2" />
                                <span className="text-sm font-medium">Tarjeta</span>
                            </button>
                        </div>

                        <Button
                            onClick={handleCheckout}
                            className="w-full h-14 text-xl font-bold bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                            disabled={cart.length === 0 || processing}
                        >
                            {processing ? 'Procesando...' : 'Finalizar Venta'}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Right Side: Cart List */}
            <div className="w-full md:w-2/3">
                <Card className="h-full flex flex-col p-0 overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h3 className="font-medium text-slate-300">Productos en Carrito ({cart.reduce((acc, item) => acc + item.cantidad, 0)})</h3>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCart([])}
                            disabled={cart.length === 0}
                            className="text-xs h-8"
                        >
                            Limpiar Todo
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                                <ShoppingCart className="w-16 h-16 mb-4" />
                                <p className="text-lg">El carrito está vacío</p>
                                <p className="text-sm">Escanea un producto para comenzar</p>
                            </div>
                        ) : (
                            cart.map((item, index) => (
                                <div key={index} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 group hover:border-white/20 transition-colors">
                                    <div className="w-16 h-16 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                                        <img
                                            src={item.imagenProducto || 'https://via.placeholder.com/64'}
                                            alt={item.nombreProducto}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-white truncate">{item.nombreProducto}</h4>
                                        <p className="text-sm text-slate-400">{item.marcaProducto}</p>
                                        <div className="text-xs text-slate-500 mt-1 font-mono">{item.idProducto}</div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center bg-slate-900 rounded-lg border border-white/10">
                                            <button
                                                onClick={() => updateQuantity(index, -1)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-l-lg transition-colors"
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-mono text-sm">{item.cantidad}</span>
                                            <button
                                                onClick={() => updateQuantity(index, 1)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-r-lg transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>

                                        <div className="text-right min-w-[80px]">
                                            <p className="font-bold text-white">${(item.precioProducto * item.cantidad).toLocaleString()}</p>
                                            <p className="text-xs text-slate-500">${item.precioProducto} c/u</p>
                                        </div>

                                        <button
                                            onClick={() => removeFromCart(index)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default Sales
