"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Home, Sun, Gem, MessageCircle, ScrollText } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  /** Marks the product's core destination, drawn in the centre slot. */
  primary?: boolean;
  /**
   * Extra path prefixes that should light this tab. `/report*` are the three
   * paid readings but the hub lives at `/reports`, and `/overview` is a
   * chart-derived reading reached from Kundli — without this, those pages
   * render with no tab active at all.
   */
  match?: string[];
};

/**
 * Bottom navigation bar (mobile-first tab bar).
 * `inline` renders it inside the page flow (used by the immersive chat screen)
 * instead of fixed to the viewport bottom.
 *
 * Arya (the chat) sits in the centre slot: it is the product, so it gets the
 * strongest position rather than the last one.
 */
export function AppNav({ inline = false }: { inline?: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/kundli", label: t("kundli"), icon: Gem, match: ["/overview"] },
    { href: "/chat", label: t("arya"), icon: MessageCircle, primary: true },
    { href: "/reports", label: t("reports"), icon: ScrollText, match: ["/report"] },
    { href: "/today", label: t("today"), icon: Sun },
  ];

  return (
    <nav
      className={`tabbar ${inline ? "tabbar--inline" : ""}`}
      aria-label={t("primary")}
    >
      {tabs.map(({ href, label, icon: Icon, primary, match }) => {
        const active =
          pathname === href ||
          (match ?? []).some(
            (m) => pathname === m || pathname.startsWith(`${m}/`)
          );
        return (
          <Link
            key={href}
            href={href}
            className={`tabbar__item ${primary ? "tabbar__item--primary" : ""} ${active ? "tabbar__item--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={primary ? 23 : 21} strokeWidth={active ? 2.4 : 1.8} />
            <span className="tabbar__label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
