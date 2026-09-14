import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "../lib/utils";
import { SPRING } from "../lib/motion";
import { Button } from "./ui/Button";

const PAD = 6;        // aire alrededor del elemento iluminado
const GAP = 14;       // distancia entre el foco y la tarjeta
const ANCHO = 320;
const ESPERA_MS = 2500;

const mismoRect = (a, b) =>
    a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

const rectDe = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
};

// Posición de la tarjeta según el lado pedido; si no cabe, se voltea. En
// pantallas angostas va pegada abajo, sin flecha: no hay sitio al lado.
const colocar = (foco, lado, tam, vw, vh) => {
    if (vw < 640) return { lado: "dock", top: vh - tam.h - 12, left: 12, width: vw - 24 };
    const cabe = {
        right: foco.left + foco.width + GAP + tam.w <= vw,
        left: foco.left - GAP - tam.w >= 0,
        bottom: foco.top + foco.height + GAP + tam.h <= vh,
        top: foco.top - GAP - tam.h >= 0,
    };
    const orden = { right: ["right", "left", "bottom", "top"], left: ["left", "right", "bottom", "top"],
                    bottom: ["bottom", "top", "right", "left"], top: ["top", "bottom", "right", "left"] };
    const l = (orden[lado] ?? orden.bottom).find((k) => cabe[k]) ?? "bottom";
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const cx = foco.left + foco.width / 2, cy = foco.top + foco.height / 2;
    let top, left;
    if (l === "right" || l === "left") {
        top = clamp(cy - tam.h / 2, 12, vh - tam.h - 12);
        left = l === "right" ? foco.left + foco.width + GAP : foco.left - GAP - tam.w;
    } else {
        left = clamp(cx - tam.w / 2, 12, vw - tam.w - 12);
        top = l === "bottom" ? foco.top + foco.height + GAP : foco.top - GAP - tam.h;
    }
    // La flecha apunta al centro del foco aunque la tarjeta se haya desplazado.
    const flecha = (l === "right" || l === "left") ? { top: clamp(cy - top, 16, tam.h - 16) } : { left: clamp(cx - left, 16, tam.w - 16) };
    return { lado: l, top, left, width: ANCHO, flecha };
};

const FLECHA = {
    right: "left-0 -translate-x-1/2 -translate-y-1/2",
    left: "right-0 translate-x-1/2 -translate-y-1/2",
    bottom: "top-0 -translate-y-1/2 -translate-x-1/2",
    top: "bottom-0 translate-y-1/2 -translate-x-1/2",
};

/**
 * Recorrido guiado: ilumina un elemento real de la pantalla y pone al lado
 * una tarjeta con flecha. Navega entre vistas por sí solo.
 * @param onPaso  avisa al Layout antes de medir (abrir/cerrar el drawer en móvil)
 */
