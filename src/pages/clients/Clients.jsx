import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { usePermisos, TITULO_SOLO_LECTURA } from '../../hooks/usePermisos'
import { invalidarClientes } from '../../lib/clientes'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Search, Plus, User, Phone, Mail, IdCard, Car, Users, AlertCircle, DollarSign, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { formatCLP, cn } from '../../lib/utils'
import { formatRut, validarRut } from '../../lib/rut'
import { formatPatente, limpiarPatente, validarPatente } from '../../lib/patente'
import { resumenVehiculo } from '../../lib/vehiculo'

function Clients() {
    const { soloLectura } = usePermisos()
    const navigate = useNavigate()
    // /clientes?nuevo=1 (acción de la barra móvil): abre el alta y limpia la URL.
    const [searchParams, setSearchParams] = useSearchParams()
    const abrirDesdeUrl = searchParams.get('nuevo') === '1'
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const mostrarSkeleton = useDelayedLoading(loading)
    const [searchTerm, setSearchTerm] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(abrirDesdeUrl && !soloLectura)
    useEffect(() => {
        if (abrirDesdeUrl) setSearchParams({}, { replace: true })
    }, [abrirDesdeUrl, setSearchParams])
    
    // New Client State
    const [newClientName, setNewClientName] = useState('')
    const [newClientPhone, setNewClientPhone] = useState('')
    const [newClientEmail, setNewClientEmail] = useState('')
    const [newClientRut, setNewClientRut] = useState('')
    const [rutTocado, setRutTocado] = useState(false)
    const [newClientPatente, setNewClientPatente] = useState('')
    const [patenteTocada, setPatenteTocada] = useState(false)
    const [creatingClient, setCreatingClient] = useState(false)

    const rutInvalido = newClientRut.trim() !== '' && !validarRut(newClientRut)
    const patenteInvalida = newClientPatente.trim() !== '' && !validarPatente(newClientPatente)

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
        if (rutInvalido) {
            setRutTocado(true)
            toast.error('RUT inválido')
            return
        }
        if (patenteInvalida) {
            setPatenteTocada(true)
            toast.error('Patente inválida')
            return
        }

        setCreatingClient(true)
        try {
            await addDoc(collection(db, 'clients'), {
                name: newClientName,
                phone: newClientPhone,
                email: newClientEmail.trim(),
                rut: formatRut(newClientRut),
                patente: formatPatente(newClientPatente),
                currentDebt: 0,
                createdAt: Timestamp.now()
            })
            toast.success('Cliente creado correctamente')
            setIsCreateModalOpen(false)
            invalidarClientes()
            setNewClientName('')
            setNewClientPhone('')
            setNewClientEmail('')
            setNewClientRut('')
            setRutTocado(false)
            setNewClientPatente('')
            setPatenteTocada(false)
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
        client.phone?.includes(searchTerm) ||
        client.rut?.replace(/\./g, '').includes(searchTerm.replace(/\./g, '').toUpperCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (searchTerm.trim() !== '' && limpiarPatente(client.patente).includes(limpiarPatente(searchTerm)))
    )

    const deudores = clients.filter(c => (c.currentDebt || 0) > 0)
    const deudaTotal = deudores.reduce((acc, c) => acc + c.currentDebt, 0)
    // Deuda negativa = el cliente pagó de más y tiene saldo a favor.
    const saldoFavor = clients.reduce((acc, c) => acc + ((c.currentDebt || 0) < 0 ? -c.currentDebt : 0), 0)

    const stats = [
        { label: 'Clientes', value: clients.length, Icon: Users, tone: 'bg-blue-500/20 text-blue-400' },
        { label: 'Con deuda', value: deudores.length, Icon: AlertCircle, tone: 'bg-amber-500/20 text-amber-400', color: deudores.length ? 'text-amber-400' : 'text-white' },
        { label: 'Deuda total', value: formatCLP(deudaTotal), Icon: DollarSign, tone: 'bg-red-500/20 text-red-400', color: deudaTotal > 0 ? 'text-red-400' : 'text-emerald-400' },
        { label: 'Saldo a favor', value: formatCLP(saldoFavor), Icon: Wallet, tone: 'bg-emerald-500/20 text-emerald-400', color: 'text-emerald-400' },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-white">Clientes & Deudores</h2>
                    <p className="text-slate-400 text-sm hidden sm:block">Gestiona perfiles y cuentas corrientes.</p>
                </div>
                <Button
                    data-tour="clientes-nuevo"
                    onClick={() => setIsCreateModalOpen(true)}
                    disabled={soloLectura}
                    title={soloLectura ? TITULO_SOLO_LECTURA : undefined}
                    className="h-11 px-4 sm:px-5 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 font-bold"
                >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Nuevo Cliente</span>
                    <span className="sm:hidden">Nuevo</span>
                </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {stats.map(({ label, value, Icon, tone, color }) => (
                    <Card key={label} className="p-4 bg-slate-900/50 border-white/10">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg shrink-0", tone)}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold truncate">{label}</p>
                                <p className={cn("text-xl font-bold font-mono tabular-nums truncate", color || 'text-white')}>
                                    {loading ? '…' : value}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div data-tour="clientes-buscar" className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre, teléfono, RUT, patente o correo..."
                        className="pl-9 bg-slate-900/50"
                    />
                </div>
            </div>

            <div data-tour="clientes-lista" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    mostrarSkeleton && Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} lines={2} className="p-6" />)
                ) : filteredClients.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white/5 rounded-xl border border-white/10 border-dashed">
                        <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        {searchTerm ? (
                            <>
                                <p className="text-slate-400">Ningún cliente coincide con «{searchTerm}».</p>
                                <Button variant="secondary" onClick={() => setSearchTerm('')} className="mt-4 h-10 text-sm">
                                    Limpiar búsqueda
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-slate-400">Aún no hay clientes.</p>
                                {!soloLectura && <Button onClick={() => setIsCreateModalOpen(true)} className="mt-4 h-10 text-sm inline-flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    Crear el primero
                                </Button>}
                            </>
                        )}
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
                                        {client.rut && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                                                <IdCard className="w-3 h-3" />
                                                {client.rut}
                                            </div>
                                        )}
                                        {client.patente && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                                                <Car className="w-3 h-3" />
                                                {client.patente}
                                                {client.vehiculo && (
                                                    <span className="font-sans text-slate-500 truncate">
                                                        · {resumenVehiculo(client.vehiculo)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
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
                            type="tel"
                            inputMode="numeric"
                            value={newClientPhone}
                            onChange={(e) => setNewClientPhone(e.target.value.replace(/[^0-9+ ]/g, ''))}
                            placeholder="Ej: +56 9 1234 5678"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">RUT (Opcional)</label>
                            <Input
                                inputMode="text"
                                value={newClientRut}
                                onChange={(e) => setNewClientRut(e.target.value.replace(/[^0-9kK.-]/g, ''))}
                                onBlur={() => {
                                    setNewClientRut(formatRut(newClientRut))
                                    setRutTocado(true)
                                }}
                                placeholder="12.345.678-9"
                                className={cn("font-mono", rutTocado && rutInvalido && "border-red-500/60 focus:ring-red-500/40")}
                                aria-invalid={rutTocado && rutInvalido}
                            />
                            {rutTocado && rutInvalido && (
                                <p className="text-xs text-red-400">RUT inválido</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Patente (Opcional)</label>
                            <Input
                                value={newClientPatente}
                                onChange={(e) => setNewClientPatente(e.target.value.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase())}
                                onBlur={() => {
                                    setNewClientPatente(formatPatente(newClientPatente))
                                    setPatenteTocada(true)
                                }}
                                placeholder="ABCD-12"
                                className={cn("font-mono uppercase", patenteTocada && patenteInvalida && "border-red-500/60 focus:ring-red-500/40")}
                                aria-invalid={patenteTocada && patenteInvalida}
                            />
                            {patenteTocada && patenteInvalida && (
                                <p className="text-xs text-red-400">Patente inválida</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Correo (Opcional)</label>
                        <Input
                            type="email"
                            inputMode="email"
                            value={newClientEmail}
                            onChange={(e) => setNewClientEmail(e.target.value)}
                            placeholder="cliente@correo.cl"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={soloLectura || creatingClient || !newClientName}>
                            {creatingClient ? 'Guardando...' : 'Crear Cliente'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Clients