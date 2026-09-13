import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where, Timestamp } from 'firebase/firestore'
import { toast } from 'sonner'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FlaskConical, TrendingUp, Flame, Lightbulb, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Sparkles, Info } from 'lucide-react'
import { db } from '../../db/firebase'
import { Card } from '../../components/ui/Card'
import { SkeletonCard, SkeletonKpis, SkeletonHeader } from '../../components/ui/Skeleton'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { usePersistedState } from '../../hooks/usePersistedState'
import { useTheme } from '../../context/ThemeContext'
import { useAppearance } from '../../context/AppearanceContext'
import { chartTheme } from '../../lib/chartTheme'
import { cn, formatCLP } from '../../lib/utils'
import { DIAS, serieDiaria, serieConFantasma, kpis, mapaCalor, insights } from '../../lib/analisis'

const RANGOS = [
    { dias: 7, label: '7 días' },
    { dias: 30, label: '30 días' },
    { dias: 90, label: '90 días' },
]

function Analisis() {
    const [dias, setDias] = usePersistedState('roncamotors_analisis_dias', 30)
    const [ventas, setVentas] = useState([])
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const mostrarSkeleton = useDelayedLoading(loading)
    const { settings } = useTheme()
    const ct = chartTheme(useAppearance().resolved)

    // Hoy incluido: el rango actual son los últimos `dias` días terminando hoy,
    // y el previo los `dias` anteriores. Una sola query trae ambos.
    const { desdePrevio, desdeActual } = useMemo(() => {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
        const desdeActual = new Date(hoy); desdeActual.setDate(hoy.getDate() - (dias - 1))
        const desdePrevio = new Date(desdeActual); desdePrevio.setDate(desdeActual.getDate() - dias)
        return { desdePrevio, desdeActual }
    }, [dias])

    useEffect(() => {
        let vivo = true
        const cargar = async () => {
            setLoading(true)
            try {
                const [snapVentas, snapClientes] = await Promise.all([
                    getDocs(query(
                        collection(db, 'sales'),
                        where('fechaVenta', '>=', Timestamp.fromDate(desdePrevio)),
                        orderBy('fechaVenta', 'asc'),
                    )),
                    getDocs(collection(db, 'clients')),
                ])
                if (!vivo) return
                setVentas(snapVentas.docs.map(d => ({ id: d.id, ...d.data() })))
                setClientes(snapClientes.docs.map(d => ({ id: d.id, ...d.data() })))
            } catch (error) {
                console.error('Error cargando análisis:', error)
                toast.error('No se pudieron cargar los datos de análisis')
            } finally {
                if (vivo) setLoading(false)
            }
        }
        cargar()
        return () => { vivo = false }
    }, [desdePrevio])

    const datos = useMemo(() => {
        const enActual = ventas.filter(s => s.fechaVenta?.toDate() >= desdeActual)
        const actual = serieDiaria(ventas, desdeActual, dias)
        const previo = serieDiaria(ventas, desdePrevio, dias)
        const mapa = mapaCalor(enActual)
        return {
            fantasma: serieConFantasma(actual, previo),
            kpis: kpis(actual, previo),
            mapa,
            frases: insights({ actual, previo, ventas: enActual, clientes, mapa }),
            totalActual: actual.reduce((a, p) => a + p.ventas, 0),
            totalPrevio: previo.reduce((a, p) => a + p.ventas, 0),
        }
    }, [ventas, clientes, desdeActual, desdePrevio, dias])

    if (loading) {
        if (!mostrarSkeleton) return null
        return (
            <div className="space-y-4">
                <SkeletonHeader actions={1} />
                <SkeletonKpis />
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <SkeletonCard lines={0} className="lg:col-span-3 h-72" />
                    <SkeletonCard lines={6} />
                    <SkeletonCard lines={0} className="lg:col-span-3 h-56" />
                </div>
            </div>
        )
    }

    const deltaTotal = datos.totalPrevio > 0 ? ((datos.totalActual - datos.totalPrevio) / datos.totalPrevio) * 100 : null

    return (
        <div className="flex flex-col gap-3 lg:h-[calc(100dvh-2rem)] lg:min-h-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 leading-tight">
                        <FlaskConical className="w-5 h-5 text-primary" /> Análisis
                    </h2>
                    <p className="text-slate-400 text-xs">Patrones y comparativas de los últimos {dias} días.</p>
                </div>
                <div role="radiogroup" aria-label="Rango" className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/10 self-start md:self-auto">
                    {RANGOS.map(r => (
                        <button
                            key={r.dias}
                            type="button"
                            role="radio"
                            aria-checked={dias === r.dias}
                            onClick={() => setDias(r.dias)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                                dias === r.dias ? 'bg-primary text-on-accent font-medium' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bento lg: KPIs e insights a su altura natural (auto); tendencia y
                heatmap se reparten el resto. Los insights van en tira horizontal:
                son 1–8 frases, una columna quedaba medio vacía. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_auto_3fr_2fr] gap-3 flex-1 lg:min-h-0">
                {datos.kpis.map(k => <Kpi key={k.clave} {...k} color={settings.primaryColor} />)}

                {/* Insights */}
                <Card className="col-span-2 lg:col-span-4 p-3 bg-slate-900/50 min-h-0">
                    <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-yellow-400" />
                        <h3 className="font-bold text-white text-sm">Lo que dicen tus datos</h3>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                        {datos.frases.map((f, i) => <Insight key={i} {...f} />)}
                    </ul>
                </Card>

                {/* Tendencia + fantasma */}
                <Card className="col-span-2 lg:col-span-4 p-4 bg-slate-900/50 flex flex-col min-h-0">
                    <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" /> Tendencia vs. período anterior
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                            <Delta valor={deltaTotal} />
                            <span className="hidden sm:flex items-center gap-1.5">
                                <span className="inline-block w-4 border-t-2 border-dashed border-slate-400" /> anterior
                            </span>
                        </div>
                    </div>
                    <div className="h-56 lg:h-auto lg:flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={datos.fantasma} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fantasmaFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={settings.primaryColor} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={settings.primaryColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                                <XAxis dataKey="dia" stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} minTickGap={24} />
                                <YAxis stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} tickFormatter={v => `$${v / 1000}k`} />
                                <Tooltip content={<TooltipFantasma />} />
                                <Line type="monotone" dataKey="previo" stroke={ct.axis} strokeDasharray="5 4" strokeWidth={2} dot={false} name="Anterior" />
                                <Area type="monotone" dataKey="ventas" stroke={settings.primaryColor} fill="url(#fantasmaFill)" strokeWidth={3} name="Actual" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Heatmap */}
                <Card className="col-span-2 lg:col-span-4 p-4 bg-slate-900/50 flex flex-col min-h-0 h-64 lg:h-auto">
                    <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-400" /> Cuándo se vende
                        </h3>
                        <span className="text-xs text-slate-400">pedidos por día y hora</span>
                    </div>
                    <MapaCalor mapa={datos.mapa} color={settings.primaryColor} />
                </Card>
            </div>
        </div>
    )
}

function Delta({ valor, className }) {
    if (valor == null) return <span className={cn('text-xs text-slate-500 flex items-center gap-0.5', className)}><Minus className="w-3 h-3" /> sin base</span>
    const sube = valor > 0
    const plano = Math.abs(valor) < 0.5
    const Icono = plano ? Minus : sube ? ArrowUpRight : ArrowDownRight
    return (
        <span className={cn(
            'text-xs font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border',
            plano ? 'text-slate-400 bg-white/5 border-white/10'
                : sube ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20',
            className
        )}>
            <Icono className="w-3 h-3" />{plano ? '0' : (sube ? '+' : '') + Math.round(valor)}%
        </span>
    )
}

// Polilínea a mano: 4 KPIs × recharts + ResponsiveContainer sería el doble de
// observers y SVG para una línea de 30 puntos sin ejes.
function Sparkline({ serie, color }) {
    const W = 100, H = 32
    const max = Math.max(...serie, 1)
    const paso = serie.length > 1 ? W / (serie.length - 1) : W
    const pts = serie.map((v, i) => `${(i * paso).toFixed(1)},${(H - (v / max) * (H - 2) - 1).toFixed(1)}`)
    const linea = pts.join(' ')
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-7 pointer-events-none" aria-hidden="true">
            <polygon points={`0,${H} ${linea} ${W},${H}`} fill={color} opacity="0.12" />
            <polyline points={linea} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.8" />
        </svg>
    )
}