export function Tour({ pasos, onFin, onPaso }) {
    const [i, setI] = useState(0);
    const [foco, setFoco] = useState(null);
    const [pos, setPos] = useState(null);
    const tarjetaRef = useRef(null);
    const elRef = useRef(null);
    const { pathname } = useLocation();
    const navigate = useNavigate();
    // El Layout pasa una arrow nueva en cada render; no debe reiniciar la espera.
    const onPasoRef = useRef(onPaso);
    useEffect(() => { onPasoRef.current = onPaso; });

    const paso = pasos[i];
    const ultimo = i === pasos.length - 1;
    const enRuta = !paso.ruta || pathname === paso.ruta;

    useEffect(() => {
        if (!enRuta) navigate(paso.ruta);
    }, [enRuta, paso.ruta, navigate]);

    // Espera al elemento (la vista puede estar cargando en lazy) y lo sigue
    // frame a frame: el sidebar se pliega y el drawer desliza con muelle.
    useEffect(() => {
        if (!enRuta) return;
        onPasoRef.current?.(paso);
        let vivo = true, raf, inicio = performance.now();
        elRef.current = null;
        const tick = () => {
            if (!vivo) return;
            let el = elRef.current;
            if (!el || !el.isConnected) {
                el = document.querySelector(paso.target);
                if (!el && performance.now() - inicio > ESPERA_MS) el = document.querySelector('[data-tour="vista"]');
                if (el && el !== elRef.current) {
                    elRef.current = el;
                    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
                }
            }
            if (el) {
                const r = rectDe(el);
                setFoco((prev) => (mismoRect(prev, r) ? prev : r));
            }
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => { vivo = false; cancelAnimationFrame(raf); };
    }, [i, enRuta, paso]);

    useLayoutEffect(() => {
        if (!foco || !tarjetaRef.current) return;
        const { offsetWidth: w, offsetHeight: h } = tarjetaRef.current;
        setPos(colocar(foco, paso.lado, { w, h }, window.innerWidth, window.innerHeight));
    }, [foco, paso.lado, i]);

    const ir = (n) => { if (n < 0 || n >= pasos.length) return; setPos(null); setI(n); };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") { e.stopPropagation(); onFin(); }
            if (e.key === "ArrowRight" || e.key === "Enter") ultimo ? onFin() : ir(i + 1);
            if (e.key === "ArrowLeft") ir(i - 1);
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    });

    // Foco al botón principal: cada paso se puede avanzar con Enter sin ratón.
    useEffect(() => { tarjetaRef.current?.querySelector("[data-siguiente]")?.focus(); }, [i]);

    const dock = pos?.lado === "dock";

    return createPortal(
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={paso.titulo} onClick={(e) => e.stopPropagation()}>
            <AnimatePresence>
                {foco && (
                    <motion.div
                        key="foco"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, top: foco.top, left: foco.left, width: foco.width, height: foco.height }}
                        exit={{ opacity: 0 }}
                        transition={SPRING}
                        className="absolute rounded-2xl ring-2 ring-primary/70 pointer-events-none
                                   shadow-[0_0_0_9999px_rgba(2,6,23,0.72)] more-contrast:shadow-[0_0_0_9999px_rgba(0,0,0,0.9)]"
                    />
                )}
            </AnimatePresence>

            {foco && (
                <motion.div
                    ref={tarjetaRef}
                    key={i}
                    initial={{ opacity: 0, top: foco.top, left: foco.left }}
                    animate={{ opacity: pos ? 1 : 0, top: pos?.top ?? foco.top, left: pos?.left ?? foco.left }}
                    transition={SPRING}
                    style={{ width: pos?.width ?? ANCHO, maxWidth: "calc(100vw - 24px)" }}
                    className="absolute rounded-2xl p-4 bg-slate-900 border border-white/10 shadow-2xl shadow-black/60
                               text-white more-contrast:border-white/40"
                >
                    {pos?.flecha && !dock && (
                        <span
                            style={pos.flecha}
                            className={cn("absolute w-3.5 h-3.5 rotate-45 bg-slate-900 border-white/10", FLECHA[pos.lado],
                                pos.lado === "right" && "border-l border-b", pos.lado === "left" && "border-r border-t",
                                pos.lado === "bottom" && "border-l border-t", pos.lado === "top" && "border-r border-b")}
                        />
                    )}
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-primary">Paso {i + 1} de {pasos.length}</p>
                            <h3 className="mt-0.5 text-base font-semibold tracking-[-0.01em]">{paso.titulo}</h3>
                            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{paso.texto}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onFin}
                            aria-label="Salir del recorrido"
                            className="-mt-1 -mr-1 h-8 w-8 shrink-0 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="flex gap-1" aria-hidden="true">
                            {pasos.map((_, n) => (
                                <span key={n} className={cn("h-1 rounded-full transition-all duration-300", n === i ? "w-4 bg-primary" : "w-1 bg-white/20")} />
                            ))}
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            {i > 0 && (
                                <Button variant="secondary" onClick={() => ir(i - 1)} aria-label="Anterior" className="h-9 px-2.5">
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                            )}
                            {ultimo ? (
                                <Button data-siguiente onClick={onFin} className="h-9">Empezar</Button>
                            ) : (
                                <Button data-siguiente onClick={() => ir(i + 1)} className="h-9 inline-flex items-center gap-1 pr-2.5">
                                    Siguiente <ChevronRight className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>,
        document.body
    );
}
