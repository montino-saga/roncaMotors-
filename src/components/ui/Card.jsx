import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }) {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
            className={cn(
                "bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-xl text-white",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
}
