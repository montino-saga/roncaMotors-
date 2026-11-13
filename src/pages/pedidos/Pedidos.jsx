import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { toast } from 'sonner'
import { ClipboardList, Plus, Search, ChevronRight } from 'lucide-react'
import { db } from '../../db/firebase'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { SkeletonHeader, SkeletonKpis, SkeletonRows } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { usePermisos, TITULO_SOLO_LECTURA } from '../../hooks/usePermisos'
import { cargarClientes } from '../../lib/clientes'
import { cn, formatCLP } from '../../lib/utils'
import { ESTADOS, filtrarPedidos, resumenPedidos, saldoDe } from '../../lib/pedidos'
import { NuevoPedido } from './NuevoPedido'
import { DetallePedido } from './DetallePedido'

const FILTROS = [
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'entregado', label: 'Entregados' },
    { id: 'cancelado', label: 'Cancelados' },
    { id: '', label: 'Todos' },
]

function Pedidos() {
    const { soloLectura } = usePermisos()
    const { user } = useAuth()
    const [pedidos, setPedidos] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [errorCarga, setErrorCarga] = useState(false)
    const mostrarSkeleton = useDelayedLoading(loading)
    const [estado, setEstado] = useState('pendiente')
    const [busqueda, setBusqueda] = useState('')
    const [nuevo, setNuevo] = useState(false)
    const [abiertoId, setAbiertoId] = useState(null)

    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'pedidos'), orderBy('creadoEn', 'desc')),
            (snap) => { setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setErrorCarga(false); setLoading(false) },
            (error) => {
                console.error('Error cargando pedidos:', error)
                toast.error('No se pudieron cargar los pedidos')
                setErrorCarga(true)
                setLoading(false)
            }
        )
        return unsub
    }, [])

    useEffect(() => {
        cargarClientes().then(setClientes).catch(error => console.error('Error cargando clientes:', error))
    }, [])

    const resumen = useMemo(() => resumenPedidos(pedidos), [pedidos])
    const lista = useMemo(() => filtrarPedidos(pedidos, { estado, texto: busqueda }), [pedidos, estado, busqueda])
    // Se busca por id para que el detalle refleje los cambios del listener en vivo.
    const abierto = pedidos.find(p => p.id === abiertoId) ?? null

    if (loading) {
        if (!mostrarSkeleton) return null
        return (
            <div className="space-y-4" aria-busy="true">
                <SkeletonHeader actions={1} />
                <SkeletonKpis count={3} />
                <SkeletonRows rows={6} />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 leading-tight">
                        <ClipboardList className="w-5 h-5 text-primary" /> Pedidos del local
                    </h2>
                    <p className="text-slate-400 text-xs">Encargos de clientes: qué pidió, cuánto abonó y cuánto debe.</p>
                </div>
                <Button
                    type="button"
                    onClick={() => setNuevo(true)}
                    disabled={soloLectura}
                    title={soloLectura ? TITULO_SOLO_LECTURA : undefined}
                    className="flex items-center justify-center gap-2 self-stretch sm:self-auto"
                >
                    <Plus className="w-4 h-4" /> Nuevo pedido
                </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Kpi label="Pendientes" valor={resumen.pendientes} />
                <Kpi label="Por cobrar" valor={formatCLP(resumen.porCobrar)} tono="text-amber-400" />
                <Kpi label="Abonado" valor={formatCLP(resumen.abonado)} tono="text-emerald-400" />
            </div>

            <Card className="p-0 bg-slate-900/50 overflow-hidden">
                <div className="p-3 border-b border-white/10 bg-white/5 flex flex-col md:flex-row md:items-center gap-2">
                    <div role="radiogroup" aria-label="Estado" className="grid grid-cols-4 gap-1 md:flex">
                        {FILTROS.map(f => (
                            <button key={f.label} type="button" role="radio" aria-checked={estado === f.id} onClick={() => setEstado(f.id)}
                                className={cn('px-2 md:px-3 py-1.5 rounded-lg text-xs sm:text-sm whitespace-nowrap transition-colors',
                                    estado === f.id ? 'bg-primary/15 text-white ring-1 ring-inset ring-primary/40' : 'text-slate-400 hover:text-white hover:bg-white/5')}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative md:ml-auto md:w-72">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente o producto…" className="py-1.5 pl-9 text-sm" />
                    </div>
                </div>

                <ul className="divide-y divide-white/5">
                    {lista.map(p => {
                        const saldo = saldoDe(p)
                        const e = ESTADOS[p.estado] ?? ESTADOS.pendiente
                        const n = (p.productos || []).reduce((a, i) => a + (Number(i.cantidad) || 0), 0)
                        return (
                            <li key={p.id}>
                                <button type="button" onClick={() => setAbiertoId(p.id)} className="w-full text-left px-3 sm:px-4 py-3 hover:bg-white/5 flex items-center gap-3 group">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-medium text-white truncate">{p.nombreCliente}</span>
                                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border shrink-0', e.clase)}>{e.label}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">
                                            {p.descripcion || (p.productos || []).map(i => i.nombreProducto).join(', ')}
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            {p.creadoEn?.toDate?.().toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })} · {n} {n === 1 ? 'producto' : 'productos'}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-white tabular-nums">{formatCLP(p.total)}</p>
                                        <p className={cn('text-xs tabular-nums', saldo > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                                            {saldo > 0 ? `Debe ${formatCLP(saldo)}` : 'Pagado'}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 shrink-0" />
                                </button>
                            </li>
                        )
                    })}
                    {lista.length === 0 && (
                        <li className="p-10 text-center text-sm text-slate-500">
                            {errorCarga
                                ? 'No se pudieron cargar los pedidos. Revisa la conexión o los permisos y recarga.'
                                : pedidos.length === 0 ? 'Aún no hay pedidos. Crea el primero con "Nuevo pedido".' : 'Nada coincide con el filtro.'}
                        </li>
                    )}
                </ul>
            </Card>

            <NuevoPedido isOpen={nuevo} onClose={() => setNuevo(false)} clientes={clientes} userId={user?.uid} />
            {abierto && <DetallePedido pedido={abierto} onClose={() => setAbiertoId(null)} soloLectura={soloLectura} />}
        </div>
    )
}

function Kpi({ label, valor, tono = 'text-white' }) {
    return (
        <Card className="px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-900/50 min-w-0">
            <p className="text-slate-400 text-[10px] sm:text-[11px] uppercase font-bold tracking-wider truncate">{label}</p>
            <h3 className={cn('text-base sm:text-xl font-bold truncate leading-tight tabular-nums', tono)}>{valor}</h3>
        </Card>
    )
}

export default Pedidos
