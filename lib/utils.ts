import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safe sessionStorage access that only runs in the browser
export function getSessionStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return sessionStorage.getItem(key)
  }
  return null
}

export function setSessionStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.setItem(key, value)
  }
}

export function clearSessionStorage(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.clear()
  }
}
