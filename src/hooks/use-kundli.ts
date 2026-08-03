"use client";

import { useSyncExternalStore } from "react";
import { KUNDLI_KEY } from "@/lib/storage";
import type { KundliResult } from "@/lib/types";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(KUNDLI_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

/** React-friendly read of the persisted Kundli from localStorage. */
export function useKundli(): KundliResult | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KundliResult;
  } catch {
    return null;
  }
}
