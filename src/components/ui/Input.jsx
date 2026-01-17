import { cn } from "../../lib/utils";

export function Input({ className, ...props }) {
    return (
        <input
            className={cn(
                "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all",
                className
            )}
            {...props}
        />
    );
}
