import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { Users, Search, Info, UserPlus, Send } from 'lucide-react'
import { db } from '../../db/firebase'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SkeletonCard, SkeletonHeader } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { cn } from '../../lib/utils'
import { ROLES, rolDe, invitarUsuario, enviarInvitacion, mensajeErrorInvitacion } from '../../lib/usuarios'

// Tailwind necesita las clases literales.
const TONO_ROL = {
    desarrollador: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    admin: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    lector: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

const INVITACION_VACIA = { email: '', nombre: '', rol: 'lector' }

const fecha = (ts) => ts?.toDate?.().toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? '—'

function Usuarios() {
    const { user } = useAuth()
    const [usuarios, setUsuarios] = useState([])
    const [loading, setLoading] = useState(true)
    const mostrarSkeleton = useDelayedLoading(loading)
    const [busqueda, setBusqueda] = useState('')
    const [invitarAbierto, setInvitarAbierto] = useState(false)
    const [invitacion, setInvitacion] = useState(INVITACION_VACIA)
    const [invitando, setInvitando] = useState(false)

    useEffect(() => onSnapshot(
        collection(db, 'usuarios'),
        (snap) => {
            setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
            setLoading(false)
        },
        (error) => {
            console.error('Error cargando usuarios:', error)
            toast.error('No se pudieron cargar los usuarios')
            setLoading(false)
        },
    ), [])

    const lista = useMemo(() => {
        const t = busqueda.trim().toLowerCase()
        return usuarios
            .filter((u) => !t || u.email?.toLowerCase().includes(t) || u.nombre?.toLowerCase().includes(t))
            .sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    }, [usuarios, busqueda])

    const conteo = useMemo(() => Object.fromEntries(ROLES.map((r) => [r.id, usuarios.filter((u) => rolDe(u.rol).id === r.id).length])), [usuarios])

    const cambiarRol = async (u, rol) => {
        try {
            await updateDoc(doc(db, 'usuarios', u.id), { rol })
            toast.success('Rol actualizado', { description: `${u.email} · ${rolDe(rol).label}` })
        } catch (error) {
            console.error('Error cambiando rol:', error)
            toast.error('No se pudo cambiar el rol')
        }
    }

    const invitar = async (e) => {
        e.preventDefault()
        setInvitando(true)
        try {
            await invitarUsuario(invitacion)
            toast.success('Invitación enviada', { description: `${invitacion.email} recibirá un correo para crear su contraseña` })
            setInvitarAbierto(false)
            setInvitacion(INVITACION_VACIA)
        } catch (error) {
            console.error('Error invitando usuario:', error)
            toast.error(mensajeErrorInvitacion(error))
        } finally {
            setInvitando(false)
        }
    }

    const reenviar = async (u) => {
        try {
            await enviarInvitacion(u.email)
            toast.success('Invitación reenviada', { description: u.email })
        } catch (error) {
            console.error('Error reenviando invitación:', error)
            toast.error('No se pudo reenviar la invitación')
        }
    }

    if (loading) {
        if (!mostrarSkeleton) return null
        return (
            <div className="space-y-4">
                <SkeletonHeader />
                <SkeletonCard lines={6} />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 leading-tight">
                        <Users className="w-5 h-5 text-primary" /> Usuarios
                    </h2>
                    <p className="text-slate-400 text-xs">Cuentas con acceso al panel y su rol.</p>
                </div>
                <Button onClick={() => setInvitarAbierto(true)} className="h-10 px-4 inline-flex items-center gap-2 shrink-0">
                    <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Invitar usuario</span><span className="sm:hidden">Invitar</span>
                </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {ROLES.map((r) => (
                    <Card key={r.id} className="px-3.5 py-3 bg-slate-900/50 min-w-0" title={r.descripcion}>
                        <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider truncate">{r.label}</p>
                        <h3 className="text-xl font-bold text-white leading-tight">{conteo[r.id]}</h3>
                    </Card>
                ))}
            </div>

            <Card className="p-0 bg-slate-900/50 overflow-hidden">
                <div className="p-3 border-b border-white/10 bg-white/5">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por email o nombre…" className="py-1.5 pl-9 text-sm" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/5">
                                <th className="p-3 font-semibold">Usuario</th>
                                <th className="p-3 font-semibold">Rol</th>
                                <th className="p-3 font-semibold hidden md:table-cell">Último acceso</th>
                                <th className="p-3 font-semibold hidden lg:table-cell">Alta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {lista.map((u) => (
                                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 grid place-items-center text-xs font-bold text-white uppercase">
                                                {(u.nombre || u.email || '?')[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm text-white truncate">
                                                    {u.nombre || u.email}
                                                    {u.id === user?.uid && <span className="ml-2 text-[10px] text-primary">(tú)</span>}
                                                </p>
                                                {u.nombre && <p className="text-xs text-slate-400 truncate">{u.email}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <select
                                            aria-label={`Rol de ${u.email}`}
                                            value={rolDe(u.rol).id}
                                            onChange={(e) => cambiarRol(u, e.target.value)}
                                            // Las rules lo rechazan: cambiarse el rol propio podría dejarte sin acceso.
                                            disabled={u.id === user?.uid}
                                            title={u.id === user?.uid ? 'No puedes cambiar tu propio rol' : undefined}
                                            className={cn('text-xs px-2.5 py-1 rounded-full border bg-transparent outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-70', TONO_ROL[rolDe(u.rol).id])}
                                        >
                                            {ROLES.map((r) => <option key={r.id} value={r.id} className="bg-slate-900 text-white">{r.label}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-3 text-xs text-slate-400 whitespace-nowrap hidden md:table-cell">
                                        {u.ultimoAcceso ? fecha(u.ultimoAcceso) : (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-400">Invitación pendiente</span>
                                                <button type="button" onClick={() => reenviar(u)} title="Reenviar invitación" aria-label={`Reenviar invitación a ${u.email}`} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10">
                                                    <Send className="w-3.5 h-3.5" />
                                                </button>
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-xs text-slate-400 whitespace-nowrap hidden lg:table-cell">{fecha(u.creadoEn)}</td>
                                </tr>
                            ))}
                            {lista.length === 0 && (
                                <tr><td colSpan={4} className="p-10 text-center text-slate-500 text-sm">
                                    {usuarios.length === 0 ? 'Aún no hay usuarios registrados.' : 'Nada coincide con la búsqueda.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <p className="text-xs text-slate-500 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                Al invitar, la persona recibe un correo para crear su contraseña. Cuentas creadas a mano en Firebase aparecen aquí al iniciar sesión por primera vez.
            </p>

            <Modal isOpen={invitarAbierto} onClose={() => setInvitarAbierto(false)} title="Invitar usuario" dismissible={!invitando}>
                <form onSubmit={invitar} className="space-y-4">
                    <label className="block">
                        <span className="block text-sm text-slate-300 mb-1">Correo</span>
                        <Input
                            type="email"
                            inputMode="email"
                            required
                            maxLength={120}
                            value={invitacion.email}
                            onChange={(e) => setInvitacion((i) => ({ ...i, email: e.target.value }))}
                            placeholder="nombre@gmail.com"
                            autoFocus
                        />
                    </label>
                    <label className="block">
                        <span className="block text-sm text-slate-300 mb-1">Nombre <span className="text-slate-500">(opcional)</span></span>
                        <Input
                            maxLength={80}
                            value={invitacion.nombre}
                            onChange={(e) => setInvitacion((i) => ({ ...i, nombre: e.target.value }))}
                            placeholder="Juan Pérez"
                        />
                    </label>
                    <div>
                        <span className="block text-sm text-slate-300 mb-1.5">Rol</span>
                        <div role="radiogroup" aria-label="Rol" className="grid gap-2">
                            {ROLES.map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={invitacion.rol === r.id}
                                    onClick={() => setInvitacion((i) => ({ ...i, rol: r.id }))}
                                    className={cn(
                                        'text-left px-3 py-2 rounded-xl border transition-colors',
                                        invitacion.rol === r.id ? TONO_ROL[r.id] : 'border-white/10 text-slate-300 hover:bg-white/5'
                                    )}
                                >
                                    <span className="block text-sm font-medium">{r.label}</span>
                                    <span className="block text-xs opacity-80">{r.descripcion}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setInvitarAbierto(false)} disabled={invitando}>Cancelar</Button>
                        <Button type="submit" disabled={invitando || !invitacion.email.trim()} className="inline-flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            {invitando ? 'Enviando…' : 'Enviar invitación'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Usuarios
