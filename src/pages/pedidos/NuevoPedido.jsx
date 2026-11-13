import { useMemo, useState } from 'react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { toast } from 'sonner'
import { Search, Plus, Minus, Trash2, UserRound, PackagePlus } from 'lucide-react'
import { db } from '../../db/firebase'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Button } from '../../components/ui/Button'
import { useCatalogo } from '../../lib/catalogo'
import { filtrarCatalogo } from '../../lib/buscarProductos'
import { cn, formatCLP } from '../../lib/utils'
import { METODOS_ABONO, agregarProducto, totalItems } from '../../lib/pedidos'

const VACIO = () => ({ cliente: null, descripcion: '', items: [], abono: '', metodo: 'efectivo' })

export function NuevoPedido({ isOpen, onClose, clientes, userId }) {
    const [form, setForm] = useState(VACIO)
    const [buscaCliente, setBuscaCliente] = useState('')
    const [buscaProducto, setBuscaProducto] = useState('')
    const [libre, setLibre] = useState({ nombre: '', precio: '' })
    const [guardando, setGuardando] = useState(false)
    const { productos, porCodigo } = useCatalogo()

    const total = totalItems(form.items)
    const abono = Number(form.abono) || 0
    const debe = Math.max(0, total - abono)

    const clientesFiltrados = useMemo(() => {
        const t = buscaCliente.trim().toLowerCase()
        if (!t) return clientes.slice(0, 6)
        return clientes.filter(c =>
            [c.name, c.phone, c.rut, c.patente].some(v => (v || '').toLowerCase().includes(t))
        ).slice(0, 6)
    }, [clientes, buscaCliente])

    const sugerencias = useMemo(
        () => filtrarCatalogo(productos, porCodigo, buscaProducto, 6),
        [productos, porCodigo, buscaProducto]
    )

    const setItems = (fn) => setForm(f => ({ ...f, items: fn(f.items) }))
    const cambiarItem = (i, campo, valor) => setItems(items => items.map((x, k) => k === i ? { ...x, [campo]: valor } : x))

    const agregarDelCatalogo = (p) => { setItems(items => agregarProducto(items, p)); setBuscaProducto('') }
    const agregarLibre = () => {
        const nombre = libre.nombre.trim()
        if (!nombre) return toast.error('Escribe qué se va a pedir')
        setItems(items => [...items, { idProducto: null, nombreProducto: nombre, cantidad: 1, precio: Number(libre.precio) || 0 }])
        setLibre({ nombre: '', precio: '' })
    }

    const limpiarYCerrar = () => {
        setForm(VACIO()); setBuscaCliente(''); setBuscaProducto(''); setLibre({ nombre: '', precio: '' })
        onClose()
    }
    const cerrar = () => { if (!guardando) limpiarYCerrar() }

    const guardar = async (e) => {
        e.preventDefault()
        if (!form.cliente) return toast.error('Selecciona el cliente del pedido')
        if (form.items.length === 0) return toast.error('Agrega al menos un producto')
        if (!(total > 0)) return toast.error('El total del pedido debe ser mayor a $0')
        if (abono > total) return toast.error('El abono supera el total del pedido')
        setGuardando(true)
        try {
            const ahora = Timestamp.now()
            await addDoc(collection(db, 'pedidos'), {
                clienteId: form.cliente.id,
                nombreCliente: form.cliente.name || '',
                descripcion: form.descripcion.trim(),
                productos: form.items.map(i => ({
                    idProducto: i.idProducto ?? null,
                    nombreProducto: i.nombreProducto,
                    cantidad: Number(i.cantidad) || 1,
                    precio: Number(i.precio) || 0,
                })),
                total,
                abonado: abono,
                abonos: abono > 0 ? [{ monto: abono, metodo: form.metodo, fecha: ahora }] : [],
                estado: 'pendiente',
                creadoEn: ahora,
                userId: userId || null,
            })
            toast.success('Pedido creado', { description: `${form.cliente.name} · debe ${formatCLP(debe)}` })
            setGuardando(false)
            limpiarYCerrar()
        } catch (error) {
            console.error('Error creando pedido:', error)
            toast.error('No se pudo crear el pedido')
            setGuardando(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={cerrar} dismissible={!guardando} title="Nuevo pedido" className="max-w-2xl">
            <form onSubmit={guardar} className="flex flex-col gap-5">
                {/* Cliente */}
                <section>
                    <span className="block text-xs text-slate-400 mb-1.5">Cliente</span>
                    {form.cliente ? (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/10">
                            <UserRound className="w-4 h-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{form.cliente.name}</p>
                                <p className="text-xs text-slate-400 truncate">
                                    {[form.cliente.phone, form.cliente.patente].filter(Boolean).join(' · ') || 'Sin teléfono'}
                                    {Number(form.cliente.currentDebt) > 0 && <span className="text-amber-400"> · fiado {formatCLP(form.cliente.currentDebt)}</span>}
                                </p>
                            </div>
                            <button type="button" onClick={() => setForm(f => ({ ...f, cliente: null }))} className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10">
                                Cambiar
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar por nombre, teléfono, RUT o patente…" className="py-2 pl-9 border-0 rounded-none" />
                            </div>
                            <ul className="max-h-44 overflow-y-auto custom-scrollbar divide-y divide-white/5 border-t border-white/10">
                                {clientesFiltrados.map(c => (
                                    <li key={c.id}>
                                        <button type="button" onClick={() => setForm(f => ({ ...f, cliente: c }))} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between gap-2">
                                            <span className="text-sm text-white truncate">{c.name}</span>
                                            <span className="text-xs text-slate-500 truncate">{c.phone || c.patente || ''}</span>
                                        </button>
                                    </li>
                                ))}
                                {clientesFiltrados.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Sin coincidencias. Créalo primero en Clientes.</li>}
                            </ul>
                        </div>
                    )}
                </section>

                {/* Descripción */}
                <label className="block">
                    <span className="block text-xs text-slate-400 mb-1.5">Descripción del pedido</span>
                    <textarea
                        value={form.descripcion}
                        onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))}
                        maxLength={300}
                        rows={2}
                        placeholder="Ej: Kit de embrague para Hilux 2015, llega el jueves"
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    />
                </label>

                {/* Productos */}
                <section className="flex flex-col gap-2">
                    <span className="block text-xs text-slate-400">Productos</span>
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input value={buscaProducto} onChange={(e) => setBuscaProducto(e.target.value)} placeholder="Buscar en el catálogo…" className="py-2 pl-9" />
                        {sugerencias.length > 0 && (
                            <ul className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl border border-white/10 bg-slate-900 shadow-xl overflow-hidden divide-y divide-white/5">
                                {sugerencias.map(p => (
                                    <li key={p.id}>
                                        <button type="button" onClick={() => agregarDelCatalogo(p)} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between gap-2">
                                            <span className="text-sm text-white truncate">{p.nombreProducto}</span>
                                            <span className="text-xs text-slate-400 shrink-0">{formatCLP(p.precioVentaLocal ?? p.precioProducto ?? 0)}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Lo que no está en el catálogo (repuesto por encargar). */}
                    <div className="flex gap-2">
                        <Input value={libre.nombre} onChange={(e) => setLibre(l => ({ ...l, nombre: e.target.value }))} placeholder="Ítem fuera del catálogo" className="py-2 flex-1 min-w-0" />
                        <CurrencyInput name="precioLibre" value={libre.precio} onChange={(e) => setLibre(l => ({ ...l, precio: e.target.value }))} placeholder="$0" className="py-2 w-28" />
                        <Button type="button" variant="secondary" onClick={agregarLibre} aria-label="Agregar ítem" className="px-3 shrink-0"><PackagePlus className="w-4 h-4" /></Button>
                    </div>

                    {form.items.length > 0 ? (
                        <ul className="rounded-xl border border-white/10 divide-y divide-white/5">
                            {form.items.map((it, i) => (
                                <li key={i} data-testid="item-pedido" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                                    <span className="flex-1 min-w-[8rem] text-sm text-white truncate">{it.nombreProducto}</span>
                                    <div className="flex items-center gap-1">
                                        <button type="button" aria-label="Menos" onClick={() => cambiarItem(i, 'cantidad', Math.max(1, it.cantidad - 1))} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"><Minus className="w-3.5 h-3.5" /></button>
                                        <span className="w-6 text-center text-sm text-white tabular-nums">{it.cantidad}</span>
                                        <button type="button" aria-label="Más" onClick={() => cambiarItem(i, 'cantidad', it.cantidad + 1)} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"><Plus className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <CurrencyInput name={`precio-${i}`} aria-label={`Precio ${it.nombreProducto}`} value={String(it.precio || '')} onChange={(e) => cambiarItem(i, 'precio', Number(e.target.value) || 0)} placeholder="$0" className="py-1 w-24 text-sm" />
                                    <span className="w-20 text-right text-sm font-semibold text-white tabular-nums">{formatCLP(it.precio * it.cantidad)}</span>
                                    <button type="button" aria-label={`Quitar ${it.nombreProducto}`} onClick={() => setItems(items => items.filter((_, k) => k !== i))} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-500 text-center py-3 rounded-xl border border-dashed border-white/10">Busca en el catálogo o agrega un ítem fuera del catálogo.</p>
                    )}
                </section>

                {/* Abono y saldo */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <label className="block">
                        <span className="block text-xs text-slate-400 mb-1">Abono inicial</span>
                        <CurrencyInput name="abono" value={form.abono} onChange={(e) => setForm(f => ({ ...f, abono: e.target.value }))} placeholder="$0 (sin abono)" className="py-2" />
                    </label>
                    <div>
                        <span className="block text-xs text-slate-400 mb-1">Pagado con</span>
                        <div role="radiogroup" aria-label="Método del abono" className="flex gap-1">
                            {METODOS_ABONO.map(m => (
                                <button key={m.id} type="button" role="radio" aria-checked={form.metodo === m.id} disabled={!abono}
                                    onClick={() => setForm(f => ({ ...f, metodo: m.id }))}
                                    className={cn('flex-1 px-2 py-2 rounded-lg text-xs border transition-colors disabled:opacity-40',
                                        form.metodo === m.id ? 'bg-primary/15 border-primary/40 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5')}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="sm:col-span-2 flex items-end justify-between gap-3 pt-2 border-t border-white/10">
                        <div className="text-sm text-slate-400">Total <span className="text-white font-semibold">{formatCLP(total)}</span></div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Queda debiendo</p>
                            <p className={cn('text-xl font-bold tabular-nums', debe > 0 ? 'text-amber-400' : 'text-emerald-400')} data-testid="debe-pedido">{formatCLP(debe)}</p>
                        </div>
                    </div>
                </section>

                <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={cerrar} disabled={guardando} className="flex-1">Cancelar</Button>
                    <Button type="submit" disabled={guardando} className="flex-[2] flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Crear pedido'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

