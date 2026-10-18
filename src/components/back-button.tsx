"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";

import { useGoBack } from "@/hooks/use-go-back";
import { hasPreviousPage } from "@/lib/nav-history";

const subscribeNoop = () => () => {};

type BackButtonProps = {
  /** Parent screen to fall back to when there is nothing behind this page. */
  parent?: string;
  /** Where "nowhere to go back" lands. Home by default. */
  home?: string;
  /** Extra class for placement only — the shape and states are shared. */
  className?: string;
  /**
   * Render nothing when there is no page to return to. For the chat, where
   * "home" redirects straight back to the chat, a visible button would be a
   * loop the user cannot escape.
   */
  hideWhenNoHistory?: boolean;
};

/**
 * The single back control for the app. Destination logic lives in
 * `useGoBack`; this only draws it.
 */
export function BackButton({
  parent,
  home,
  className,
  hideWhenNoHistory,
}: BackButtonProps) {
  const goBack = useGoBack({ parent, home });
  const tc = useTranslations("Common");
  const canGoBack = useSyncExternalStore(
    subscribeNoop,
    hasPreviousPage,
    () => false
  );

  if (hideWhenNoHistory && !canGoBack) return null;

  return (
    <button
      type="button"
      className={className ? `back-btn ${className}` : "back-btn"}
      aria-label={tc("back")}
      onClick={goBack}
    >
      <ArrowLeft size={22} aria-hidden="true" />
    </button>
  );
}
