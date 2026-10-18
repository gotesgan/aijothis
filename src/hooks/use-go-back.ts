"use client";

import { useCallback } from "react";

import { useRouter } from "@/i18n/navigation";
import { hasPreviousPage } from "@/lib/nav-history";

type GoBackOptions = {
  /**
   * Where this screen's parent lives, for the case where there is no page to
   * go back to. Only set it when the design intends a specific parent (the
   * reading screens belong to Kundli); otherwise home is the answer.
   */
  parent?: string;
  /** Where "there is nowhere to go back" lands. Home by default. */
  home?: string;
};

/**
 * The one place that decides what "back" means.
 *
 * Priority: the page the user actually came from → the screen's parent (if it
 * declares one) → home. The browser history is consulted through
 * `hasPreviousPage()`, never `history.length` directly: a fresh tab already
 * reports 2, so raw length would send a cold-opened screen onto the blank
 * new-tab entry.
 *
 * Use it with <BackButton /> for the standard control, or call the returned
 * function from a gesture/keyboard handler that needs the same behaviour.
 */
export function useGoBack({ parent, home = "/" }: GoBackOptions = {}) {
  const router = useRouter();

  return useCallback(() => {
    if (hasPreviousPage()) {
      router.back();
      return;
    }
    router.push(parent ?? home);
  }, [router, parent, home]);
}
