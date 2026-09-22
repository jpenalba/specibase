import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Natural alphanumeric sort (so "S2" sorts before "S10", not after) — used
// wherever samples are listed by Sample ID.
export function compareIdentifiers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
