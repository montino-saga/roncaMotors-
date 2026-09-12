import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }) {
    return (
        <motion.div
            className={cn(
                "card-entra glass bg-glass rounded-2xl p-6 text-white",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
}
