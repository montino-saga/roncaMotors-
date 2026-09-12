import { useEffect, useState } from 'react'
import { ExternalLink, Eye, Loader2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { cn } from '../../lib/utils'

// Carrito de muestra: cubre descuento por ítem, producto exento y varias unidades.
const CARRITO_EJEMPLO = [
    { idProducto: 'KIT-428', nombreProducto: 'Kit de arrastre 428', marcaProducto: 'DID', cantidad: 1, precioVentaLocal: 45990, precioLista: 45990 },
    { idProducto: 'PAST-DEL', nombreProducto: 'Pastillas de freno delanteras', marcaProducto: 'Brembo', cantidad: 2, precioVentaLocal: 12990, precioLista: 14990 },
    { idProducto: 'ACE-10W40', nombreProducto: 'Aceite 10W-40 semisintético 1L', marcaProducto: 'Motul', cantidad: 3, precioVentaLocal: 8990, precioLista: 8990 },
    { idProducto: 'MANO-OBRA', nombreProducto: 'Mano de obra instalación', cantidad: 1, precioVentaLocal: 15000, precioLista: 15000, afectoIva: false },
]

/** PDF de ejemplo regenerado con cada cambio del formulario (con retardo). */
export function PreviewCotizacion({ settings, className }) {
    const [url, setUrl] = useState(null)
    const [generando, setGenerando] = useState(true)
    const escritorio = useMediaQuery('(min-width: 768px)')

    useEffect(() => {
        if (!settings) return
        let vivo = true
        setGenerando(true)
        const t = setTimeout(async () => {
            try {
                const { generarCotizacion } = await import('../../lib/cotizacion')
                const { doc } = await generarCotizacion({
                    cart: CARRITO_EJEMPLO,
                    precioDe: (i) => i.precioVentaLocal,
                    precioListaDe: (i) => i.precioLista,
                    settings,
                })
                if (!vivo) return
                setUrl(doc.output('bloburl'))
            } catch (error) {
                console.error('Preview cotización:', error)
            } finally {
                if (vivo) setGenerando(false)
            }
        }, 400)
        return () => { vivo = false; clearTimeout(t) }
    }, [settings])

    // Libera el blob anterior al cambiar de URL y el último al desmontar.
    useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

    return (
        <Card className={cn('p-4 bg-slate-900/50 border-white/10 flex flex-col gap-3', className)}>
            <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/15 text-primary">
                        <Eye className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white leading-tight">Vista previa de la cotización</h2>
                        <p className="text-xs text-slate-400">Productos de ejemplo. Se actualiza al editar.</p>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={!url}
                    onClick={() => window.open(url, '_blank', 'noopener')}
                    className="flex items-center gap-2 text-sm"
                >
                    <ExternalLink className="w-4 h-4" /> Abrir PDF
                </Button>
            </div>

            {/* El visor embebido de PDF no existe en Chrome/Safari móvil: allí queda solo el botón. */}
            {escritorio && (
                <div className="relative w-full aspect-[1/1.3] lg:aspect-auto lg:flex-1 lg:min-h-0 rounded-xl overflow-hidden border border-white/10 bg-slate-800">
                    {url && (
                        <iframe
                            title="Cotización de ejemplo"
                            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                            className="w-full h-full"
                        />
                    )}
                    {generando && (
                        <div className="absolute inset-0 grid place-items-center bg-slate-950/40 backdrop-blur-sm text-slate-300">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    )}
                </div>
            )}
        </Card>
    )
}
