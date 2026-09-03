import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-alphanumeric except spaces and dashes
    .replace(/[\s_-]+/g, "-") // replace spaces, underscores and multiple dashes with single dash
    .replace(/^-+|-+$/g, ""); // trim leading and trailing dashes
}
