import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Search, Plus, User, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { formatCLP, cn } from '../../lib/utils'

function Clients() {
    const navigate = useNavigate()
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    
    // New Client State
    const [newClientName, setNewClientName] = useState('')
    const [newClientPhone, setNewClientPhone] = useState('')
    const [creatingClient, setCreatingClient] = useState(false)

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
                            onClick={() => navigate(`/clientes/${client.id}`)}
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
        </div>
    )
}

export default Clients