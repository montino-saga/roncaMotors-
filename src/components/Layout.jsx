import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Package, PlusCircle, LayoutDashboard, ShoppingCart, BarChart3, History, Globe, Lock, ChevronLeft, ChevronRight, User } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

export function Layout({ children }) {
    const location = useLocation();
    const { settings, loading } = useTheme();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navSections = [
        {
            title: "Caja y Ventas",
            items: [
                { href: "/", label: "Cierre de Caja", icon: Lock },
                { href: "/ventas", label: "Punto de Venta", icon: ShoppingCart },
                { href: "/clientes", label: "Clientes", icon: User },
                { href: "/pedidos-web", label: "Pedidos Web", icon: Globe },
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
                { href: "/historial", label: "Historial", icon: History },
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 flex min-h-screen">
                {/* Sidebar */}
                <aside 
                    className={cn(
                        "fixed top-0 left-0 h-screen border-r border-white/10 bg-slate-900/50 backdrop-blur-xl flex flex-col transition-all duration-300 z-50",
                        isCollapsed ? "w-20 p-4" : "w-64 p-6"
                    )}
                >
                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="absolute -right-3 top-8 bg-slate-800 border border-white/10 rounded-full p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>

                    <div className={cn("flex items-center gap-3 mb-8 shrink-0", isCollapsed ? "justify-center px-0" : "px-2")}>
                        <div className="p-2 bg-primary rounded-lg shrink-0">
                            {settings.logo ? (
                                <img src={settings.logo} alt="Logo" className="w-6 h-6 object-contain" />
                            ) : (
                                <LayoutDashboard className="w-6 h-6 text-white" />
                            )}
                        </div>
                        {!isCollapsed && (
                            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent truncate">
                                {settings.businessName}
                            </h1>
                        )}
                    </div>

                    <nav className="space-y-6 flex-1 overflow-y-auto overflow-x-hidden">
                        {navSections.map((section, index) => (
                            <div key={index} className={cn(index > 0 && "pt-6 border-t border-white/5")}>
                                {!isCollapsed && (
                                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-4 truncate">
                                        {section.title}
                                    </h3>
                                )}
                                <div className="space-y-1">
                                    {section.items.map((item) => {
                                        const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                                        const Icon = item.icon;

                                        return (
                                            <Link
                                                key={item.href}
                                                to={item.href}
                                                title={isCollapsed ? item.label : undefined}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-xl transition-all duration-200 group relative overflow-hidden text-sm",
                                                    isCollapsed ? "justify-center p-2.5" : "px-4 py-2.5",
                                                    isActive
                                                        ? "text-white bg-white/10 shadow-lg shadow-primary/10"
                                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                                )}
                                            >
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="activeNav"
                                                        className={cn(
                                                            "absolute bg-primary",
                                                            isCollapsed ? "inset-0 opacity-10 rounded-xl" : "left-0 w-1 h-5 rounded-r-full"
                                                        )}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: isCollapsed ? 0.1 : 1 }}
                                                        exit={{ opacity: 0 }}
                                                    />
                                                )}
                                                <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300")} />
                                                {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>

                    <div className={cn("mt-auto pt-6 border-t border-white/10", isCollapsed ? "flex justify-center" : "")}>
                        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "px-2")}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 shrink-0" />
                            {!isCollapsed && (
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-white truncate">Admin User</p>
                                    <p className="text-xs text-slate-500 truncate">admin@montino.app</p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main 
                    className={cn(
                        "flex-1 p-12 transition-all duration-300",
                        isCollapsed ? "ml-20" : "ml-64"
                    )}
                >
                    <div className="w-full h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
