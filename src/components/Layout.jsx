import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";

import {
    Package, PlusCircle, LayoutDashboard, ShoppingCart, BarChart3, History,
    Globe, Lock, PanelLeft, PanelLeftClose, User, LogOut, Menu, Settings,
    Search, Sun, Moon, Plus, FlaskConical, Receipt, Sparkles, Bell
} from "lucide-react";
import {
    motion, MotionConfig, animate, useMotionValue, useSpring,
    useTransform, useReducedMotion
} from "framer-motion";
import { cn } from "../lib/utils";
import { PRESS } from "../lib/motion";
import { usePersistedState } from "../hooks/usePersistedState";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAppearance } from "../context/AppearanceContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { CommandPalette } from "./CommandPalette";
import { Novedades } from "./Novedades";
import { Avisos } from "./Avisos";
import { Tour } from "./Tour";
import { PASOS_TOUR } from "../lib/tour";
import { useNovedades } from "../hooks/useNovedades";
import { useAvisos } from "../hooks/useAvisos";
import { VERSION_ACTUAL } from "../lib/releases";

const W_OPEN = 264;
const W_SHUT = 76;
const DRAWER_W = 288;

const SPRING = { type: "spring", bounce: 0, duration: 0.4 };
const SPRING_DRAWER = { type: "spring", bounce: 0.2, duration: 0.3 };

// useSpring quiere parámetros físicos, no una transición: {type,bounce,duration}
// se ignora en silencio y el valor salta. Esto es el mismo muelle traducido —
// damping ratio 1.0, response 0.4s (el "move/reposition" de Apple):
//   ω = 2π/0.4 ≈ 15.7   ·   k = ω²m ≈ 247   ·   c = 2ζ√(km) ≈ 31.4
const SPRING_WIDTH = { stiffness: 247, damping: 31.4, mass: 1, restDelta: 0.5 };

// Proyección del punto de reposo de un flick (Designing Fluid Interfaces).
// No es v²/2a: es decaimiento exponencial, igual que la inercia del scroll.
const project = (velocity, deceleration = 0.998) =>
    (velocity / 1000) * deceleration / (1 - deceleration);

const navSections = [
    {
        title: "Caja y Ventas",
        items: [
            { href: "/", label: "Cierre de Caja", icon: Lock },
            { href: "/ventas", label: "Punto de Venta", icon: ShoppingCart },
            { href: "/clientes", label: "Clientes", icon: User },
            { href: "/pedidos-web", label: "Pedidos Web", icon: Globe },
            { href: "/gastos", label: "Gastos", icon: Receipt },
        ]
    },
    {
        title: "Inventario",
        items: [
            { href: "/productos", label: "Productos", icon: Package },
            { href: "/crear", label: "Crear Producto", icon: PlusCircle },
        ]
    },
    {
        title: "Reportes",
        items: [
            { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
            { href: "/analisis", label: "Análisis", icon: FlaskConical },
            { href: "/historial", label: "Historial", icon: History },
        ]
    },
    {
        title: "Sistema",
        items: [
            { href: "/configuracion", label: "Configuración", icon: Settings },
        ]
    }
];

const isRouteActive = (pathname, href) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

// Acción principal de cada vista para la barra móvil: lo que se hace más en
// esa pantalla, a un toque, sin buscar el botón dentro del contenido.
const accionMovil = (pathname) => {
    if (pathname === "/productos") return { label: "Crear producto", href: "/crear" };
    if (pathname === "/clientes") return { label: "Nuevo cliente", href: "/clientes?nuevo=1" };
    return null;
};

const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Fuera de Layout: si se define dentro, React lo trata como un tipo nuevo en
// cada render, remonta la nav entera y el layoutId nunca llega a animar.
function NavItem({ item, active, showTooltip, labelOpacity }) {
    const Icon = item.icon;
    return (
        <Link
            to={item.href}
            data-tour={`nav${item.href}`}
            title={showTooltip ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
                // El feedback vive en el pointer-down, no en el hover ni en el click.
                "relative flex items-center h-11 px-[14px] rounded-xl",
                "transition-transform duration-100 ease-out active:scale-[0.98]",
                "outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                active ? "text-white" : "text-slate-300 hover:bg-white/[0.06]"
            )}
        >
            {active && (
                <motion.span
                    layoutId="nav-active"
                    transition={SPRING}
                    className="absolute inset-0 rounded-xl bg-primary/[0.14] ring-1 ring-inset ring-primary/30
                               shadow-[0_0_20px_-6px_var(--color-primary)]
                               reduce-transparency:bg-primary/30 more-contrast:ring-white/50"
                >
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                </motion.span>
            )}
            <Icon className={cn("relative w-5 h-5 shrink-0", active ? "text-primary" : "text-slate-400")} />
            <motion.span
                style={{ opacity: labelOpacity }}
                className="relative ml-3 text-sm font-medium whitespace-nowrap overflow-hidden"
            >
                {item.label}
            </motion.span>
        </Link>
    );
}

