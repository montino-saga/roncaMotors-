import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { SPRING_SNAPPY } from "../../lib/motion";

export function Button({ className, variant = "primary", children, ...props }) {
    const variants = {
        primary: "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30",
        secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/10",
        danger: "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30",
    };

    return (
        <motion.button
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAPPY}
            className={cn(
                "px-4 py-2 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </motion.button>
    );
}
