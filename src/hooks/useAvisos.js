import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../db/firebase";

// Avisos que antes eran toasts fijos tapando la vista. Ahora viven en la
// campana del menú: se ven cuando se quiere, no cada vez que se abre la app.
export function useAvisos() {
    const [caja, setCaja] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "cash_registers"), where("status", "==", "open"), limit(1));
        return onSnapshot(q, (snap) => {
            if (snap.empty) return setCaja(null);
            const abierta = snap.docs[0].data().openingTime?.toDate();
            if (!abierta) return setCaja(null);
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            // Abierta hoy es lo normal; de un día anterior es que se olvidó cerrar.
            if (abierta >= hoy) return setCaja(null);

            const horas = Math.floor((Date.now() - abierta) / 36e5);
            const desde = abierta.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" });
            setCaja({
                id: "caja-abierta",
                titulo: "Caja sin cerrar",
                detalle: `Abierta desde el ${desde} (hace ${horas} h). Ciérrala antes de seguir vendiendo.`,
                accion: { label: "Ir a caja", href: "/" },
            });
        }, (error) => console.error("useAvisos:", error));
    }, []);

    return caja ? [caja] : [];
}
