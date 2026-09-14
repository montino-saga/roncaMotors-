import { useState } from "react";
import { VERSION_ACTUAL } from "../lib/releases";

const KEY_TUTORIAL = "roncamotors_tutorial_visto";
const KEY_VERSION = "roncamotors_version_vista";

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* modo privado */ } };

// Estado del tutorial y de las novedades: el tutorial salta solo la primera
// vez; después queda un punto en el menú hasta que se lea la versión actual.
export function useNovedades() {
    const [modo, setModo] = useState(() => (leer(KEY_TUTORIAL) ? null : "tutorial"));
    const [pendiente, setPendiente] = useState(() => leer(KEY_VERSION) !== VERSION_ACTUAL);
    // Última versión leída antes de abrir la lista: así la lista sabe cuáles
    // etiquetar como nuevas aunque ya se hayan marcado como vistas.
    const [versionVista, setVersionVista] = useState(() => leer(KEY_VERSION));

    const marcarLeida = () => { guardar(KEY_VERSION, VERSION_ACTUAL); setPendiente(false); };
    const abrirTutorial = () => setModo("tutorial");
    const abrirLista = () => { setVersionVista(leer(KEY_VERSION)); setModo("lista"); marcarLeida(); };
    const cerrar = () => {
        if (modo === "tutorial") { guardar(KEY_TUTORIAL, "1"); marcarLeida(); }
        setModo(null);
    };

    return { modo, pendiente, versionVista, abrirTutorial, abrirLista, cerrar };
}
