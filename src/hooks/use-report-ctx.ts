"use client";

import { useSyncExternalStore } from "react";
import { REPORT_CTX_KEY } from "@/lib/storage";
import type { ReportCtx } from "@/lib/report";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(REPORT_CTX_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * React-friendly read of the last paid marriage report this device holds.
 * Mirrors useKundli: returns null on the server so SSR and the first client
 * render agree, then fills in from localStorage after mount.
 */
export function useReportCtx(): ReportCtx | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReportCtx;
  } catch {
    return null;
  }
}
