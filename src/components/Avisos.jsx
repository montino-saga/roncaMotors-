import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, BellOff } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export function Avisos({ abierto, avisos, onCerrar }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const ir = (href) => { onCerrar(); navigate(href); };

    return (
        <Modal isOpen={abierto} onClose={onCerrar} title="Avisos" className="max-w-md">
            {avisos.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                    <BellOff className="w-6 h-6" />
                    <p className="text-sm">Sin avisos pendientes</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {avisos.map((a) => (
                        <li key={a.id} className="flex gap-3 p-3 rounded-xl bg-amber-500/10 ring-1 ring-inset ring-amber-400/30">
                            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-300 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-amber-200">{a.titulo}</p>
                                <p className="text-sm text-slate-300/90 mt-0.5">{a.detalle}</p>
                                {a.accion && pathname !== a.accion.href && (
                                    <Button variant="secondary" onClick={() => ir(a.accion.href)} className="h-8 mt-2 text-sm">
                                        {a.accion.label}
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
}
