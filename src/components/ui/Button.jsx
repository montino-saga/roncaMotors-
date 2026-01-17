import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function Button({ className, variant = "primary", children, ...props }) {
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30",
        secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/10",
        danger: "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30",
    };

    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            className={cn(
                "px-4 py-2 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </motion.button>
    );
}
