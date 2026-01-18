import { Link, useLocation } from "react-router-dom";
import { Package, PlusCircle, LayoutDashboard, ShoppingCart, BarChart3, History, Globe } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

export function Layout({ children }) {
    const location = useLocation();
    const { settings, loading } = useTheme();

    const navItems = [
        { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
        { href: "/", label: "Productos", icon: Package },
        { href: "/crear", label: "Crear Producto", icon: PlusCircle },
        { href: "/ventas", label: "Punto de Venta", icon: ShoppingCart },
        { href: "/historial", label: "Historial", icon: History },
        { href: "/pedidos-web", label: "Pedidos Web", icon: Globe },
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
                <aside className="fixed top-0 left-0 h-screen w-64 border-r border-white/10 bg-slate-900/50 backdrop-blur-xl p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <div className="p-2 bg-primary rounded-lg">
                            {settings.logo ? (
                                <img src={settings.logo} alt="Logo" className="w-6 h-6 object-contain" />
                            ) : (
                                <LayoutDashboard className="w-6 h-6 text-white" />
                            )}
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            {settings.businessName}
                        </h1>
                    </div>

                    <nav className="space-y-2 flex-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.href;
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                        isActive
                                            ? "text-white bg-white/10 shadow-lg shadow-primary/10"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNav"
                                            className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                        />
                                    )}
                                    <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300")} />
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="mt-auto pt-6 border-t border-white/10">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
                            <div>
                                <p className="text-sm font-medium text-white">Admin User</p>
                                <p className="text-xs text-slate-500">admin@montino.app</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 ml-64 p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
