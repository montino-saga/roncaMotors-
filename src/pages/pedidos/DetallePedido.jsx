import { useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { CheckCircle2, Ban, RotateCcw, Trash2, Wallet, ExternalLink } from 'lucide-react'
import { db } from '../../db/firebase'
import { Modal } from '../../components/ui/Modal'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Button } from '../../components/ui/Button'
import { cn, formatCLP } from '../../lib/utils'
import { ESTADOS, METODOS_ABONO, saldoDe, validarAbono } from '../../lib/pedidos'

const fechaCorta = (ts) => ts?.toDate?.().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) ?? ''
const metodoLabel = (id) => METODOS_ABONO.find(m => m.id === id)?.label ?? id

export function DetallePedido({ pedido, onClose, soloLectura }) {
    const [abono, setAbono] = useState('')
    const [metodo, setMetodo] = useState('efectivo')
    const [ocupado, setOcupado] = useState(false)
    const [confirmarBorrar, setConfirmarBorrar] = useState(false)

    const saldo = saldoDe(pedido)
    const estado = ESTADOS[pedido.estado] ?? ESTADOS.pendiente
    const pendiente = pedido.estado === 'pendiente'
    const ref = doc(db, 'pedidos', pedido.id)

    const ejecutar = async (fn, ok, err) => {
        setOcupado(true)
        try {
            await fn()
            toast.success(ok)
            return true
        } catch (error) {
            console.error(err, error)
            toast.error(err)
            return false
        } finally {
            setOcupado(false)
        }
    }

    const registrarAbono = async (e) => {
        e.preventDefault()
        const error = validarAbono(abono, saldo)
        if (error) return toast.error(error)
        const monto = Number(abono)
        // Array completo y no arrayUnion: dos abonos iguales el mismo segundo son válidos.
        const listo = await ejecutar(() => updateDoc(ref, {
            abonos: [...(pedido.abonos || []), { monto, metodo, fecha: Timestamp.now() }],
            abonado: (Number(pedido.abonado) || 0) + monto,
        }), `Abono de ${formatCLP(monto)} registrado`, 'No se pudo registrar el abono')
        if (listo) setAbono('')
    }

    const cambiarEstado = (nuevo, mensaje) => ejecutar(
        () => updateDoc(ref, { estado: nuevo, ...(nuevo === 'entregado' ? { entregadoEn: Timestamp.now() } : {}) }),
        mensaje, 'No se pudo actualizar el pedido'
    )

    const eliminar = async () => {
        if (await ejecutar(() => deleteDoc(ref), 'Pedido eliminado', 'No se pudo eliminar el pedido')) onClose()
    }

    return (
        <Modal isOpen onClose={onClose} dismissible={!ocupado} title={`Pedido de ${pedido.nombreCliente || 'cliente'}`} className="max-w-xl">
            <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className={cn('px-2 py-0.5 rounded-full border', estado.clase)}>{estado.label}</span>
                    <span>Creado el {fechaCorta(pedido.creadoEn)}</span>
                    {pedido.entregadoEn && <span>· entregado el {fechaCorta(pedido.entregadoEn)}</span>}
                    {pedido.clienteId && (
                        <Link to={`/clientes/${pedido.clienteId}`} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
                            Ver cliente <ExternalLink className="w-3 h-3" />
                        </Link>
                    )}
                </div>

                {pedido.descripcion && <p className="text-sm text-slate-200 whitespace-pre-line">{pedido.descripcion}</p>}

                <ul className="rounded-xl border border-white/10 divide-y divide-white/5">
                    {(pedido.productos || []).map((it, i) => (
                        <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <span className="text-slate-400 tabular-nums w-8">{it.cantidad}×</span>
                            <span className="flex-1 min-w-0 text-white truncate">{it.nombreProducto}</span>
                            <span className="text-slate-300 tabular-nums">{formatCLP((Number(it.precio) || 0) * (Number(it.cantidad) || 0))}</span>
                        </li>
                    ))}
                </ul>

                <div className="grid grid-cols-3 gap-2 text-center">
                    <Monto label="Total" valor={pedido.total} />
                    <Monto label="Abonado" valor={pedido.abonado} tono="text-emerald-400" />
                    <Monto label="Debe" valor={saldo} tono={saldo > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                </div>

                <section>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Abonos</h4>
                    {(pedido.abonos || []).length === 0
                        ? <p className="text-sm text-slate-500">Sin abonos todavía.</p>
                        : (
                            <ul className="space-y-1">
                                {pedido.abonos.map((a, i) => (
                                    <li key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">{fechaCorta(a.fecha)} · {metodoLabel(a.metodo)}</span>
                                        <span className="text-emerald-400 font-medium tabular-nums">+{formatCLP(a.monto)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    {pendiente && saldo > 0 && !soloLectura && (
                        <form onSubmit={registrarAbono} className="mt-3 flex flex-wrap gap-2">
                            <CurrencyInput name="nuevoAbono" aria-label="Monto del abono" value={abono} onChange={(e) => setAbono(e.target.value)} placeholder={`Hasta ${formatCLP(saldo)}`} className="py-2 flex-1 min-w-[8rem]" />
                            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Método" className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white [&>option]:bg-slate-900">
                                {METODOS_ABONO.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                            <Button type="submit" disabled={ocupado} className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Abonar</Button>
                        </form>
                    )}
                </section>

                {!soloLectura && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                        {pendiente ? (
                            <>
                                <Button type="button" disabled={ocupado} onClick={() => cambiarEstado('entregado', 'Pedido entregado')} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/30">
                                    <CheckCircle2 className="w-4 h-4" /> Marcar entregado
                                </Button>
                                <Button type="button" variant="secondary" disabled={ocupado} onClick={() => cambiarEstado('cancelado', 'Pedido cancelado')} className="flex items-center gap-2">
                                    <Ban className="w-4 h-4" /> Cancelar pedido
                                </Button>
                            </>
                        ) : (
                            <Button type="button" variant="secondary" disabled={ocupado} onClick={() => cambiarEstado('pendiente', 'Pedido reabierto')} className="flex-1 flex items-center justify-center gap-2">
                                <RotateCcw className="w-4 h-4" /> Volver a pendiente
                            </Button>
                        )}
                        {confirmarBorrar ? (
                            <Button type="button" variant="danger" disabled={ocupado} onClick={eliminar} className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" /> Sí, eliminar
                            </Button>
                        ) : (
                            <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setConfirmarBorrar(true)} aria-label="Eliminar pedido" className="px-3">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        {pendiente && saldo > 0 && (
                            <p className="w-full text-xs text-slate-500">Si lo entregas ahora, queda registrado que debe {formatCLP(saldo)}.</p>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    )
}

function Monto({ label, valor, tono = 'text-white' }) {
    return (
        <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
            <p className={cn('text-base sm:text-lg font-bold tabular-nums', tono)}>{formatCLP(valor || 0)}</p>
        </div>
    )
}
