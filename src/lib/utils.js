import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const FORMATO_CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })

// El signo va antes del $: Intl en Chrome da "$-800", que se lee como error.
export const formatCLP = (amount) => {
  const n = Number(amount) || 0
  const txt = FORMATO_CLP.format(Math.abs(n))
  return n < 0 ? `-${txt}` : txt
}
