"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Home, Sun, Gem, MessageCircle } from "lucide-react";

/**
 * Bottom navigation bar (mobile-first tab bar).
 * `inline` renders it inside the page flow (used by the immersive chat screen)
 * instead of fixed to the viewport bottom.
 */
export function AppNav({ inline = false }: { inline?: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/today", label: t("today"), icon: Sun },
    { href: "/kundli", label: t("kundli"), icon: Gem },
    { href: "/chat", label: t("arya"), icon: MessageCircle },
  ];

  return (
    <nav
      className={`tabbar ${inline ? "tabbar--inline" : ""}`}
      aria-label="Primary"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`tabbar__item ${active ? "tabbar__item--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
            <span className="tabbar__label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