export function Layout({ children }) {
    const location = useLocation();
    const { settings, loading } = useTheme();
    const { user, logout } = useAuth();
    const { resolved, setMode } = useAppearance();

    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [paletaOpen, setPaletaOpen] = useState(false);
    const novedades = useNovedades();
    const avisos = useAvisos();
    const [avisosOpen, setAvisosOpen] = useState(false);
    const navItems = navSections.flatMap((s) => s.items);

    // Pestaña e historial del navegador con nombre de vista, no solo la marca.
    useEffect(() => {
        const item = navItems.find((i) => isRouteActive(location.pathname, i.href));
        document.title = item ? `${item.label} · ${settings.businessName}` : settings.businessName;
    }, [location.pathname, navItems, settings.businessName]);

    // Ctrl/⌘+K desde cualquier sitio, incluso con foco en un input.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setPaletaOpen((o) => !o);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    const reduce = useReducedMotion();

    const [collapsed, setCollapsed] = usePersistedState("roncamotors_nav_collapsed", false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerRef = useRef(null);

    // El recorrido señala items del menú: en móvil viven en el drawer.
    const onPasoTour = useCallback((paso) => {
        if (!isDesktop) setDrawerOpen(!!paso.menu);
    }, [isDesktop]);

    // Una sola fuente de verdad para el ancho: el aside y el padding del main
    // leen el mismo valor, así no pueden desincronizarse.
    const target = useMotionValue(collapsed ? W_SHUT : W_OPEN);
    const spring = useSpring(target, SPRING_WIDTH);
    const width = reduce ? target : spring;
    useEffect(() => {
        target.set(!isDesktop ? W_OPEN : collapsed ? W_SHUT : W_OPEN);
    }, [collapsed, isDesktop, target]);

    // Los textos se desvanecen acoplados al ancho real de la caja, no en un
    // corte binario: un gesto, un tiempo.
    const labelOpacity = useTransform(width, [W_SHUT + 24, W_OPEN - 48], [0, 1]);
    const avatarPad = useTransform(width, [W_SHUT, W_OPEN], [6, 14]);

    // El main NO anima su padding: animar layout re-fluye todo {children}
    // (tablas, charts) en cada frame. El hueco real se fija de golpe —un solo
    // reflow— y el desplazamiento visible se hace con translateX (compositor).
    const padLeft = !isDesktop ? 0 : collapsed ? W_SHUT : W_OPEN;
    const slide = useMotionValue(0);
    const prevPad = useRef(padLeft);
    useLayoutEffect(() => {
        const delta = prevPad.current - padLeft;
        prevPad.current = padLeft;
        if (!isDesktop || delta === 0 || reduce) { slide.set(0); return; }
        slide.set(delta);
        const controls = animate(slide, 0, SPRING_WIDTH);
        return () => controls.stop();
    }, [padLeft, isDesktop, reduce, slide]);

    // Drawer móvil: x es la posición real, arrastrable e interrumpible.
    const x = useMotionValue(-DRAWER_W);
    const scrim = useTransform(x, [-DRAWER_W, 0], [0, 1]);

    useEffect(() => {
        if (isDesktop) { x.set(0); return; }
        animate(x, drawerOpen ? 0 : -DRAWER_W, reduce ? { duration: 0.01 } : SPRING_DRAWER);
    }, [drawerOpen, isDesktop, reduce, x]);

    // Ajuste durante el render, no en un efecto: el drawer se cierra en el mismo
    // frame en que cambia la ruta, sin un fotograma intermedio con las dos cosas.
    const [prevPath, setPrevPath] = useState(location.pathname);
    if (prevPath !== location.pathname) {
        setPrevPath(location.pathname);
        if (drawerOpen) setDrawerOpen(false);
    }

    useEffect(() => {
        if (!drawerOpen) return;
        drawerRef.current?.focus();
        document.body.style.overflow = "hidden";
        const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKey);
        };
    }, [drawerOpen]);

    const onDragEnd = (_, info) => {
        const landing = info.offset.x + project(info.velocity.x);
        const shouldClose = landing < -DRAWER_W / 2;
        setDrawerOpen(!shouldClose);
        // Handoff: el muelle arranca a la velocidad exacta del dedo.
        animate(x, shouldClose ? -DRAWER_W : 0, {
            ...SPRING_DRAWER,
            velocity: info.velocity.x
        });
    };

    // El fade sólo existe donde hay contenido cruzando el chrome. Un fade fijo
    // arriba se comía el primer título de sección.
    const [edges, setEdges] = useState({ top: false, bottom: false });
    const navRef = useRef(null);
    const syncEdges = () => {
        const el = navRef.current;
        if (!el) return;
        setEdges({
            top: el.scrollTop > 2,
            bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2
        });
    };
    useEffect(() => {
        syncEdges();
        const ro = new ResizeObserver(syncEdges);
        if (navRef.current) ro.observe(navRef.current);
        return () => ro.disconnect();
    }, [collapsed, isDesktop]);

    const mask = `linear-gradient(to bottom, ${edges.top ? "transparent 0, #000 16px" : "#000 0"}, ${edges.bottom ? "#000 calc(100% - 20px), transparent 100%" : "#000 100%"})`;

    const activeLabel = navItems.find((i) => isRouteActive(location.pathname, i.href))?.label ?? "";
    const accion = accionMovil(location.pathname);

    return (
        <MotionConfig reducedMotion="user">
            <div className="min-h-screen overflow-x-clip bg-slate-950 text-slate-200 font-sans selection:bg-primary/30">
                <div className="aurora fixed inset-0 z-0 pointer-events-none reduce-transparency:hidden" />

                {/* Barra superior móvil: material flotante, el contenido pasa por debajo */}
                <header
                    className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-3
                               bg-slate-950/60 backdrop-blur-xl border-b border-white/[0.08]
                               reduce-transparency:bg-slate-950 reduce-transparency:backdrop-blur-none"
                >
                    <motion.button
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING}
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Abrir menú"
                        aria-expanded={drawerOpen}
                        className="h-11 w-11 -ml-1 grid place-items-center rounded-xl text-slate-200
                                   active:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                        <Menu className="w-5 h-5" />
                    </motion.button>
                    <span className="text-[15px] font-semibold text-white truncate">
                        {activeLabel}
                    </span>
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                        <motion.button
                            whileTap={{ scale: 0.92 }}
                            transition={SPRING}
                            onClick={() => setPaletaOpen(true)}
                            aria-label="Buscar"
                            className="h-11 w-11 grid place-items-center rounded-xl text-slate-200
                                       active:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            <Search className="w-5 h-5" />
                        </motion.button>
                        {accion && (
                            <Link
                                to={accion.href}
                                aria-label={accion.label}
                                className={cn(
                                    "h-9 pl-2.5 pr-3 inline-flex items-center gap-1 rounded-xl text-sm font-semibold",
                                    "bg-primary text-on-accent shadow-lg shadow-primary/25 outline-none",
                                    "focus-visible:ring-2 focus-visible:ring-primary/60", PRESS
                                )}
                            >
                                <Plus className="w-4 h-4" />
                                {accion.label.split(" ")[0]}
                            </Link>
                        )}
                    </div>
                </header>

                {/* Scrim: sigue al dedo 1:1 durante el arrastre */}
                <motion.div
                    style={{ opacity: scrim }}
                    onClick={() => setDrawerOpen(false)}
                    aria-hidden="true"
                    className={cn(
                        "md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]",
                        drawerOpen ? "pointer-events-auto" : "pointer-events-none"
                    )}
                />

                <motion.aside
                    ref={drawerRef}
                    tabIndex={-1}
                    drag={isDesktop ? false : "x"}
                    dragConstraints={{ left: -DRAWER_W, right: 0 }}
                    dragElastic={0.06}
                    dragMomentum={false}
                    onDragEnd={onDragEnd}
                    style={{
                        width: isDesktop ? width : DRAWER_W,
                        x: isDesktop ? 0 : x,
                        // Sin `paint`: recorta lo que se pinta fuera del borde y
                        // decapita el botón de plegado, que vive en -right-4.
                        contain: "layout style"
                    }}
                    className="fixed top-0 left-0 h-dvh z-50 flex flex-col px-[14px] py-4 outline-none
                               border-r border-white/[0.08] bg-slate-900/60 backdrop-blur-2xl
                               reduce-transparency:bg-slate-900 reduce-transparency:backdrop-blur-none
                               more-contrast:border-white/40 touch-pan-y"
                >
                    {/* Filo de luz del material */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/20 via-white/5 to-transparent" />

                    <motion.button
                        whileTap={{ scale: 0.88 }}
                        transition={SPRING}
                        onClick={() => setCollapsed((c) => !c)}
                        title={collapsed ? "Expandir menú" : "Plegar menú"}
                        aria-label={collapsed ? "Expandir menú" : "Plegar menú"}
                        className="hidden md:grid absolute -right-4 top-6 h-8 w-8 place-items-center rounded-full
                                   bg-slate-800 border border-white/10 text-slate-400 shadow-lg
                                   hover:text-white hover:bg-slate-700 outline-none
                                   focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                        {collapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
                    </motion.button>

                    <div data-tour="marca" className="flex items-center h-12 mb-6 shrink-0">
                        <div className="w-12 h-12 shrink-0 grid place-items-center">
                            {settings.logo ? (
                                <img
                                    src={settings.logo}
                                    alt=""
                                    className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/15 shadow-lg shadow-black/30"
                                />
                            ) : (
                                <div className="w-10 h-10 grid place-items-center bg-primary rounded-xl shadow-lg shadow-primary/25">
                                    <LayoutDashboard className="w-5 h-5 text-on-accent" />
                                </div>
                            )}
                        </div>
                        <motion.div style={{ opacity: labelOpacity }} className="ml-2 min-w-0">
                            {loading ? (
                                <div className="h-4 w-32 rounded bg-white/10 animate-pulse motion-reduce:animate-none" />
                            ) : (
                                <h1 className="text-[15px] font-semibold text-white truncate tracking-[-0.01em]">
                                    {settings.businessName}
                                </h1>
                            )}
                        </motion.div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setPaletaOpen(true)}
                        data-tour="buscar"
                        title={`Buscar  ${esMac ? "⌘" : "Ctrl+"}K`}
                        aria-label="Buscar en la app"
                        className="mb-4 shrink-0 flex items-center h-10 px-[14px] rounded-xl overflow-hidden
                                   bg-white/[0.05] border border-white/10 text-slate-400 hover:text-white
                                   hover:bg-white/[0.08] transition-colors outline-none
                                   focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                        <Search className="w-4 h-4 shrink-0" />
                        <motion.span style={{ opacity: labelOpacity }} className="ml-3 text-sm whitespace-nowrap flex-1 text-left">
                            Buscar…
                        </motion.span>
                        <motion.kbd
                            style={{ opacity: labelOpacity }}
                            className="text-[11px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5 whitespace-nowrap"
                        >
                            {esMac ? "⌘" : "Ctrl"} K
                        </motion.kbd>
                    </button>

                    <nav
                        ref={navRef}
                        onScroll={syncEdges}
                        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-5 custom-scrollbar"
                        style={{ maskImage: mask, WebkitMaskImage: mask }}
                    >
                        {navSections.map((section, i) => (
                            <div key={section.title} className={cn(i > 0 && "pt-5 border-t border-white/[0.06]")}>
                                <motion.h2
                                    style={{ opacity: labelOpacity }}
                                    className="mb-2 px-[14px] text-[11px] font-semibold uppercase
                                               tracking-[0.09em] text-slate-300/80 whitespace-nowrap"
                                >
                                    {section.title}
                                </motion.h2>
                                <div className="space-y-1">
                                    {section.items.map((item) => (
                                        <NavItem
                                            key={item.href}
                                            item={item}
                                            active={isRouteActive(location.pathname, item.href)}
                                            showTooltip={isDesktop && collapsed}
                                            labelOpacity={labelOpacity}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>

                    <div className="mt-4 pt-4 border-t border-white/[0.08] shrink-0 space-y-1">
                        <motion.div
                            style={{ paddingLeft: avatarPad }}
                            className="flex items-center h-11 overflow-hidden"
                        >
                            <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 ring-1 ring-white/20" />
                            <motion.div style={{ opacity: labelOpacity }} className="ml-3 min-w-0">
                                <p className="text-sm font-medium text-white truncate">Administrador</p>
                                <p className="text-xs text-slate-300/70 truncate">{user?.email}</p>
                            </motion.div>
                        </motion.div>

                        <button
                            type="button"
                            onClick={() => setAvisosOpen(true)}
                            title={isDesktop && collapsed ? "Avisos" : undefined}
                            aria-label={avisos.length ? `Avisos, ${avisos.length} pendiente${avisos.length > 1 ? "s" : ""}` : "Avisos"}
                            className="w-full flex items-center h-11 px-[14px] rounded-xl overflow-hidden
                                       transition-transform duration-100 ease-out active:scale-[0.98]
                                       text-slate-300 hover:bg-white/[0.06] outline-none
                                       focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            <span className="relative shrink-0">
                                <Bell className={cn("w-5 h-5", avisos.length ? "text-amber-300" : "text-slate-400")} />
                                {avisos.length > 0 && (
                                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-950
                                                     text-[10px] font-bold leading-4 text-center ring-2 ring-slate-900">
                                        {avisos.length}
                                    </span>
                                )}
                            </span>
                            <motion.span
                                style={{ opacity: labelOpacity }}
                                className="ml-3 text-sm font-medium whitespace-nowrap flex-1 text-left"
                            >
                                Avisos
                            </motion.span>
                        </button>

                        <button
                            type="button"
                            onClick={novedades.abrirLista}
                            data-tour="novedades"
                            title={isDesktop && collapsed ? "Novedades" : undefined}
                            aria-label={novedades.pendiente ? "Novedades, hay una versión nueva" : "Novedades"}
                            className="w-full flex items-center h-11 px-[14px] rounded-xl overflow-hidden
                                       transition-transform duration-100 ease-out active:scale-[0.98]
                                       text-slate-300 hover:bg-white/[0.06] outline-none
                                       focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            <span className="relative shrink-0">
                                <Sparkles className="w-5 h-5 text-slate-400" />
                                {novedades.pendiente && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-slate-900" />
                                )}
                            </span>
                            <motion.span
                                style={{ opacity: labelOpacity }}
                                className="ml-3 text-sm font-medium whitespace-nowrap flex-1 text-left"
                            >
                                Novedades
                            </motion.span>
                            <motion.span
                                style={{ opacity: labelOpacity }}
                                className="text-[11px] text-slate-500 whitespace-nowrap"
                            >
                                v{VERSION_ACTUAL}
                            </motion.span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
                            title={isDesktop && collapsed ? (resolved === "dark" ? "Modo claro" : "Modo oscuro") : undefined}
                            aria-label={resolved === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                            className="w-full flex items-center h-11 px-[14px] rounded-xl overflow-hidden
                                       transition-transform duration-100 ease-out active:scale-[0.98]
                                       text-slate-300 hover:bg-white/[0.06] outline-none
                                       focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            {resolved === "dark"
                                ? <Sun className="w-5 h-5 shrink-0 text-slate-400" />
                                : <Moon className="w-5 h-5 shrink-0 text-slate-400" />}
                            <motion.span
                                style={{ opacity: labelOpacity }}
                                className="ml-3 text-sm font-medium whitespace-nowrap"
                            >
                                {resolved === "dark" ? "Modo claro" : "Modo oscuro"}
                            </motion.span>
                        </button>

                        <button
                            onClick={logout}
                            title={isDesktop && collapsed ? "Cerrar sesión" : undefined}
                            className="w-full flex items-center h-11 px-[14px] rounded-xl overflow-hidden
                                       transition-transform duration-100 ease-out active:scale-[0.98]
                                       text-slate-300 hover:bg-white/[0.06] outline-none
                                       focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            <LogOut className="w-5 h-5 shrink-0 text-slate-400" />
                            <motion.span
                                style={{ opacity: labelOpacity }}
                                className="ml-3 text-sm font-medium whitespace-nowrap"
                            >
                                Cerrar sesión
                            </motion.span>
                        </button>
                    </div>
                </motion.aside>

                <motion.div
                    className="relative z-10"
                    style={{
                        paddingLeft: padLeft,
                        x: slide,
                        willChange: "transform",
                        contain: "layout paint"
                    }}
                >
                    <main data-tour="vista" className="min-h-dvh px-4 md:px-6 lg:px-8 py-4 pt-[4.5rem] md:pt-4">
                        {children}
                    </main>
                </motion.div>

                <CommandPalette open={paletaOpen} onClose={() => setPaletaOpen(false)} navItems={navItems} />
                {novedades.modo === "tutorial" && (
                    <Tour pasos={PASOS_TOUR} onFin={novedades.cerrar} onPaso={onPasoTour} />
                )}
                <Avisos abierto={avisosOpen} avisos={avisos} onCerrar={() => setAvisosOpen(false)} />
                <Novedades
                    abierto={novedades.modo === "lista"}
                    versionVista={novedades.versionVista}
                    onCerrar={novedades.cerrar}
                    onRepetirTutorial={novedades.abrirTutorial}
                />
            </div>
        </MotionConfig>
    );
}