function Kpi({ label, valor, delta, serie, moneda, color }) {
    return (
        <Card className="px-3.5 pt-3 pb-4 bg-slate-900/50 relative overflow-hidden flex flex-col justify-center min-h-0 min-w-0">
            <div className="flex items-start justify-between gap-2 relative z-10">
                <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider truncate">{label}</p>
                <Delta valor={delta} />
            </div>
            <h3 className="text-xl font-bold text-white truncate relative z-10 leading-tight">
                {moneda ? formatCLP(valor) : valor}
            </h3>
            <Sparkline serie={serie} color={color} />
        </Card>
    )
}

const TONO = {
    bueno: { Icono: Sparkles, clase: 'text-emerald-400 bg-emerald-500/10' },
    ojo: { Icono: AlertTriangle, clase: 'text-amber-400 bg-amber-500/10' },
    neutro: { Icono: Info, clase: 'text-sky-400 bg-sky-500/10' },
}

function Insight({ tono, texto }) {
    const { Icono, clase } = TONO[tono] ?? TONO.neutro
    return (
        <li className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 max-w-full">
            <span className={cn('p-1 rounded-md shrink-0', clase)}><Icono className="w-3.5 h-3.5" /></span>
            <p className="text-sm text-slate-200 leading-snug">{texto}</p>
        </li>
    )
}

