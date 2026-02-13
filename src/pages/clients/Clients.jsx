import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, where, Timestamp, writeBatch, getDoc } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Search, Plus, User, Phone, DollarSign, Calendar, Trash2, History, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { formatCLP, cn } from '../../lib/utils'

function Clients() {
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    
    // New Client State
    const [newClientName, setNewClientName] = useState('')
    const [newClientPhone, setNewClientPhone] = useState('')
    const [creatingClient, setCreatingClient] = useState(false)

    // Selected Client State
    const [selectedClient, setSelectedClient] = useState(null)
    const [clientMovements, setClientMovements] = useState([])
    const [loadingMovements, setLoadingMovements] = useState(false)

    // Payment State
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('efectivo') // 'efectivo' | 'tarjeta'
    const [processingPayment, setProcessingPayment] = useState(false)

    const fetchClients = async () => {
        setLoading(true)
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
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchClients()
    }, [])

    const handleCreateClient = async (e) => {
        e.preventDefault()
        if (!newClientName.trim()) return

        setCreatingClient(true)
        try {
            await addDoc(collection(db, 'clients'), {
                name: newClientName,
                phone: newClientPhone,
                currentDebt: 0,
                createdAt: Timestamp.now()
            })
            toast.success('Cliente creado correctamente')
            setIsCreateModalOpen(false)
            setNewClientName('')
            setNewClientPhone('')
            fetchClients()
        } catch (error) {
            console.error("Error creating client:", error)
            toast.error('Error al crear cliente')
        } finally {
            setCreatingClient(false)
        }
    }

    const openClientDetails = async (client) => {
        setSelectedClient(client)
        setIsDetailModalOpen(true)
        setLoadingMovements(true)
        try {
            // Fetch movements from subcollection 'movements'
            const q = query(
                collection(db, `clients/${client.id}/movements`),
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
        if (!selectedClient || !paymentAmount || Number(paymentAmount) <= 0) return

        setProcessingPayment(true)
        try {
            const amount = Number(paymentAmount)
            const batch = writeBatch(db)

            // 1. Create movement
            const movementRef = doc(collection(db, `clients/${selectedClient.id}/movements`))
            batch.set(movementRef, {
                type: 'payment',
                amount: amount,
                paymentMethod: paymentMethod, // Guardamos el método de pago
                date: Timestamp.now(),
                note: `Abono (${paymentMethod})`
            })

            // 2. Update client debt
            const clientRef = doc(db, 'clients', selectedClient.id)
            const newDebt = (selectedClient.currentDebt || 0) - amount
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
                    nombreProducto: `Abono Cliente: ${selectedClient.name}`,
                    cantidad: 1,
                    precioVentaLocal: amount,
                    precioProducto: amount,
                    precioOriginal: 0,
                    cantidadProducto: 0,
                    esAbono: true
                }],
                tipoPago: paymentMethod, // Usamos el método seleccionado: 'efectivo' o 'tarjeta'
                totalVenta: amount,
                totalGanancia: 0,
                idCliente: selectedClient.id,
                nombreCliente: selectedClient.name,
                isAbono: true
            }
            batch.set(saleRef, saleData)

            await batch.commit()

            toast.success('Abono registrado correctamente')
            setIsPaymentModalOpen(false)
            setPaymentAmount('')
            
            // Refresh local state
            const updatedClient = { ...selectedClient, currentDebt: newDebt }
            setSelectedClient(updatedClient)
            openClientDetails(updatedClient) // Refresh movements
            fetchClients() // Refresh list
        } catch (error) {
            console.error("Error processing payment:", error)
            toast.error('Error al registrar abono')
        } finally {
            setProcessingPayment(false)
        }
    }

    const filteredClients = clients.filter(client => 
        client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm)
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Clientes & Deudores</h2>
                    <p className="text-slate-400 text-sm">Gestiona perfiles y cuentas corrientes.</p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nuevo Cliente
                </Button>
            </div>

            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre o teléfono..."
                        className="pl-9 bg-slate-900/50"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <p className="text-slate-400">Cargando clientes...</p>
                ) : filteredClients.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white/5 rounded-xl border border-white/10 border-dashed">
                        <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        <p className="text-slate-400">No se encontraron clientes.</p>
                    </div>
                ) : (
                    filteredClients.map(client => (
                        <Card 
                            key={client.id} 
                            className="hover:border-primary/50 cursor-pointer transition-colors group"
                            onClick={() => openClientDetails(client)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                        {client.name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white group-hover:text-primary transition-colors">{client.name}</h3>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <Phone className="w-3 h-3" />
                                            {client.phone || 'Sin teléfono'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-slate-950/50 rounded-lg p-3 flex justify-between items-center">
                                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Deuda Actual</span>
                                <span className={cn(
                                    "text-lg font-bold font-mono",
                                    client.currentDebt > 0 ? "text-red-400" : "text-emerald-400"
                                )}>
                                    {formatCLP(client.currentDebt || 0)}
                                </span>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Create Client Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Nuevo Cliente"
            >
                <form onSubmit={handleCreateClient} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nombre Completo</label>
                        <Input
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder="Ej: Juan Pérez"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Teléfono (Opcional)</label>
                        <Input
                            value={newClientPhone}
                            onChange={(e) => setNewClientPhone(e.target.value)}
                            placeholder="Ej: +56 9 1234 5678"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={creatingClient || !newClientName}>
                            {creatingClient ? 'Guardando...' : 'Crear Cliente'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Client Details Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title={selectedClient?.name ? selectedClient.name.charAt(0).toUpperCase() + selectedClient.name.slice(1) : 'Detalle Cliente'}
                className="max-w-4xl"
            >
                {selectedClient && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-white/10">
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Deuda Total</p>
                                <p className={cn(
                                    "text-3xl font-bold",
                                    selectedClient.currentDebt > 0 ? "text-red-400" : "text-emerald-400"
                                )}>
                                    {formatCLP(selectedClient.currentDebt || 0)}
                                </p>
                            </div>
                            <Button 
                                onClick={() => setIsPaymentModalOpen(true)}
                                disabled={selectedClient.currentDebt <= 0}
                                className={cn(selectedClient.currentDebt <= 0 && "opacity-50")}
                            >
                                <DollarSign className="w-4 h-4 mr-2" />
                                Registrar Abono
                            </Button>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Historial de Movimientos
                            </h4>
                            <div className="bg-slate-950 rounded-xl border border-white/10 overflow-hidden max-h-[500px] overflow-y-auto custom-scrollbar">
                                {loadingMovements ? (
                                    <div className="p-8 text-center text-slate-500">Cargando movimientos...</div>
                                ) : clientMovements.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">Sin movimientos registrados.</div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white/5 text-slate-400 font-medium sticky top-0 z-10 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-4 py-3">Fecha y Hora</th>
                                                <th className="px-4 py-3">Tipo</th>
                                                <th className="px-4 py-3 w-[45%]">Detalle de Productos / Nota</th>
                                                <th className="px-4 py-3 text-right">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {clientMovements.map((mov) => (
                                                <tr key={mov.id} className="hover:bg-white/5 group">
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
                                                    <td className="px-4 py-3 text-slate-300 align-top">
                                                        {mov.products && mov.products.length > 0 ? (
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
                                                        )}
                                                    </td>
                                                    <td className={cn(
                                                        "px-4 py-3 text-right font-mono font-medium text-lg align-top",
                                                        mov.type === 'purchase' ? "text-red-400" : "text-emerald-400"
                                                    )}>
                                                        {mov.type === 'purchase' ? '+' : '-'}{formatCLP(mov.amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
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
                        Ingresa el monto que el cliente <span className="font-bold text-white">{selectedClient?.name}</span> está pagando.
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

export default Clients