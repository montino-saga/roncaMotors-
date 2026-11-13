import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { toast } from 'sonner'
import { Receipt, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, ArrowUpRight, ArrowDownRight, Minus, Save, Repeat, Check, CalendarCheck } from 'lucide-react'
import { db } from '../../db/firebase'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Button } from '../../components/ui/Button'
import { SkeletonCard, SkeletonKpis, SkeletonHeader } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { usePermisos } from '../../hooks/usePermisos'
import { cn, formatCLP } from '../../lib/utils'
import { TONO } from './tonos'
import { asegurarGastosFijos } from '../../lib/gastosFijos'
import { CATEGORIAS, categoriaDe, claveMes, inicioMes, finMes, mesAnterior, mesSiguiente, mismoMes, partirPorMes, resumenGastos, filtrarGastos } from '../../lib/gastos'

const hoyISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const FORM_VACIO = () => ({ fecha: hoyISO(), categoria: 'publicidad', monto: '', descripcion: '', fijo: false })

function Gastos() {
    const { soloLectura } = usePermisos()
    const { user } = useAuth()
    const [mes, setMes] = useState(() => inicioMes(new Date()))
    const [gastos, setGastos] = useState([])
    const [loading, setLoading] = useState(true)
    const mostrarSkeleton = useDelayedLoading(loading)
    const [form, setForm] = useState(FORM_VACIO)
    const [editando, setEditando] = useState(null)   // id del gasto en edición
    const [guardando, setGuardando] = useState(false)
    const [filtroCat, setFiltroCat] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [recarga, setRecarga] = useState(0)
    const [plantillas, setPlantillas] = useState({})   // gastosRecurrentes por id

    // Mes visible + anterior en una sola query (la comparación no cuesta otra lectura).
    useEffect(() => {
        let vivo = true
        const cargar = async () => {
            setLoading(true)
            try {
                // Los fijos del mes deben existir antes de leer la lista.
                if (!soloLectura) await asegurarGastosFijos(user?.uid)
                // Las plantillas son un extra: si fallan, la lista de gastos carga igual.
                getDocs(collection(db, 'gastosRecurrentes'))
                    .then(snapFijos => { if (vivo) setPlantillas(Object.fromEntries(snapFijos.docs.map(d => [d.id, d.data()]))) })
                    .catch(error => console.error('Error cargando gastos fijos:', error))
                const snap = await getDocs(query(
                    collection(db, 'gastos'),
                    where('fecha', '>=', Timestamp.fromDate(inicioMes(mesAnterior(mes)))),
                    where('fecha', '<=', Timestamp.fromDate(finMes(mes))),
                    orderBy('fecha', 'desc'),
                ))
                if (vivo) setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            } catch (error) {
                console.error('Error cargando gastos:', error)
                toast.error('No se pudieron cargar los gastos')
            } finally {
                if (vivo) setLoading(false)
            }
        }
        cargar()
        return () => { vivo = false }
    }, [mes, recarga, soloLectura, user?.uid])

    const { actual, anterior } = useMemo(() => partirPorMes(gastos, mes), [gastos, mes])
    const resumen = useMemo(() => resumenGastos(actual, anterior), [actual, anterior])
    const lista = useMemo(() => filtrarGastos(actual, { categoria: filtroCat, texto: busqueda }), [actual, filtroCat, busqueda])
    const porPagar = actual.filter(g => g.pagado === false).length

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
    const diaFijo = Number(form.fecha?.slice(8, 10)) || null
    const cancelarEdicion = () => { setEditando(null); setForm(FORM_VACIO()) }

    const guardar = async (e) => {
        e.preventDefault()
        const monto = Number(form.monto)
        if (!(monto > 0)) return toast.error('Ingresa un monto válido')
        if (!form.fecha) return toast.error('Ingresa la fecha')
        setGuardando(true)
        try {
            const fechaGasto = new Date(form.fecha + 'T12:00:00')
            const datos = {
                fecha: Timestamp.fromDate(fechaGasto),
                monto,
                categoria: form.categoria,
                descripcion: form.descripcion.trim(),
            }
            // La plantilla toma los datos del gasto; el próximo mes se registra sola.
            const datosFijo = {
                nombre: (datos.descripcion || categoriaDe(datos.categoria).label).slice(0, 140),
                monto,
                categoria: datos.categoria,
                dia: fechaGasto.getDate(),
            }
            const batch = writeBatch(db)
            const nuevaPlantilla = () => {
                const ref = doc(collection(db, 'gastosRecurrentes'))
                const hoy = claveMes(new Date()), delGasto = claveMes(fechaGasto)
                // Este mes ya queda cubierto por el gasto que se está guardando.
                batch.set(ref, { ...datosFijo, activo: true, ultimoMes: delGasto > hoy ? delGasto : hoy, creadoEn: Timestamp.now(), userId: user?.uid || null })
                return ref.id
            }
            if (editando) {
                const original = gastos.find(g => g.id === editando)
                const plantillaId = original?.recurrenteId
                const activa = plantillaId && plantillas[plantillaId]?.activo
                const extra = {}
                if (form.fijo && activa) batch.update(doc(db, 'gastosRecurrentes', plantillaId), datosFijo)
                else if (form.fijo) extra.recurrenteId = nuevaPlantilla()
                else if (activa) batch.update(doc(db, 'gastosRecurrentes', plantillaId), { activo: false })
                batch.update(doc(db, 'gastos', editando), { ...datos, ...extra })
                await batch.commit()
                toast.success('Gasto actualizado')
            } else if (form.fijo) {
                batch.set(doc(collection(db, 'gastos')), { ...datos, recurrenteId: nuevaPlantilla(), creadoEn: Timestamp.now(), userId: user?.uid || null })
                await batch.commit()
                toast.success('Gasto fijo registrado', { description: `${formatCLP(monto)} · se registrará solo cada mes` })
            } else {
                await addDoc(collection(db, 'gastos'), { ...datos, creadoEn: Timestamp.now(), userId: user?.uid || null })
                toast.success('Gasto registrado', { description: `${categoriaDe(form.categoria).label} · ${formatCLP(monto)}` })
            }
            cancelarEdicion()
            // Si el gasto cae en otro mes, saltar a él para verlo.
            const f = new Date(form.fecha + 'T12:00:00')
            if (!mismoMes(f, mes)) setMes(inicioMes(f)); else setRecarga(n => n + 1)
        } catch (error) {
            console.error('Error guardando gasto:', error)
            toast.error('No se pudo guardar el gasto')
        } finally {
            setGuardando(false)
        }
    }

    const editar = (g) => {
        setEditando(g.id)
        setForm({
            fecha: aISO(g.fecha.toDate()), categoria: g.categoria || 'otro', monto: String(g.monto), descripcion: g.descripcion || '',
            fijo: !!(g.recurrenteId && plantillas[g.recurrenteId]?.activo),
        })
    }

    const marcarPagado = async (g) => {
        const cambiar = (pagado) => setGastos(prev => prev.map(x => x.id === g.id ? { ...x, pagado } : x))
        cambiar(true)
        try {
            await updateDoc(doc(db, 'gastos', g.id), { pagado: true })
            toast.success('Marcado como pagado', { description: `${g.descripcion || categoriaDe(g.categoria).label} · ${formatCLP(g.monto)}` })
        } catch (error) {
            console.error('Error marcando pago:', error)
            toast.error('No se pudo marcar como pagado')
            cambiar(false)
        }
    }

    // Borrado optimista con Deshacer: el doc se elimina de verdad al cerrarse el toast.
    const eliminar = (g) => {
        setGastos(prev => prev.filter(x => x.id !== g.id))
        if (editando === g.id) cancelarEdicion()
        let deshecho = false
        const confirmar = () => {
            if (deshecho) return
            deleteDoc(doc(db, 'gastos', g.id)).catch(err => {
                console.error('Error eliminando gasto:', err)
                toast.error('No se pudo eliminar el gasto')
                setRecarga(n => n + 1)
            })
        }
        toast('Gasto eliminado', {
            description: `${categoriaDe(g.categoria).label} · ${formatCLP(g.monto)}`,
            action: { label: 'Deshacer', onClick: () => { deshecho = true; setGastos(prev => [g, ...prev]) } },
            onAutoClose: confirmar,
            onDismiss: confirmar,
        })
    }

    const tituloMes = mes.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    const esMesActual = mismoMes(mes, new Date())

    if (loading && gastos.length === 0) {
        if (!mostrarSkeleton) return null
        return (
            <div className="space-y-4">
                <SkeletonHeader actions={1} />
                <SkeletonKpis count={3} />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <SkeletonCard lines={5} className="lg:col-span-4" />
                    <SkeletonCard lines={8} className="lg:col-span-8" />
                </div>
            </div>
        )
    }

    return (
        <div className="vista-fija flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 leading-tight">
                        <Receipt className="w-5 h-5 text-primary" /> Gastos del local
                    </h2>
                    <p className="text-slate-400 text-xs">Publicidad, arriendo, arreglos… lo que cuesta mantener el negocio abierto.</p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                {!esMesActual && (
                    <button type="button" onClick={() => setMes(inicioMes(new Date()))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-slate-900/50 text-sm text-slate-300 hover:text-white hover:bg-white/5">
                        <CalendarCheck className="w-4 h-4" /> Mes actual
                    </button>
                )}
                <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/10">
                    <button type="button" aria-label="Mes anterior" onClick={() => setMes(mesAnterior(mes))} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-sm font-medium text-white capitalize min-w-[9rem] text-center">{tituloMes}</span>
                    <button type="button" aria-label="Mes siguiente" onClick={() => setMes(mesSiguiente(mes))} disabled={esMesActual} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                </div>
            </div>

            {/* Bento lg: 12 col. Izq (4): formulario + desglose. Der (8): KPIs + lista con scroll interno. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 lg:min-h-0">
                <div className="lg:col-span-4 flex flex-col gap-3 lg:min-h-0">
                    <Card className="p-4 bg-slate-900/50 shrink-0">
                        <form onSubmit={guardar} className="flex flex-col gap-3.5">
                        <fieldset disabled={soloLectura} className="contents">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    {editando ? <Pencil className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4 text-primary" />}
                                    {editando ? 'Editar gasto' : 'Nuevo gasto'}
                                </h3>
                                {editando && (
                                    <button type="button" onClick={cancelarEdicion} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                                        <X className="w-3 h-3" /> cancelar
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="block text-xs text-slate-400 mb-1">Fecha</span>
                                    <Input type="date" value={form.fecha} max={hoyISO()} onChange={set('fecha')} required className="py-2 [color-scheme:dark] light:[color-scheme:light]" />
                                </label>
                                <label className="block">
                                    <span className="block text-xs text-slate-400 mb-1">Monto</span>
                                    <CurrencyInput name="monto" value={form.monto} onChange={set('monto')} placeholder="$0" required className="py-2" />
                                </label>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-400 mb-1">Categoría</span>
                                <div role="radiogroup" aria-label="Categoría" className="flex flex-wrap gap-1.5">
                                    {CATEGORIAS.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={form.categoria === c.id}
                                            onClick={() => setForm(f => ({ ...f, categoria: c.id }))}
                                            className={cn(
                                                'px-2.5 py-1 rounded-full text-xs border transition-colors',
                                                form.categoria === c.id ? TONO[c.color].chip : 'border-white/10 text-slate-400 hover:bg-white/5'
                                            )}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <label className="block">
                                <span className="block text-xs text-slate-400 mb-1">Descripción</span>
                                <Input value={form.descripcion} onChange={set('descripcion')} placeholder="Ej: Campaña Instagram septiembre" maxLength={140} className="py-2" />
                            </label>
                            <div>
                                <span className="block text-xs text-slate-400 mb-1">Tipo de gasto</span>
                                <div role="radiogroup" aria-label="Tipo de gasto" data-tour="gastos-tipo" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                                    {[
                                        { fijo: false, label: 'Variable', sub: 'Espontáneo, una vez' },
                                        { fijo: true, label: 'Fijo', sub: 'Se repite mes a mes' },
                                    ].map(t => (
                                        <button
                                            key={t.label}
                                            type="button"
                                            role="radio"
                                            aria-checked={form.fijo === t.fijo}
                                            onClick={() => setForm(f => ({ ...f, fijo: t.fijo }))}
                                            className={cn(
                                                'flex flex-col items-start px-3 py-1.5 rounded-lg text-left transition-colors',
                                                form.fijo === t.fijo ? 'bg-primary/15 ring-1 ring-inset ring-primary/40' : 'hover:bg-white/5'
                                            )}
                                        >
                                            <span className={cn('text-sm font-medium flex items-center gap-1.5', form.fijo === t.fijo ? 'text-white' : 'text-slate-300')}>
                                                {t.fijo && <Repeat className="w-3.5 h-3.5" />}{t.label}
                                            </span>
                                            <span className="text-[11px] text-slate-500">{t.sub}</span>
                                        </button>
                                    ))}
                                </div>
                                {form.fijo && diaFijo && (
                                    <p className="mt-1.5 text-xs text-slate-400">
                                        Se registrará solo el día {diaFijo} de cada mes como <span className="text-amber-400">por pagar</span>.
                                    </p>
                                )}
                            </div>
                            <Button type="submit" disabled={guardando} className="w-full flex items-center justify-center gap-2">
                                {editando ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar gasto'}
                            </Button>
                        </fieldset>
                        </form>
                    </Card>

                    {/* A su altura: con 2 categorías no tiene sentido estirarla hasta abajo. */}
                    <Card className="p-4 bg-slate-900/50 min-h-0 max-h-full flex flex-col">
                        <h3 className="font-semibold text-white text-sm mb-3 shrink-0">Por categoría</h3>
                        <div className="min-h-0 overflow-y-auto custom-scrollbar space-y-2.5">
                            {resumen.porCategoria.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setFiltroCat(filtroCat === c.id ? '' : c.id)}
                                    className={cn('w-full text-left group', filtroCat && filtroCat !== c.id && 'opacity-40')}
                                >
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-300 group-hover:text-white">{c.label}</span>
                                        <span className="text-slate-400 font-mono">{formatCLP(c.monto)} · {Math.round(c.pct)}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                        <div className={cn('h-full rounded-full', TONO[c.color].barra)} style={{ width: `${c.pct}%` }} />
                                    </div>
                                </button>
                            ))}
                            {resumen.porCategoria.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-6">Sin gastos este mes</p>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-3 lg:min-h-0">
                    <div className="grid grid-cols-3 gap-3 shrink-0">
                        <Kpi label="Total del mes" valor={formatCLP(resumen.total)} sub={<Delta valor={resumen.variacion} />} />
                        <Kpi label="Gastos" valor={resumen.cantidad} sub={<span className="text-xs text-slate-500">registros{porPagar > 0 && <span className="text-amber-400"> · {porPagar} por pagar</span>}</span>} />
                        <Kpi label="Mayor gasto" valor={resumen.mayor ? resumen.mayor.label : '—'} sub={resumen.mayor && <span className="text-xs text-slate-500">{Math.round(resumen.mayor.pct)}% del total</span>} />
                    </div>

                    <Card className="p-0 bg-slate-900/50 overflow-hidden flex flex-col flex-1 min-h-[20rem] lg:min-h-0">
                        <div className="p-3 border-b border-white/10 bg-white/5 flex items-center gap-2 shrink-0">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en el mes…" className="py-1.5 pl-9 text-sm" />
                            </div>
                            {filtroCat && (
                                <button type="button" onClick={() => setFiltroCat('')} className={cn('text-xs px-2.5 py-1 rounded-full border flex items-center gap-1', TONO[categoriaDe(filtroCat).color].chip)}>
                                    {categoriaDe(filtroCat).label} <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-white/5">
                                    {lista.map(g => {
                                        const c = categoriaDe(g.categoria)
                                        return (
                                            <tr key={g.id} className={cn('hover:bg-white/5 transition-colors group', editando === g.id && 'bg-amber-500/5')}>
                                                <td className="p-3 w-20 text-xs text-slate-400 whitespace-nowrap">
                                                    {g.fecha?.toDate().toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <span className="text-sm text-white truncate">{g.descripcion || c.label}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', TONO[c.color].chip)}>{c.label}</span>
                                                            {g.recurrenteId && <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-slate-300 inline-flex items-center gap-1"><Repeat className="w-2.5 h-2.5" />Fijo</span>}
                                                            {g.pagado === false && <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">Por pagar</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-sm font-bold text-white whitespace-nowrap">{formatCLP(g.monto)}</td>
                                                <td className="p-2 w-28">
                                                    {!soloLectura && <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100">
                                                        {g.pagado === false && (
                                                            <button type="button" aria-label="Marcar pagado" title="Marcar pagado" onClick={() => marcarPagado(g)} className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10"><Check className="w-4 h-4" /></button>
                                                        )}
                                                        <button type="button" aria-label="Editar" onClick={() => editar(g)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                                                        <button type="button" aria-label="Eliminar" onClick={() => eliminar(g)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                                                    </div>}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {lista.length === 0 && (
                                        <tr><td colSpan={4} className="p-10 text-center text-slate-500 text-sm">
                                            {actual.length === 0 ? 'Ningún gasto registrado este mes. Anota el primero a la izquierda.' : 'Nada coincide con el filtro.'}
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function Kpi({ label, valor, sub }) {
    return (
        <Card className="px-3.5 py-3 bg-slate-900/50 min-w-0">
            <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider truncate">{label}</p>
            <h3 className="text-xl font-bold text-white truncate leading-tight">{valor}</h3>
            <div className="mt-0.5 h-4">{sub}</div>
        </Card>
    )
}

// En gastos, subir es malo: el color se invierte respecto a ventas.
function Delta({ valor }) {
    if (valor == null) return <span className="text-xs text-slate-500">sin mes anterior</span>
    const plano = Math.abs(valor) < 0.5
    const sube = valor > 0
    const Icono = plano ? Minus : sube ? ArrowUpRight : ArrowDownRight
    return (
        <span className={cn('text-xs font-semibold inline-flex items-center gap-0.5', plano ? 'text-slate-400' : sube ? 'text-red-400' : 'text-emerald-400')}>
            <Icono className="w-3 h-3" />{plano ? '0' : (sube ? '+' : '') + Math.round(valor)}% vs mes anterior
        </span>
    )
}

export default Gastos