function TooltipFantasma({ active, payload }) {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    const f = (d) => d?.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' })
    return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-xl text-xs space-y-1">
            <p className="text-white font-medium">{f(p.fecha)} · <span className="text-primary">{formatCLP(p.ventas)}</span></p>
            <p className="text-slate-400">{f(p.fechaPrevio)} · {formatCLP(p.previo)}</p>
        </div>
    )
}

// Semana ordenada lunes→domingo; getDay() da 0 = domingo.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]

function MapaCalor({ mapa, color }) {
    const { celdas, max } = mapa
    return (
        <div className="flex-1 min-h-0 grid grid-cols-[auto_1fr] grid-rows-[1fr_auto] gap-x-2 gap-y-1 text-[10px] text-slate-500">
            <div className="grid grid-rows-7 gap-[3px] items-center">
                {ORDEN_DIAS.map(d => <span key={d} className="leading-none">{DIAS[d]}</span>)}
            </div>
            <div className="grid grid-rows-7 gap-[3px] min-h-0">
                {ORDEN_DIAS.map(d => (
                    <div key={d} className="grid grid-cols-24 gap-[3px] min-h-0">
                        {celdas[d].map((c, h) => {
                            const t = max ? c.pedidos / max : 0
                            return (
                                <div
                                    key={h}
                                    title={`${DIAS[d]} ${h}:00 · ${c.pedidos} pedidos · ${formatCLP(c.monto)}`}
                                    className="rounded-[3px] min-h-[10px] bg-white/[0.04] transition-colors"
                                    style={t > 0 ? { backgroundColor: color, opacity: 0.18 + t * 0.82 } : undefined}
                                />
                            )
                        })}
                    </div>
                ))}
            </div>
            <span />
            <div className="grid grid-cols-24 gap-[3px]">
                {Array.from({ length: 24 }, (_, h) => (
                    <span key={h} className="leading-none text-center">{h % 3 === 0 ? h : ''}</span>
                ))}
            </div>
        </div>
    )
}

export default Analisis
