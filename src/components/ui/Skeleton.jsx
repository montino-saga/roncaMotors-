import { cn } from "../../lib/utils"
import { Card } from "./Card"

function Skeleton({ className, ...props }) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-white/5 motion-reduce:animate-none", className)}
            {...props}
        />
    )
}

// Misma Card que el contenido real: la entrada de la vista anima el esqueleto
// y los datos la sustituyen en seco, sin segundo aterrizaje.
function SkeletonCard({ className, lines = 3, children, ...props }) {
    return (
        <Card className={cn("p-5 space-y-3", className)} aria-hidden="true" {...props}>
            {lines > 0 && <Skeleton className="h-3 w-1/3" />}
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton key={i} className={cn("h-4", i === 0 ? "w-2/3" : i % 2 ? "w-full" : "w-5/6")} />
            ))}
            {children}
        </Card>
    )
}

// Fila de KPIs: 4 tarjetas con etiqueta y cifra grande.
function SkeletonKpis({ count = 4, className }) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)} aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <Card key={i} className="p-5 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-32" />
                </Card>
            ))}
        </div>
    )
}

// Cabecera de página: título, subtítulo y (opcional) botones a la derecha.
function SkeletonHeader({ actions = 0 }) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" aria-hidden="true">
            <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>
            {actions > 0 && (
                <div className="flex gap-3">
                    {Array.from({ length: actions }, (_, i) => <Skeleton key={i} className="h-10 w-28 rounded-xl" />)}
                </div>
            )}
        </div>
    )
}

// Filas de tabla/lista.
function SkeletonRows({ rows = 6, className }) {
    return (
        <div className={cn("space-y-2", className)} aria-hidden="true">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                </div>
            ))}
        </div>
    )
}

export { Skeleton, SkeletonCard, SkeletonKpis, SkeletonHeader, SkeletonRows }
