import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { History } from 'lucide-react'
import { db } from '../../db/firebase'
import { cn, formatCLP } from '../../lib/utils'

const fecha = (ts) => ts?.toDate?.().toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) ?? '—'

/**
 * Últimos cortes Z. orderBy('closingTime') deja fuera la sesión abierta (no
 * tiene el campo) y no necesita índice compuesto.
 */
export function CierresAnteriores({ cantidad = 10, className }) {
    const [cierres, setCierres] = useState(null)

    useEffect(() => {
        let vivo = true
        getDocs(query(collection(db, 'cash_registers'), orderBy('closingTime', 'desc'), limit(cantidad)))
            .then(snap => { if (vivo) setCierres(snap.docs.map(d => ({ id: d.id, ...d.data() }))) })
            .catch(error => {
                console.error('Error cargando cierres:', error)
                if (vivo) setCierres([])
            })
        return () => { vivo = false }
    }, [cantidad])

    return (
        <section className={cn('w-full', className)} aria-label="Cierres anteriores" data-tour="caja-cierres">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-slate-400" /> Cierres anteriores
            </h3>
            {cierres === null ? (
                <p className="text-sm text-slate-500 py-4 text-center">Cargando…</p>
            ) : cierres.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Todavía no hay cierres registrados.</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[480px] text-sm text-left">
                        <thead className="bg-white/5 text-slate-400 text-xs">
                            <tr>
                                <th className="px-3 py-2 font-medium">Cierre</th>
                                <th className="px-3 py-2 font-medium text-right">Esperado</th>
                                <th className="px-3 py-2 font-medium text-right">Contado</th>
                                <th className="px-3 py-2 font-medium text-right">Diferencia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {cierres.map(c => {
                                const dif = Number(c.difference) || 0
                                return (
                                    <tr key={c.id} className="hover:bg-white/5">
                                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                                            {fecha(c.closingTime)}
                                            <span className="block text-[11px] text-slate-500">abrió {fecha(c.openingTime)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{formatCLP(c.expectedBalance)}</td>
                                        <td className="px-3 py-2 text-right text-white tabular-nums">{formatCLP(c.closingBalance)}</td>
                                        <td className={cn('px-3 py-2 text-right font-semibold tabular-nums',
                                            dif === 0 ? 'text-emerald-400' : dif > 0 ? 'text-sky-400' : 'text-red-400')}>
                                            {dif === 0 ? 'Cuadra' : `${dif > 0 ? '+' : ''}${formatCLP(dif)}`}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
