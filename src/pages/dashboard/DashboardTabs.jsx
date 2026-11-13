import { useMemo } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
    AlertCircle, Boxes, Calendar, CreditCard, Layers, Package, PackageX,
    Receipt, Scale, Tag, TrendingDown, UserPlus, Users, Wallet,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { cn, formatCLP } from '../../lib/utils'
import { categoriaDe, resumenGastos } from '../../lib/gastos'
import { useAppearance } from '../../context/AppearanceContext'
import { chartTheme } from '../../lib/chartTheme'

// Tailwind necesita las clases literales: nada de `bg-${color}-500`.
const TONO = {
    pink: 'bg-pink-400',
    blue: 'bg-blue-400',
    indigo: 'bg-indigo-400',
    cyan: 'bg-cyan-400',
    orange: 'bg-orange-400',
    purple: 'bg-purple-400',
    emerald: 'bg-emerald-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
    slate: 'bg-slate-400',
}

const KPI_COLORES = {
    emerald: { borde: 'border-l-emerald-500', icono: 'text-emerald-500', tag: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    purple: { borde: 'border-l-purple-500', icono: 'text-purple-500', tag: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    red: { borde: 'border-l-red-500', icono: 'text-red-500', tag: 'bg-red-500/10 text-red-400 border-red-500/20' },
    blue: { borde: 'border-l-blue-500', icono: 'text-blue-500', tag: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    orange: { borde: 'border-l-orange-500', icono: 'text-orange-500', tag: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    cyan: { borde: 'border-l-cyan-500', icono: 'text-cyan-500', tag: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
}

export function Kpi({ label, value, tag, color, Icon, className }) {
    const c = KPI_COLORES[color]
    return (
        <Card className={cn(
            'px-3.5 py-3 border-l-4 bg-slate-900/50 relative overflow-hidden group hover:bg-slate-900/80 transition-all',
            'flex flex-col justify-center min-h-0 min-w-0 gap-0.5', c.borde, className
        )}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider truncate">{label}</p>
                <Icon className={cn('w-4 h-4 shrink-0 opacity-70', c.icono)} />
            </div>
            <h3 className="text-xl font-bold text-white truncate leading-tight">{value}</h3>
            <span className={cn('text-[10px] px-1.5 py-px rounded-full border self-start', c.tag)}>{tag}</span>
        </Card>
    )
}

export function Mini({ Icon, label, value, alerta }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn('p-1.5 rounded-lg shrink-0', alerta ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-300')}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-slate-400 truncate">{label}</p>
                <p className={cn('text-sm font-bold truncate leading-tight', alerta ? 'text-orange-400' : 'text-white')}>{value}</p>
            </div>
        </div>
    )
}

export function DashboardTab({ id, activeTab, onSelect, Icon, children }) {
    const activa = activeTab === id
    return (
        <button
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={activa}
            aria-controls={`panel-${id}`}
            onClick={() => onSelect(id)}
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                activa ? 'bg-primary text-on-accent' : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
        >
            <Icon className="w-4 h-4 shrink-0" />
            {children}
        </button>
    )
}

// Mismo bento que la pestaña de ventas: cifras a su altura y dos filas iguales.
const Panel = ({ id, children }) => (
    <div
        role="tabpanel"
        id={`panel-${id}`}
        aria-labelledby={`tab-${id}`}
        className="grid grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_1fr_1fr] gap-3 flex-1 lg:min-h-0"
    >
        {children}
    </div>
)

const Lista = ({ Icon, color, titulo, children, vacio, className }) => (
    <Card className={cn('col-span-2 p-0 bg-slate-900/50 overflow-hidden flex flex-col min-h-0 h-72 lg:h-auto', className)}>
        <div className="px-3 py-2 border-b border-white/10 bg-white/5 shrink-0">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Icon className={cn('w-4 h-4', color)} />
                {titulo}
            </h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            {vacio
                ? <div className="h-full flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
                : children}
        </div>
    </Card>
)

const Grafico = ({ Icon, color, titulo, children, className }) => (
    <Card className={cn('col-span-2 p-4 bg-slate-900/50 flex flex-col min-h-0', className)}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2 shrink-0">
            <Icon className={cn('w-4 h-4', color)} />
            {titulo}
        </h3>
        <div className="h-48 lg:h-auto lg:flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
                {children}
            </ResponsiveContainer>
        </div>
    </Card>
)

// Barra de proporción: mismo lenguaje visual que "Por categoría" de Gastos.
const Barra = ({ label, detalle, pct, tono }) => (
    <div className="px-3 py-2">
        <div className="flex justify-between text-xs mb-1 gap-2">
            <span className="text-slate-300 truncate">{label}</span>
            <span className="text-slate-400 font-mono shrink-0">{detalle}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className={cn('h-full rounded-full', tono)} style={{ width: `${pct}%` }} />
        </div>
    </div>
)

const diaCorto = (fecha) => fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
const stockDe = (p) => Number(p.cantidadProducto) || 0
const deudaDe = (c) => Number(c.currentDebt) || 0

/* --------------------------------- Productos --------------------------------- */

export function ProductosTab({ productos, ventasTop }) {
    const ct = chartTheme(useAppearance().resolved)

    const resumen = useMemo(() => {
        const unidades = productos.reduce((acc, p) => acc + stockDe(p), 0)
        const valorCosto = productos.reduce((acc, p) => acc + stockDe(p) * (Number(p.precioOriginal) || 0), 0)
        const valorVenta = productos.reduce((acc, p) => acc + stockDe(p) * (Number(p.precioVentaLocal) || 0), 0)

        const porCategoria = new Map()
        for (const p of productos) {
            const nombre = (p.categoriaProducto || '').trim() || 'Sin categoría'
            const previo = porCategoria.get(nombre) || { nombre, valor: 0 }
            previo.valor += stockDe(p) * (Number(p.precioVentaLocal) || 0)
            porCategoria.set(nombre, previo)
        }

        return {
            unidades,
            valorCosto,
            valorVenta,
            sinStock: productos.filter(p => stockDe(p) <= 0).length,
            stockBajo: productos.filter(p => stockDe(p) > 0 && stockDe(p) < 5).length,
            criticos: [...productos].sort((a, b) => stockDe(a) - stockDe(b)).slice(0, 20),
            categorias: [...porCategoria.values()].sort((a, b) => b.valor - a.valor),
        }
    }, [productos])

    const margen = resumen.valorVenta > 0
        ? ((resumen.valorVenta - resumen.valorCosto) / resumen.valorVenta) * 100
        : 0

    return (
        <Panel id="productos">
            <Kpi label="Productos" value={productos.length} tag={`${resumen.categorias.length} categorías`} color="blue" Icon={Boxes} className="lg:col-span-3" />
            <Kpi label="Unidades en Stock" value={resumen.unidades} tag="Inventario físico" color="cyan" Icon={Package} className="lg:col-span-3" />
            <Kpi label="Inventario a Costo" value={formatCLP(resumen.valorCosto)} tag="Capital inmovilizado" color="purple" Icon={Wallet} className="lg:col-span-3" />
            <Kpi label="Inventario a Venta" value={formatCLP(resumen.valorVenta)} tag={`Margen ${margen.toFixed(1)}%`} color="emerald" Icon={Tag} className="lg:col-span-3" />

            <Card className="col-span-2 lg:col-span-4 p-3 bg-slate-900/50 grid grid-cols-3 gap-2 items-center min-h-0">
                <Mini Icon={PackageX} label="Sin Stock" value={`${resumen.sinStock} prod.`} alerta={resumen.sinStock > 0} />
                <Mini Icon={AlertCircle} label="Stock Bajo" value={`${resumen.stockBajo} prod.`} alerta={resumen.stockBajo > 0} />
                <Mini Icon={Layers} label="Categorías" value={resumen.categorias.length} />
            </Card>

            <Grafico Icon={Boxes} color="text-cyan-400" titulo="Inventario por categoría" className="lg:col-span-8">
                <BarChart data={resumen.categorias.slice(0, 8)} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="nombre" stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} interval={0} />
                    <YAxis stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                    <Tooltip contentStyle={ct.tooltip} cursor={{ fill: ct.cursor }} formatter={(v) => [formatCLP(v), 'Valor a venta']} />
                    <Bar dataKey="valor" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Valor a venta" />
                </BarChart>
            </Grafico>

            <Lista Icon={AlertCircle} color="text-orange-400" titulo="Stock crítico" vacio={resumen.criticos.length === 0} className="sm:col-span-1 lg:col-span-4">
                <div className="divide-y divide-white/5">
                    {resumen.criticos.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 hover:bg-white/5 transition-colors">
                            <div className="min-w-0">
                                <p className="text-sm text-slate-200 truncate">{p.nombreProducto}</p>
                                <p className="text-[10px] text-slate-500 truncate">{p.idProducto}</p>
                            </div>
                            <span className={cn(
                                'text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0',
                                stockDe(p) <= 0 ? 'bg-red-500/20 text-red-400'
                                    : stockDe(p) < 5 ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-white/10 text-white'
                            )}>
                                {stockDe(p)}
                            </span>
                        </div>
                    ))}
                </div>
            </Lista>

            <Lista Icon={Package} color="text-purple-400" titulo="Más vendidos del período" vacio={ventasTop.length === 0} className="lg:col-span-8">
                <div className="divide-y divide-white/5">
                    {ventasTop.map((prod, idx) => (
                        <div key={prod.name} className="flex items-center justify-between gap-2 p-2.5 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className={cn(
                                    'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
                                    idx === 0 ? 'bg-yellow-500/20 text-yellow-400'
                                        : idx === 1 ? 'bg-slate-500/20 text-slate-300'
                                            : idx === 2 ? 'bg-orange-700/20 text-orange-400'
                                                : 'bg-slate-800 text-slate-500'
                                )}>
                                    {idx + 1}
                                </div>
                                <span className="text-sm text-slate-200 truncate">{prod.name}</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded shrink-0">
                                {prod.count}
                            </span>
                        </div>
                    ))}
                </div>
            </Lista>
        </Panel>
    )
}

