import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard Tailwind class merger utility.
 * Allows for clean conditional classes and prevents class conflicts.
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
