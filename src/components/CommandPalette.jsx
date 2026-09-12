import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Package, User, ArrowRight, CornerDownLeft, Sun, Moon } from 'lucide-react'
import { cargarClientes, clientesEnCache } from '../lib/clientes'
import { useCatalogo } from '../lib/catalogo'
import { filtrarCatalogo } from '../lib/buscarProductos'
import { formatCLP, cn } from '../lib/utils'
import { useAppearance } from '../context/AppearanceContext'
import { SPRING_SNAPPY } from '../lib/motion'

const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Ctrl/⌘+K: ir a una vista, abrir un producto o un cliente desde cualquier
 * sitio. Los productos salen del catálogo en memoria (0 lecturas).
 */
export function CommandPalette({ open, onClose, navItems }) {
    return (
        <AnimatePresence>
            {open && <Paleta onClose={onClose} navItems={navItems} />}
        </AnimatePresence>
    )
}

// Se monta al abrir y se desmonta al cerrar: cada apertura arranca limpia.
function Paleta({ onClose, navItems }) {
    const navigate = useNavigate()
    const { productos, porCodigo } = useCatalogo()
    const { resolved, setMode } = useAppearance()
    const [term, setTerm] = useState('')
    const [clientes, setClientes] = useState(clientesEnCache)
    const [idx, setIdx] = useState(0)
    const inputRef = useRef(null)
    const listRef = useRef(null)

    useEffect(() => {
        let vivo = true
        cargarClientes().then((c) => { if (vivo) setClientes(c) }).catch(() => {})
        // Tras la animación de entrada el input ya existe.
        const t = setTimeout(() => inputRef.current?.focus(), 30)
        return () => { vivo = false; clearTimeout(t) }
    }, [])

    const grupos = useMemo(() => {
        const t = norm(term.trim())
        const vistas = navItems
            .filter((i) => !t || norm(i.label).includes(t))
            .map((i) => ({ id: `nav:${i.href}`, grupo: 'Ir a', label: i.label, Icon: i.icon, run: () => navigate(i.href) }))
        const acciones = [{
            id: 'tema', grupo: 'Acciones',
            label: resolved === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
            Icon: resolved === 'dark' ? Sun : Moon,
            run: () => setMode(resolved === 'dark' ? 'light' : 'dark'),
        }].filter((a) => !t || norm(a.label).includes(t))
        const prods = t.length >= 2
            ? filtrarCatalogo(productos, porCodigo, term.trim(), 6).map((p) => ({
                id: `p:${p.id}`, grupo: 'Productos', label: p.nombreProducto, Icon: Package,
                hint: `${p.idProducto}${p.marcaProducto ? ` · ${p.marcaProducto}` : ''}`,
                extra: formatCLP(p.precioVentaLocal ?? 0),
                run: () => navigate(`/editar/${p.id}`),
            }))
            : []
        const cls = t.length >= 2
            ? clientes
                .filter((c) => [c.name, c.rut, c.phone, c.email].some((v) => norm(v).includes(t)))
                .slice(0, 6)
                .map((c) => ({
                    id: `c:${c.id}`, grupo: 'Clientes', label: c.name, Icon: User,
                    hint: [c.rut, c.phone].filter(Boolean).join(' · '),
                    run: () => navigate(`/clientes/${c.id}`),
                }))
            : []
        return [...vistas, ...prods, ...cls, ...acciones]
    }, [term, navItems, productos, porCodigo, clientes, resolved, setMode, navigate])

    useEffect(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
    }, [idx])

    const ejecutar = (item) => { if (!item) return; onClose(); item.run() }

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, grupos.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter') { e.preventDefault(); ejecutar(grupos[idx]) }
        else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }

    return (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={SPRING_SNAPPY}
                        onClick={onClose}
                        aria-hidden="true"
                        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                    />
                    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[12vh] pointer-events-none">
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-label="Buscar en la app"
                            initial={{ opacity: 0, scale: 0.97, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: -8 }}
                            transition={SPRING_SNAPPY}
                            className="w-full max-w-xl pointer-events-auto rounded-2xl overflow-hidden
                                       bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50
                                       reduce-transparency:bg-slate-900 reduce-transparency:backdrop-blur-none"
                        >
                            <div className="relative border-b border-white/10">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    ref={inputRef}
                                    value={term}
                                    onChange={(e) => { setTerm(e.target.value); setIdx(0) }}
                                    onKeyDown={onKeyDown}
                                    placeholder="Buscar producto, cliente o vista…"
                                    role="combobox"
                                    aria-expanded="true"
                                    aria-controls="paleta-resultados"
                                    aria-activedescendant={grupos[idx]?.id}
                                    autoComplete="off"
                                    className="w-full h-14 pl-12 pr-16 bg-transparent text-white text-base
                                               placeholder:text-slate-500 outline-none"
                                />
                                <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-slate-500
                                                border border-white/10 rounded px-1.5 py-0.5">Esc</kbd>
                            </div>

                            <ul
                                id="paleta-resultados"
                                ref={listRef}
                                role="listbox"
                                className="max-h-[50vh] overflow-y-auto py-2 custom-scrollbar"
                            >
                                {grupos.length === 0 && (
                                    <li className="px-4 py-8 text-center text-sm text-slate-500">Sin resultados</li>
                                )}
                                {grupos.map((item, i) => {
                                    const nuevoGrupo = i === 0 || grupos[i - 1].grupo !== item.grupo
                                    const Icon = item.Icon
                                    return (
                                        <li key={item.id} role="presentation">
                                            {nuevoGrupo && (
                                                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
                                                    {item.grupo}
                                                </p>
                                            )}
                                            <div
                                                id={item.id}
                                                role="option"
                                                aria-selected={i === idx}
                                                onMouseEnter={() => setIdx(i)}
                                                onMouseDown={(e) => { e.preventDefault(); ejecutar(item) }}
                                                className={cn(
                                                    'mx-2 px-3 h-11 flex items-center gap-3 rounded-lg cursor-pointer text-sm',
                                                    i === idx ? 'bg-primary/20 text-white' : 'text-slate-300'
                                                )}
                                            >
                                                <Icon className={cn('w-4 h-4 shrink-0', i === idx ? 'text-primary' : 'text-slate-400')} />
                                                <span className="truncate font-medium">{item.label}</span>
                                                {item.hint && <span className="truncate text-xs text-slate-500">{item.hint}</span>}
                                                <span className="ml-auto shrink-0 text-xs tabular-nums text-emerald-400">{item.extra}</span>
                                                {i === idx
                                                    ? <CornerDownLeft className="w-4 h-4 shrink-0 text-slate-500" />
                                                    : <ArrowRight className="w-4 h-4 shrink-0 text-transparent" />}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </motion.div>
                    </div>
                </>
    )
}