/* ----------------------------------- Gastos ---------------------------------- */

export function GastosTab({ gastos, ingresos }) {
    const ct = chartTheme(useAppearance().resolved)

    // Sin mes anterior que comparar: aquí el rango lo manda el filtro del dashboard.
    const resumen = useMemo(() => resumenGastos(gastos), [gastos])

    const porDia = useMemo(() => {
        const acc = new Map()
        for (const g of gastos) {
            const fecha = g.fecha?.toDate?.()
            if (!fecha) continue
            const clave = diaCorto(fecha)
            const previo = acc.get(clave) || { date: clave, monto: 0, orden: 0 }
            previo.monto += Number(g.monto) || 0
            previo.orden = Math.max(previo.orden, fecha.getTime())
            acc.set(clave, previo)
        }
        return [...acc.values()].sort((a, b) => a.orden - b.orden)
    }, [gastos])

    const mayorGasto = useMemo(
        () => gastos.reduce((max, g) => Math.max(max, Number(g.monto) || 0), 0),
        [gastos]
    )

    const promedio = resumen.cantidad > 0 ? resumen.total / resumen.cantidad : 0
    const balance = ingresos - resumen.total
    // Intl pone el signo antes del peso ("$-25.000"); en un balance se lee mal.
    const balanceTexto = balance < 0 ? `−${formatCLP(-balance)}` : formatCLP(balance)

    return (
        <Panel id="gastos">
            <Kpi label="Gastos del Período" value={formatCLP(resumen.total)} tag={`${resumen.cantidad} registros`} color="red" Icon={Receipt} className="lg:col-span-3" />
            <Kpi
                label="Balance"
                value={balanceTexto}
                tag={balance >= 0 ? 'Ingresos − gastos' : 'En rojo'}
                color={balance >= 0 ? 'emerald' : 'red'}
                Icon={Scale}
                className="lg:col-span-3"
            />
            <Kpi label="Gasto Promedio" value={formatCLP(promedio)} tag="Por registro" color="orange" Icon={TrendingDown} className="lg:col-span-3" />
            <Kpi
                label="Mayor Categoría"
                value={resumen.mayor ? resumen.mayor.label : '—'}
                tag={resumen.mayor ? `${formatCLP(resumen.mayor.monto)} · ${Math.round(resumen.mayor.pct)}%` : 'Sin gastos'}
                color="purple"
                Icon={Layers}
                className="lg:col-span-3"
            />

            <Card className="col-span-2 lg:col-span-4 p-3 bg-slate-900/50 grid grid-cols-3 gap-2 items-center min-h-0">
                <Mini Icon={Receipt} label="Registros" value={resumen.cantidad} />
                <Mini Icon={Wallet} label="Gasto Mayor" value={formatCLP(mayorGasto)} />
                <Mini Icon={Calendar} label="Días con Gasto" value={porDia.length} />
            </Card>

            <Grafico Icon={TrendingDown} color="text-red-400" titulo="Gastos por día" className="lg:col-span-8">
                <BarChart data={porDia} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="date" stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} />
                    <YAxis stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                    <Tooltip contentStyle={ct.tooltip} cursor={{ fill: ct.cursor }} formatter={(v) => [formatCLP(v), 'Gastos']} />
                    <Bar dataKey="monto" fill="#f87171" radius={[4, 4, 0, 0]} name="Gastos" />
                </BarChart>
            </Grafico>

            <Lista Icon={Layers} color="text-pink-400" titulo="Por categoría" vacio={resumen.porCategoria.length === 0} className="sm:col-span-1 lg:col-span-4">
                <div className="py-1">
                    {resumen.porCategoria.map((c) => (
                        <Barra key={c.id} label={c.label} detalle={`${formatCLP(c.monto)} · ${Math.round(c.pct)}%`} pct={c.pct} tono={TONO[c.color]} />
                    ))}
                </div>
            </Lista>

            <Lista Icon={Receipt} color="text-red-400" titulo="Detalle de gastos" vacio={gastos.length === 0} className="lg:col-span-8">
                <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-white/5">
                        {gastos.map((g) => {
                            const c = categoriaDe(g.categoria)
                            const fecha = g.fecha?.toDate?.()
                            return (
                                <tr key={g.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2.5">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm text-white font-medium truncate">{g.descripcion || c.label}</span>
                                            <span className="text-[10px] text-slate-500">
                                                {c.label}{fecha ? ` · ${diaCorto(fecha)}` : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-2.5 text-right">
                                        <span className="text-sm font-bold text-red-400 whitespace-nowrap">
                                            −{formatCLP(Number(g.monto) || 0)}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Lista>
        </Panel>
    )
}

/* ---------------------------------- Clientes --------------------------------- */

export function ClientesTab({ clientes, loading, rango }) {
    const ct = chartTheme(useAppearance().resolved)

    const resumen = useMemo(() => {
        const conDeuda = clientes.filter(c => deudaDe(c) > 0)
        const deudaTotal = conDeuda.reduce((acc, c) => acc + deudaDe(c), 0)
        const creadoEn = (c) => c.createdAt?.toDate?.()
        const nuevos = rango
            ? clientes.filter(c => {
                const fecha = creadoEn(c)
                return fecha && fecha >= rango.desde && fecha <= rango.hasta
            }).length
            : 0

        return {
            conDeuda,
            deudaTotal,
            nuevos,
            alDia: clientes.length - conDeuda.length,
            conPatente: clientes.filter(c => (c.patente || '').trim()).length,
            promedio: conDeuda.length > 0 ? deudaTotal / conDeuda.length : 0,
            deudores: [...conDeuda].sort((a, b) => deudaDe(b) - deudaDe(a)),
            recientes: [...clientes]
                .sort((a, b) => (creadoEn(b)?.getTime() ?? 0) - (creadoEn(a)?.getTime() ?? 0))
                .slice(0, 20),
        }
    }, [clientes, rango])

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
                <SkeletonCard lines={5} className="p-5" />
                <SkeletonCard lines={5} className="p-5" />
            </div>
        )
    }

    const morosidad = clientes.length ? Math.round((resumen.conDeuda.length / clientes.length) * 100) : 0

    return (
        <Panel id="clientes">
            <Kpi label="Clientes" value={clientes.length} tag={`${resumen.conPatente} con patente`} color="blue" Icon={Users} className="lg:col-span-3" />
            <Kpi label="Con Deuda" value={resumen.conDeuda.length} tag={`${resumen.alDia} al día`} color="orange" Icon={CreditCard} className="lg:col-span-3" />
            <Kpi label="Deuda Total" value={formatCLP(resumen.deudaTotal)} tag="Saldo global" color="red" Icon={Wallet} className="lg:col-span-3" />
            <Kpi label="Deuda Promedio" value={formatCLP(resumen.promedio)} tag="Entre los que deben" color="purple" Icon={Scale} className="lg:col-span-3" />

            <Card className="col-span-2 lg:col-span-4 p-3 bg-slate-900/50 grid grid-cols-3 gap-2 items-center min-h-0">
                <Mini Icon={UserPlus} label="Nuevos del Período" value={resumen.nuevos} />
                <Mini Icon={Users} label="Sin Deuda" value={resumen.alDia} />
                <Mini Icon={CreditCard} label="Morosidad" value={`${morosidad}%`} alerta={resumen.conDeuda.length > 0} />
            </Card>

            <Grafico Icon={CreditCard} color="text-red-400" titulo="Mayores deudores" className="lg:col-span-8">
                <BarChart
                    data={resumen.deudores.slice(0, 8).map(c => ({ name: c.name || 'Sin nombre', deuda: deudaDe(c) }))}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="name" stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} interval={0} />
                    <YAxis stroke={ct.axis} tick={{ fill: ct.axis, fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                    <Tooltip contentStyle={ct.tooltip} cursor={{ fill: ct.cursor }} formatter={(v) => [formatCLP(v), 'Deuda']} />
                    <Bar dataKey="deuda" fill="#f87171" radius={[4, 4, 0, 0]} name="Deuda" />
                </BarChart>
            </Grafico>

            <Lista Icon={Wallet} color="text-red-400" titulo="Deudas pendientes" vacio={resumen.deudores.length === 0} className="sm:col-span-1 lg:col-span-4">
                <div className="py-1">
                    {resumen.deudores.map((c) => (
                        <Barra
                            key={c.id}
                            label={c.name || 'Sin nombre'}
                            detalle={formatCLP(deudaDe(c))}
                            pct={resumen.deudaTotal ? (deudaDe(c) / resumen.deudaTotal) * 100 : 0}
                            tono={TONO.red}
                        />
                    ))}
                </div>
            </Lista>

            <Lista Icon={UserPlus} color="text-blue-400" titulo="Clientes recientes" vacio={resumen.recientes.length === 0} className="lg:col-span-8">
                <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-white/5">
                        {resumen.recientes.map((c) => {
                            const creado = c.createdAt?.toDate?.()
                            return (
                                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2.5">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm text-white font-medium truncate">{c.name || 'Sin nombre'}</span>
                                            <span className="text-[10px] text-slate-500 truncate">
                                                {[c.patente, c.phone].filter(Boolean).join(' · ') || (creado ? diaCorto(creado) : '—')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-2.5 text-right">
                                        <span className={cn('text-sm font-bold whitespace-nowrap', deudaDe(c) > 0 ? 'text-red-400' : 'text-slate-500')}>
                                            {deudaDe(c) > 0 ? formatCLP(deudaDe(c)) : 'Al día'}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Lista>
        </Panel>
    )
}
