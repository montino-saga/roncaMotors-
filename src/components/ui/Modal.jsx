import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { SPRING_SNAPPY, PRESS } from "../../lib/motion";

/**
 * @param dismissible  false mientras corre una escritura: bloquea Escape, backdrop y X
 *                     a la vez, en vez de dejar dos salidas abiertas y una cerrada.
 * @param origin       transform-origin ("bottom left"…) para nacer desde su disparador.
 */
export function Modal({
    isOpen, onClose, title, children, className,
    dismissible = true, origin = "center"
}) {
    const panelRef = useRef(null);
    const restoreRef = useRef(null);

    // onClose suele ser una arrow inline: nueva identidad en cada render. Si
    // el efecto dependiera de ella, cada tecla lo reiniciaría y el cleanup
    // devolvería el foco al disparador a mitad de escritura.
    const onCloseRef = useRef(onClose);
    const dismissibleRef = useRef(dismissible);
    useEffect(() => {
        onCloseRef.current = onClose;
        dismissibleRef.current = dismissible;
    });

    useEffect(() => {
        if (!isOpen) return;

        restoreRef.current = document.activeElement;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKey = (e) => {
            if (e.key === "Escape" && dismissibleRef.current) {
                e.stopPropagation();
                onCloseRef.current?.();
                return;
            }
            if (e.key !== "Tab") return;

            // Focus trap: el foco no puede salir del diálogo con el teclado.
            const focusables = panelRef.current?.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!focusables?.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        window.addEventListener("keydown", onKey, true);
        return () => {
            window.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
            restoreRef.current?.focus?.();
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={SPRING_SNAPPY}
                        onClick={dismissible ? onClose : undefined}
                        aria-hidden="true"
                        className={cn(
                            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
                            !dismissible && "cursor-progress"
                        )}
                    />

                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            ref={panelRef}
                            role="dialog"
                            aria-modal="true"
                            aria-label={title}
                            // Materializar, no fundir: el desenfoque y la escala
                            // llegan juntos, así la superficie se lee como material.
                            initial={{ opacity: 0, scale: 0.96, backdropFilter: "blur(0px)" }}
                            animate={{ opacity: 1, scale: 1, backdropFilter: "blur(24px)" }}
                            exit={{ opacity: 0, scale: 0.96, backdropFilter: "blur(0px)" }}
                            transition={SPRING_SNAPPY}
                            style={{ transformOrigin: origin }}
                            className={cn(
                                "w-full max-w-lg rounded-2xl pointer-events-auto overflow-hidden",
                                "bg-slate-900/80 border border-white/10 shadow-2xl shadow-black/60",
                                "reduce-transparency:bg-slate-900 reduce-transparency:backdrop-blur-none",
                                "more-contrast:border-white/40",
                                className
                            )}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <h3 className="text-xl font-semibold text-white tracking-[-0.01em]">{title}</h3>
                                <button
                                    onClick={onClose}
                                    disabled={!dismissible}
                                    aria-label="Cerrar"
                                    className={cn(
                                        "h-10 w-10 grid place-items-center rounded-xl text-slate-300",
                                        "hover:text-white hover:bg-white/10 disabled:opacity-30",
                                        "disabled:pointer-events-none outline-none",
                                        "focus-visible:ring-2 focus-visible:ring-primary/60", PRESS
                                    )}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">{children}</div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
