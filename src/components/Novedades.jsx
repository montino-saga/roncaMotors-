import { useState } from "react";
import { ChevronDown, Wrench, ArrowUpCircle, Plus, Route, PlayCircle } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";
import { RELEASES, VERSION_ACTUAL, ETIQUETA_TIPO } from "../lib/releases";

const ICONO_TIPO = { nuevo: Plus, mejora: ArrowUpCircle, arreglo: Wrench };
const COLOR_TIPO = {
    nuevo: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    mejora: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
    arreglo: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
};

const fechaLarga = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

function Etiqueta({ tipo }) {
    const Icono = ICONO_TIPO[tipo];
    return (
        <span className={cn("inline-flex items-center gap-1 shrink-0 h-5 px-1.5 rounded-md text-[11px] font-semibold ring-1 ring-inset", COLOR_TIPO[tipo])}>
            <Icono className="w-3 h-3" />
            {ETIQUETA_TIPO[tipo]}
        </span>
    );
}

function Release({ r, nueva, abierta, onToggle, onVerNovedad }) {
    return (
        <li className="relative pl-5 border-l border-white/10">
            <span className={cn(
                "absolute -left-[5px] top-2 w-[9px] h-[9px] rounded-full ring-2 ring-slate-900",
                nueva ? "bg-primary" : "bg-white/30"
            )} />
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={abierta}
                className="w-full text-left flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg -mx-1 px-1 py-0.5
                           hover:bg-white/[0.04] outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
                <h4 className="text-base font-semibold text-white">Versión {r.version}</h4>
                {nueva && (
                    <span className="h-5 px-1.5 rounded-md text-[11px] font-semibold bg-primary/20 text-primary ring-1 ring-inset ring-primary/40">
                        Nueva
                    </span>
                )}
                <time dateTime={r.fecha} className="text-xs text-slate-400 ml-auto">{fechaLarga(r.fecha)}</time>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", abierta && "rotate-180")} />
                <p className="w-full text-sm text-slate-300">{r.titulo}</p>
            </button>
            {abierta && (
                <>
                    <ul className="mt-3 space-y-3">
                        {r.cambios.map((c) => (
                            <li key={c.titulo} className="flex gap-3">
                                <Etiqueta tipo={c.tipo} />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white leading-tight">{c.titulo}</p>
                                    <p className="text-sm text-slate-300/80 mt-0.5">{c.detalle}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {r.tour && (
                        <Button
                            variant="secondary"
                            onClick={() => onVerNovedad(r.tour)}
                            className="mt-3 h-9 inline-flex items-center gap-2 text-sm"
                        >
                            <PlayCircle className="w-4 h-4" /> Ver cómo funciona
                        </Button>
                    )}
                </>
            )}
        </li>
    );
}

// Historial de versiones. Solo las no leídas vienen desplegadas: el resto se
// abre a demanda, para no obligar a leerlo todo.
export function Novedades({ abierto, versionVista, onCerrar, onRepetirTutorial, onVerNovedad }) {
    const idxVista = RELEASES.findIndex((r) => r.version === versionVista);
    const esNueva = (idx) => (idxVista === -1 ? idx === 0 : idx < idxVista);
    const [abiertas, setAbiertas] = useState(() => new Set(RELEASES.filter((_, i) => esNueva(i)).map((r) => r.version)));
    const toggle = (v) => setAbiertas((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });

    return (
        <Modal isOpen={abierto} onClose={onCerrar} title="Novedades" className="max-w-xl">
            <div className="flex flex-wrap items-center gap-3 -mt-1 mb-5">
                <p className="text-sm text-slate-300/80 flex-1 min-w-[10rem]">
                    Versión actual: <span className="text-white font-medium">{VERSION_ACTUAL}</span>
                </p>
                <Button variant="secondary" onClick={onRepetirTutorial} className="h-9 inline-flex items-center gap-2 text-sm">
                    <Route className="w-4 h-4" /> Repetir recorrido
                </Button>
            </div>

            <ol className="space-y-5">
                {RELEASES.map((r, idx) => (
                    <Release key={r.version} r={r} nueva={esNueva(idx)} abierta={abiertas.has(r.version)} onToggle={() => toggle(r.version)} onVerNovedad={onVerNovedad} />
                ))}
            </ol>
        </Modal>
    );
}
