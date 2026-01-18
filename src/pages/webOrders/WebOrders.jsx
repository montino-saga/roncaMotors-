import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Eye, Calendar, Globe, CreditCard, Banknote, Package, Clock } from 'lucide-react'
import { cn, formatCLP } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'

function WebOrders() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const getLocalPrice = (prod) => Number(prod?.precioVentaLocal ?? prod?.precioProducto ?? 0)

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
        // Real-time listener for web orders
        const q = query(
            collection(db, 'salesWeb'),
            orderBy('fechaVenta', 'desc')
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ordersData = []
            snapshot.forEach((doc) => {
                ordersData.push({ id: doc.id, ...doc.data() })
            })
            setOrders(ordersData)
            setLoading(false)
        }, (error) => {
            console.error("Error fetching web orders:", error)
            setLoading(false)
        })

        return () => unsubscribe()
    }, [])

    const handleViewDetails = (order) => {
        setSelectedOrder(order)
        setIsModalOpen(true)
    }

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-5 w-48" />
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Globe className="w-8 h-8 text-primary" />
                        Pedidos Web
                    </h2>
                    <p className="text-slate-400">Pedidos recibidos desde la página web.</p>
                </div>
            </div>

            <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-4 font-medium text-slate-300">Fecha</th>
                                <th className="p-4 font-medium text-slate-300">ID Pedido</th>
                                <th className="p-4 font-medium text-slate-300">Cliente</th>
                                <th className="p-4 font-medium text-slate-300">Estado</th>
                                <th className="p-4 font-medium text-slate-300 text-right">Total</th>
                                <th className="p-4 font-medium text-slate-300 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        No hay pedidos web registrados.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-slate-500" />
                                                {formatDate(order.fechaVenta)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 font-mono text-xs">
                                            {order.id.slice(0, 8)}...
                                        </td>
                                        <td className="p-4 text-slate-300">
                                            {order.cliente?.nombre || 'Cliente Web'}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize",
                                                order.estado === 'completado'
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                            )}>
                                                {order.estado || 'pendiente'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-emerald-400 text-right">
                                            {formatCLP(order.totalVenta)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleViewDetails(order)}
                                                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                title="Ver Detalle"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Order Details Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Detalle de Pedido Web #${selectedOrder?.id.slice(0, 8)}`}
                className="max-w-2xl"
            >
                {selectedOrder && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                <p className="text-slate-400 mb-1">Fecha</p>
                                <p className="text-white font-medium">{formatDate(selectedOrder.fechaVenta)}</p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                <p className="text-slate-400 mb-1">Método de Pago</p>
                                <p className="text-white font-medium capitalize flex items-center gap-2">
                                    {selectedOrder.tipoPago === 'efectivo' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                    {selectedOrder.tipoPago}
                                </p>
                            </div>
                        </div>

                        {selectedOrder.cliente && (
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <h4 className="text-sm font-medium text-slate-300 mb-2">Información del Cliente</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <p className="text-slate-400">Nombre: <span className="text-white">{selectedOrder.cliente.nombre}</span></p>
                                    <p className="text-slate-400">Email: <span className="text-white">{selectedOrder.cliente.email}</span></p>
                                    {selectedOrder.cliente.telefono && (
                                        <p className="text-slate-400">Teléfono: <span className="text-white">{selectedOrder.cliente.telefono}</span></p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="text-sm font-medium text-slate-300 mb-3">Productos</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {selectedOrder.productos.map((prod, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                                                <Package className="w-5 h-5 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{prod.nombreProducto}</p>
                                                <p className="text-xs text-slate-400">
                                                    {prod.cantidad} x {formatCLP(getLocalPrice(prod))}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-white font-medium">
                                            {formatCLP(prod.cantidad * getLocalPrice(prod))}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                            <p className="text-slate-400">Total Pedido</p>
                            <p className="text-2xl font-bold text-emerald-400">{formatCLP(selectedOrder.totalVenta)}</p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default WebOrders
